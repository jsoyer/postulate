package runner

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
)

// streamSSE handles GET /jobs/{id}/stream.
//
// It sends a continuous SSE stream of output events from the job. Each event
// is a JSON-encoded Event object. The stream closes once the job reaches a
// terminal state and all buffered events have been delivered.
//
// Clients that connect after the job is done receive the full event history.
func (s *Server) streamSSE(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	job, ok := s.store.GetJob(id)
	if !ok {
		http.Error(w, `{"error":"job not found"}`, http.StatusNotFound)
		return
	}

	// Verify the client supports flushing (required for SSE).
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, `{"error":"streaming not supported"}`, http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no") // disable Nginx buffering if present
	w.WriteHeader(http.StatusOK)
	flusher.Flush()

	ticker := time.NewTicker(50 * time.Millisecond)
	defer ticker.Stop()

	cursor := 0

	for {
		select {
		case <-r.Context().Done():
			// Client disconnected.
			return

		case <-ticker.C:
			events := job.getEventsSince(cursor)
			for _, ev := range events {
				data, err := json.Marshal(ev)
				if err != nil {
					slog.Error("failed to marshal SSE event", "job_id", id, "error", err)
					continue
				}
				// SSE wire format: "data: <payload>\n\n"
				if _, err := w.Write([]byte("data: " + string(data) + "\n\n")); err != nil {
					// Client closed connection mid-stream.
					return
				}
				cursor++
			}
			flusher.Flush()

			// If the job is done and we've delivered every event, close the stream.
			if job.isDone() {
				// Drain any events appended between the last getEventsSince and isDone.
				remaining := job.getEventsSince(cursor)
				for _, ev := range remaining {
					data, err := json.Marshal(ev)
					if err != nil {
						slog.Error("failed to marshal SSE event", "job_id", id, "error", err)
						continue
					}
					if _, err := w.Write([]byte("data: " + string(data) + "\n\n")); err != nil {
						return
					}
					cursor++
				}
				flusher.Flush()
				return
			}
		}
	}
}
