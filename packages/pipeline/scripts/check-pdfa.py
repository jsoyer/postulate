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
        # `status` was missing here (unlike every other sub-check), so
        # format_text()'s generic `check_data.get("status", "UNKNOWN")`
        # always rendered "metadata: UNKNOWN" even when every sub-field
        # passed. Doesn't affect the PASS/FAIL gate below (computed
        # independently from has_title/has_author/has_subject) -- display only.
        "status": "PASS" if (has_title and has_author and has_subject) else "FAIL",
        "title": "PASS" if has_title else "FAIL",
        "author": "PASS" if has_author else "FAIL",
        "subject": "PASS" if has_subject else "FAIL",
    }

    if not (has_title and has_author and has_subject):
        results["status"] = "FAIL"

    # 2. Check for PDF/A conformance markers in metadata.
    #
    # Legacy (TeXLive <= 2025, `pdfx` package): conformance was surfaced via
    # Info-dictionary keys such as /GTS_PDFXConformance, /PDFAXConformance,
    # and /pdfx:* custom properties.
    #
    # Modern (TeXLive 2026+, `\DocumentMetadata{pdfstandard=A-2b, ...}`):
    # conformance is signalled via the /GTS_PDFA1Conformance Info-dictionary
    # key and, more reliably, via the `pdfaid` XMP namespace
    # (pdfaid:part / pdfaid:conformance) embedded in the document's XMP
    # metadata stream. See pypdf's XmpInformation.pdfaid_part /
    # .pdfaid_conformance (namespace http://www.aiim.org/pdfa/ns/id/).
    legacy_conformance = (
        info.get("/GTS_PDFXConformance") or info.get("/PDFAXConformance") or info.get("/GTS_PDFA1Conformance")
    )
    has_pdfx_metadata = any(key.startswith("/pdfx:") or "pdfx" in key.lower() for key in info)

    xmp_part = None
    xmp_conformance = None
    try:
        xmp = reader.xmp_metadata
        if xmp is not None:
            xmp_part = xmp.pdfaid_part
            xmp_conformance = xmp.pdfaid_conformance
    except Exception:
        pass
    has_xmp_pdfaid = bool(xmp_part or xmp_conformance)

    if xmp_part or xmp_conformance:
        conformance_str = f"A-{xmp_part or '?'}{(xmp_conformance or '').lower()}"
    elif legacy_conformance:
        conformance_str = str(legacy_conformance)
    else:
        conformance_str = "not detected"

    has_pdfa_marker = bool(legacy_conformance or has_xmp_pdfaid)

    results["checks"]["pdfa_conformance"] = {
        "status": "PASS" if (has_pdfa_marker or has_pdfx_metadata) else "WARN",
        "conformance": conformance_str,
        "pdfx_metadata": has_pdfx_metadata,
        "xmp_pdfaid": has_xmp_pdfaid,
        "note": (
            "PDF/A marker requires full xelatex compilation with "
            "\\DocumentMetadata (TeXLive 2026+) or the legacy pdfx package"
        ),
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
    # Note: `PdfReader.get_fonts()` was removed from pypdf's public API (this
    # code targeted an older pypdf release); fonts are now collected directly
    # from each page's /Resources/Font dictionary, deduplicated by indirect
    # object reference. Unrelated to the PDF/A marker fix above, but this
    # check was crashing outright (AttributeError) before the fix.
    #
    # XeLaTeX (and therefore every PDF this engine renders) always emits
    # composite `/Type0` fonts with `/Encoding /Identity-H`, never simple
    # fonts. A Type0 font dict has NO `/FontDescriptor` key of its own --
    # the actual font program (`/FontFile`, `/FontFile2`, `/FontFile3`) and
    # its FontDescriptor live on the *descendant* CIDFontType0/CIDFontType2
    # dict referenced via `/DescendantFonts` (PDF32000-1:2008 sec 9.7.4).
    # Looking at `font_obj.get("/FontDescriptor")` directly therefore always
    # returned None for Type0 fonts, misreporting every genuinely-embedded
    # font as not embedded (poppler's `pdffonts` correctly shows `emb yes`
    # for the same fonts). `_font_descriptor()` below resolves the
    # descendant indirection, and embedding is confirmed by the presence of
    # an actual font-program stream (`/FontFile*`), not just the descriptor
    # (a FontDescriptor can exist for a referenced-but-not-embedded font).
    def _font_descriptor(font_obj):
        # `DictionaryObject.get()` (unlike its `__getitem__`) does NOT
        # reliably auto-resolve `IndirectObject` values across pypdf
        # versions -- explicitly call `.get_object()` on every hop so this
        # works the same whether the reference was already resolved or not.
        if font_obj.get("/Subtype") == "/Type0":
            descendants = font_obj.get("/DescendantFonts")
            if not descendants:
                return None
            descendant = descendants[0].get_object()
            descriptor = descendant.get("/FontDescriptor")
        else:
            descriptor = font_obj.get("/FontDescriptor")
        return descriptor.get_object() if descriptor is not None else None

    all_embedded = True
    font_details = []
    seen_refs: set = set()

    for page in reader.pages:
        resources = page.get("/Resources")
        font_dict = resources.get("/Font") if resources else None
        if not font_dict:
            continue
        for font_key in font_dict:
            raw = font_dict.raw_get(font_key)
            ref_id = (raw.idnum, raw.generation) if hasattr(raw, "idnum") else font_key
            if ref_id in seen_refs:
                continue
            seen_refs.add(ref_id)

            font_obj = font_dict[font_key]
            if not font_obj:
                continue
            font_name = font_obj.get("/BaseFont", str(font_key))
            font_descriptor = _font_descriptor(font_obj)
            embedded = font_descriptor is not None and any(
                key in font_descriptor for key in ("/FontFile", "/FontFile2", "/FontFile3")
            )
            if not embedded:
                all_embedded = False
            font_details.append(
                {
                    "name": str(font_name)[:60],
                    "embedded": embedded,
                }
            )

    results["checks"]["embedded_fonts"] = {
        "status": "PASS" if all_embedded else "FAIL",
        "total_fonts": len(seen_refs),
        "all_embedded": all_embedded,
        "fonts": font_details[:20],  # Limit to first 20 for readability
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
        lines.append(f"\n{'=' * 60}")
        lines.append(f"File: {r['file']}")
        lines.append(f"{'=' * 60}")

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
