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
import zlib
from pathlib import Path

_COUNT_PATTERNS = (
    rb"/Type\s*/Pages.{0,400}/Count\s+(\d+)",
    rb"/Count\s+(\d+).{0,80}/Type\s*/Pages",
    rb"/Type\s*/Pages/Count\s+(\d+)",
)


def _count_in(blob: bytes) -> int:
    for pat in _COUNT_PATTERNS:
        m = re.search(pat, blob, re.DOTALL)
        if m:
            return int(m.group(1))
    return -1


def _inflate_streams(data: bytes) -> list[bytes]:
    out: list[bytes] = []
    for m in re.finditer(rb"stream\r?\n(.*?)endstream", data, re.DOTALL):
        chunk = m.group(1)
        if chunk.endswith(b"\r\n"):
            chunk = chunk[:-2]
        elif chunk.endswith(b"\n"):
            chunk = chunk[:-1]
        for wbits in (zlib.MAX_WBITS, -zlib.MAX_WBITS):
            try:
                out.append(zlib.decompress(chunk, wbits))
                break
            except zlib.error:
                continue
    return out


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
    n = _count_in(data)
    if n > 0:
        return n
    for blob in _inflate_streams(data):
        n = _count_in(blob)
        if n > 0:
            return n
    return -1


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
