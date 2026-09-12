#!/usr/bin/env python3
"""Deposit application PDFs to Google Drive.

Order:
1. RCLONE_REMOTE (e.g. gdrive:CV) — rclone copyto
2. DRIVE_DIR — local sync folder copy

Folder: {YYYY-MM}-{Company}-{Position} (hyphens, no spaces).
PDFs: CV-{Company}-{Position}.pdf / CoverLetter-{Company}-{Position}.pdf
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

try:
    import yaml
except ImportError:  # pragma: no cover
    yaml = None


def hyphen(text: str) -> str:
    slug = re.sub(r"[^A-Za-z0-9]+", "-", (text or "").strip())
    return slug.strip("-") or "role"


def _meta(app_dir: Path) -> dict[str, Any]:
    path = app_dir / "meta.yml"
    if yaml is None or not path.is_file():
        return {}
    loaded = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    return loaded if isinstance(loaded, dict) else {}


def drive_names(app_dir: Path) -> tuple[str, str, str]:
    """Return (folder, cv_filename, coverletter_filename)."""
    meta = _meta(app_dir)
    created = str(meta.get("created") or "").strip()
    if not re.match(r"^\d{4}-\d{2}$", created):
        created = app_dir.name[:7] if re.match(r"^\d{4}-\d{2}", app_dir.name) else ""
    company = hyphen(str(meta.get("company") or app_dir.name))
    position = hyphen(str(meta.get("position") or "role"))
    folder = f"{created}-{company}-{position}" if created else f"{company}-{position}"
    return (
        folder,
        f"CV-{company}-{position}.pdf",
        f"CoverLetter-{company}-{position}.pdf",
    )


def _pdfs(app_dir: Path) -> list[Path]:
    return sorted(app_dir.glob("*.pdf"))


def _dest_filename(pdf: Path, cv_name: str, cl_name: str) -> str:
    stem = pdf.name.lower().replace(" ", "")
    if "coverletter" in stem or stem.startswith("cover"):
        return cl_name
    if stem.startswith("cv") or "cv-" in stem:
        return cv_name
    return pdf.name.replace(" ", "-")


def deposit_local(app_dir: Path, drive_root: Path) -> list[Path]:
    pdfs = _pdfs(app_dir)
    if not pdfs:
        return []
    folder, cv_name, cl_name = drive_names(app_dir)
    dest = drive_root / folder
    dest.mkdir(parents=True, exist_ok=True)
    copied: list[Path] = []
    for pdf in pdfs:
        target = dest / _dest_filename(pdf, cv_name, cl_name)
        shutil.copy2(pdf, target)
        copied.append(target)
    return copied


def deposit_rclone(app_dir: Path, remote: str) -> list[str]:
    pdfs = _pdfs(app_dir)
    if not pdfs:
        return []
    folder, cv_name, cl_name = drive_names(app_dir)
    dest = f"{remote.rstrip('/')}/{folder}"
    copied: list[str] = []
    for pdf in pdfs:
        target = f"{dest}/{_dest_filename(pdf, cv_name, cl_name)}"
        proc = subprocess.run(
            ["rclone", "copyto", str(pdf), target],
            capture_output=True,
            text=True,
            check=False,
        )
        if proc.returncode != 0:
            err = (proc.stderr or proc.stdout or "").strip()[-800:]
            raise RuntimeError(f"rclone copyto failed ({proc.returncode}): {err}")
        copied.append(target)
    return copied


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    if len(args) < 1:
        print(
            "Usage: drive_deposit.py <application-dir> [drive-root-or-rclone-remote]",
            file=sys.stderr,
        )
        return 2
    app_dir = Path(args[0])
    if not app_dir.is_dir():
        print(f"Not an application dir: {app_dir}", file=sys.stderr)
        return 1

    remote = (os.environ.get("RCLONE_REMOTE") or "").strip()
    drive = ""
    if len(args) > 1 and args[1]:
        arg = args[1]
        if ":" in arg and not arg.startswith("/"):
            remote = arg
        else:
            drive = arg
    if not drive:
        drive = (os.environ.get("DRIVE_DIR") or "").strip()

    if not remote and not drive:
        print("RCLONE_REMOTE / DRIVE_DIR unset — skip PDF deposit")
        return 0

    if not _pdfs(app_dir):
        print(f"No PDFs in {app_dir}")
        return 0

    if remote:
        copied = deposit_rclone(app_dir, remote)
        print(f"rclone ← {len(copied)} PDF(s)")
        for path in copied:
            print(f"  {path}")
        return 0

    copied_local = deposit_local(app_dir, Path(drive))
    print(f"Drive ← {len(copied_local)} PDF(s)")
    for path in copied_local:
        print(f"  {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
