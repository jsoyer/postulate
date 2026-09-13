#!/usr/bin/env python3
"""Fail if CV PDFs exceed 2 pages or cover letters exceed 1.

Usage:
    scripts/check-pages.py CV.pdf CoverLetter.pdf
    scripts/check-pages.py applications/2026-09-chainguard/
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path


def count_pages(path: Path) -> int:
    try:
        r = subprocess.run(
            ["pdfinfo", str(path)], capture_output=True, text=True, timeout=10
        )
        for line in r.stdout.splitlines():
            if line.startswith("Pages:"):
                return int(line.split(":")[1].strip())
    except Exception:
        pass
    try:
        data = path.read_bytes()
    except OSError:
        return -1
    m = re.search(rb"/Type\s*/Pages\b[^>]*/Count\s+(\d+)", data)
    return int(m.group(1)) if m else -1


def page_limit(name: str) -> int:
    return 1 if "coverletter" in name.lower() else 2


def collect(args: list[str]) -> list[Path]:
    files: list[Path] = []
    for arg in args:
        path = Path(arg)
        if path.is_dir():
            files.extend(sorted(p for p in path.glob("*.pdf") if p.is_file()))
        elif path.is_file():
            files.append(path)
    return files


def main(argv: list[str] | None = None) -> int:
    files = collect(argv if argv is not None else sys.argv[1:])
    if not files:
        print("No PDFs to check")
        return 0
    failed = 0
    for pdf in files:
        pages = count_pages(pdf)
        limit = page_limit(pdf.name)
        if pages < 0:
            print(f"   FAIL {pdf.name}: could not count pages")
            failed += 1
        elif pages <= limit:
            print(f"   OK {pdf.name}: {pages} page(s) (max {limit})")
        else:
            print(f"   FAIL {pdf.name}: {pages} page(s) (max {limit})")
            failed += 1
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
