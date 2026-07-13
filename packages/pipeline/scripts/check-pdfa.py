#!/usr/bin/env python3
"""
Check PDF/A compliance of generated PDFs.

Usage:
    scripts/check-pdfa.py CV.pdf
    scripts/check-pdfa.py --json CV.pdf
    scripts/check-pdfa.py applications/2026-02-databricks/CV-*.pdf

Checks:
  - PDF/A conformance level (via metadata)
  - Embedded fonts
  - Metadata presence (title, author, subject)
  - Tagged PDF structure
"""

import argparse
import json
import sys
from pathlib import Path

try:
    from pypdf import PdfReader
except ImportError:
    print("❌ pypdf required: pip install pypdf")
    sys.exit(1)


def check_pdfa(pdf_path: str) -> dict:
    """Run PDF/A compliance checks on a single PDF file."""
    path = Path(pdf_path)
    if not path.exists():
        return {"file": pdf_path, "status": "FAIL", "error": "File not found"}

    results: dict = {
        "file": pdf_path,
        "status": "PASS",
        "checks": {},
    }

    try:
        reader = PdfReader(str(path))
    except Exception as e:
        results["status"] = "FAIL"
        results["error"] = f"Cannot read PDF: {e}"
        return results

    # 1. Check metadata
    info = reader.metadata or {}
    has_title = bool(info.get("/Title"))
    has_author = bool(info.get("/Author"))
    has_subject = bool(info.get("/Subject"))

    results["checks"]["metadata"] = {
        "title": "PASS" if has_title else "FAIL",
        "author": "PASS" if has_author else "FAIL",
        "subject": "PASS" if has_subject else "FAIL",
    }

    if not (has_title and has_author and has_subject):
        results["status"] = "FAIL"

    # 2. Check for PDF/A conformance markers in metadata
    pdfa_conformance = info.get("/GTS_PDFXConformance") or info.get("/PDFAXConformance")
    has_pdfa_marker = bool(pdfa_conformance)

    # Also check if pdfx package metadata is present
    has_pdfx_metadata = any(
        key.startswith("/pdfx:") or "pdfx" in key.lower()
        for key in info
    )

    results["checks"]["pdfa_conformance"] = {
        "status": "PASS" if (has_pdfa_marker or has_pdfx_metadata) else "WARN",
        "conformance": str(pdfa_conformance) if pdfa_conformance else "not detected",
        "pdfx_metadata": has_pdfx_metadata,
        "note": "PDF/A marker requires full xelatex compilation with pdfx package",
    }

    # 3. Check for tagged PDF
    catalog = reader.trailer.get("/Root", {})
    if hasattr(catalog, "get"):
        is_tagged = bool(catalog.get("/MarkInfo", {}).get("/Marked", False))
    else:
        is_tagged = False

    results["checks"]["tagged_pdf"] = {
        "status": "PASS" if is_tagged else "WARN",
        "marked": is_tagged,
        "note": "Tagged PDF improves accessibility for screen readers",
    }

    # 4. Check embedded fonts
    fonts = reader.get_fonts()
    font_list = list(fonts) if fonts else []
    all_embedded = True
    font_details = []

    for font_ref in font_list[:20]:  # Limit to first 20 for readability
        font_obj = reader.get_object(font_ref)
        if font_obj:
            font_name = font_obj.get("/BaseFont", str(font_ref))
            font_descriptor = font_obj.get("/FontDescriptor")
            embedded = font_descriptor is not None
            if not embedded:
                all_embedded = False
            font_details.append({
                "name": str(font_name)[:60],
                "embedded": embedded,
            })

    results["checks"]["embedded_fonts"] = {
        "status": "PASS" if all_embedded else "FAIL",
        "total_fonts": len(font_list),
        "all_embedded": all_embedded,
        "fonts": font_details,
    }

    if not all_embedded:
        results["status"] = "FAIL"

    # 5. Check page count
    num_pages = len(reader.pages)
    results["checks"]["page_count"] = {
        "pages": num_pages,
        "status": "PASS" if num_pages <= 2 else "WARN",
    }

    return results


def format_text(results: list[dict]) -> str:
    """Format results as human-readable text."""
    lines = []
    all_pass = True

    for r in results:
        lines.append(f"\n{'='*60}")
        lines.append(f"File: {r['file']}")
        lines.append(f"{'='*60}")

        if "error" in r:
            lines.append(f"❌ ERROR: {r['error']}")
            all_pass = False
            continue

        overall = r["status"]
        icon = "✅" if overall == "PASS" else "❌"
        lines.append(f"\nOverall: {icon} {overall}")

        for check_name, check_data in r["checks"].items():
            status = check_data.get("status", "UNKNOWN")
            icon = "✅" if status == "PASS" else ("⚠️" if status == "WARN" else "❌")
            lines.append(f"  {icon} {check_name}: {status}")

            if "note" in check_data:
                lines.append(f"     Note: {check_data['note']}")

            if check_name == "metadata":
                for k, v in check_data.items():
                    if k != "status":
                        lines.append(f"       {k}: {v}")

            if check_name == "pdfa_conformance":
                lines.append(f"       Conformance: {check_data.get('conformance', 'N/A')}")

            if check_name == "embedded_fonts":
                lines.append(f"       Total fonts: {check_data.get('total_fonts', 0)}")
                lines.append(f"       All embedded: {check_data.get('all_embedded', False)}")

    lines.append("")
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Check PDF/A compliance")
    parser.add_argument("pdf_files", nargs="+", help="PDF file(s) to check")
    parser.add_argument("--json", action="store_true", help="Output JSON format")
    args = parser.parse_args()

    # Expand glob patterns
    files = []
    for pattern in args.pdf_files:
        expanded = list(Path().glob(pattern))
        if expanded:
            files.extend(expanded)
        else:
            files.append(Path(pattern))

    results = []
    for f in files:
        if f.is_file():
            results.append(check_pdfa(str(f)))

    if args.json:
        print(json.dumps(results, indent=2, default=str))
    else:
        output = format_text(results)
        print(output)

    # Exit code: 0 if all PASS, 1 if any FAIL
    any_fail = any(r.get("status") == "FAIL" for r in results)
    sys.exit(1 if any_fail else 0)


if __name__ == "__main__":
    sys.exit(main() if "main" in dir() else 0)
