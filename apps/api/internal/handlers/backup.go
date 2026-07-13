package handlers

import (
	"archive/tar"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// BackupHandler streams a tar.gz archive of the applications directory.
type BackupHandler struct {
	cvPath string
}

// NewBackupHandler creates a BackupHandler for the given CV path.
func NewBackupHandler(cvPath string) *BackupHandler {
	return &BackupHandler{cvPath: cvPath}
}

// ServeHTTP handles GET /api/backup — streams a tar.gz of the applications directory.
func (h *BackupHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	appsDir := filepath.Join(h.cvPath, "applications")

	if _, err := os.Stat(appsDir); err != nil {
		respondError(w, http.StatusNotFound, "Applications directory not found")
		return
	}

	filename := fmt.Sprintf("cv-applications-backup-%s.tar.gz", time.Now().UTC().Format("2006-01-02"))
	w.Header().Set("Content-Type", "application/gzip")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))

	gz := gzip.NewWriter(w)
	defer func() {
		if err := gz.Close(); err != nil {
			slog.Error("backup gzip close failed", "error", err)
		}
	}()

	tw := tar.NewWriter(gz)
	defer func() {
		if err := tw.Close(); err != nil {
			slog.Error("backup tar close failed", "error", err)
		}
	}()

	err := filepath.Walk(appsDir, func(path string, info os.FileInfo, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}

		rel, err := filepath.Rel(h.cvPath, path)
		if err != nil {
			return fmt.Errorf("rel path %q: %w", path, err)
		}

		hdr, err := tar.FileInfoHeader(info, "")
		if err != nil {
			return fmt.Errorf("tar header for %q: %w", path, err)
		}
		hdr.Name = rel

		if err := tw.WriteHeader(hdr); err != nil {
			return fmt.Errorf("write tar header for %q: %w", rel, err)
		}

		if info.IsDir() {
			return nil
		}

		f, err := os.Open(path)
		if err != nil {
			return fmt.Errorf("open %q: %w", path, err)
		}
		defer func() {
			if err := f.Close(); err != nil {
				slog.Warn("backup file close failed", "path", path, "error", err)
			}
		}()

		if _, err := io.Copy(tw, f); err != nil {
			return fmt.Errorf("copy %q: %w", path, err)
		}

		return nil
	})

	if err != nil {
		slog.Error("backup walk failed", "error", err)
	}
}

const restoreMaxBytes = 100 * 1024 * 1024 // 100 MB

// Restore handles POST /api/restore — accepts a multipart tar.gz upload and
// extracts it into {cvPath}/applications/, overwriting existing files.
func (h *BackupHandler) Restore(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(restoreMaxBytes); err != nil {
		respondError(w, http.StatusBadRequest, "invalid multipart request: "+err.Error())
		return
	}

	file, _, err := r.FormFile("backup")
	if err != nil {
		respondError(w, http.StatusBadRequest, "missing backup file in multipart form")
		return
	}
	defer func() {
		if cerr := file.Close(); cerr != nil {
			slog.Warn("restore file close failed", "error", cerr)
		}
	}()

	gr, err := gzip.NewReader(file)
	if err != nil {
		respondError(w, http.StatusBadRequest, "file is not valid gzip: "+err.Error())
		return
	}
	defer func() {
		if cerr := gr.Close(); cerr != nil {
			slog.Warn("restore gzip close failed", "error", cerr)
		}
	}()

	tr := tar.NewReader(gr)

	appsDir := filepath.Join(h.cvPath, "applications")

	var restored int
	for {
		hdr, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			respondError(w, http.StatusBadRequest, "invalid tar archive")
			return
		}

		if strings.Contains(hdr.Name, "..") || filepath.IsAbs(hdr.Name) {
			continue
		}

		target := filepath.Join(appsDir, filepath.FromSlash(hdr.Name))

		if !strings.HasPrefix(target, appsDir) {
			continue
		}

		if hdr.FileInfo().IsDir() {
			if err := os.MkdirAll(target, 0750); err != nil {
				respondError(w, http.StatusInternalServerError, "failed to create directory")
				return
			}
			continue
		}

		if err := os.MkdirAll(filepath.Dir(target), 0750); err != nil {
			respondError(w, http.StatusInternalServerError, "failed to create parent directory")
			return
		}

		if err := writeRestoreFile(target, tr); err != nil {
			respondError(w, http.StatusInternalServerError, "failed to write file")
			return
		}
		restored++
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(map[string]any{
		"restored": restored,
		"message":  fmt.Sprintf("restored %d file(s) successfully", restored),
	}); err != nil {
		slog.Warn("restore encode response failed", "error", err)
	}
}

func writeRestoreFile(target string, r io.Reader) error {
	f, err := os.OpenFile(target, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0640)
	if err != nil {
		return err
	}
	defer func() {
		if cerr := f.Close(); cerr != nil {
			slog.Warn("restore dest file close failed", "path", target, "error", cerr)
		}
	}()
	_, err = io.Copy(f, r)
	return err
}
