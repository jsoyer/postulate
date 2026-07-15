"""Unit tests for PDF/A support in scripts/render.py and scripts/check-pdfa.py."""

import sys
import tempfile
from pathlib import Path

import pytest

import render as render_mod
from render import build_preamble, render_cv


# ---------------------------------------------------------------------------
# Minimal test data
# ---------------------------------------------------------------------------

SAMPLE_CV_DATA = {
    "personal": {
        "first_name": "Jerome",
        "last_name": "Soyer",
        "position": "Engineering Director",
        "address": "Paris, France",
        "mobile": "+33 6 00 00 00 00",
        "email": "jerome@example.com",
        "linkedin": "jeromesoyer",
    },
    "profile": "Experienced engineering leader.",
    "skills": [
        {"category": "Languages", "items": "Python, Go, Rust"},
        {"category": "Cloud", "items": "AWS, GCP, Kubernetes"},
    ],
    "key_wins": [
        {"title": "Scale", "text": "Grew team from 5 to 30"},
    ],
    "experience": [
        {
            "title": "Engineering Director",
            "company": "Acme Corp",
            "location": "Paris",
            "dates": "2023-present",
            "items": [{"text": "Led platform migration"}],
        },
    ],
    "early_career": [
        {
            "title": "Senior Engineer",
            "company": "Startup Inc",
            "location": "Lyon",
            "dates": "2020-2023",
        },
    ],
    "education": [
        {
            "degree": "MSc Computer Science",
            "school": "Ecole Polytechnique",
            "location": "Paris",
            "dates": "2018-2020",
        },
    ],
    "certifications": [
        {"name": "AWS Solutions Architect", "institution": "Amazon", "date": "2022"},
    ],
    "awards": "Best Innovation Award 2023",
    "publications": "Distributed Systems Journal, 2022",
    "languages": ["English", "French"],
    "interests": ["Open Source", "Hiking"],
}


# ---------------------------------------------------------------------------
# build_preamble — PDF/A mode
# ---------------------------------------------------------------------------


class TestBuildPreamblePdfa:
    def test_pdfa_disabled_no_pdfx(self):
        preamble = build_preamble({}, pdfa=False)
        assert "pdfx" not in preamble

    def test_pdfa_enabled_uses_documentmetadata(self):
        """TeXLive 2026: PDF/A-2b conformance is declared via \\DocumentMetadata
        (LaTeX kernel PDF standards support), not the legacy `pdfx` package."""
        preamble = build_preamble({}, pdfa=True, personal=SAMPLE_CV_DATA["personal"])
        assert "\\DocumentMetadata{" in preamble
        assert "pdfstandard=A-2b" in preamble
        assert "tagging=off" in preamble
        assert "\\usepackage[a-2b]{pdfx}" not in preamble

    def test_pdfa_enabled_documentmetadata_is_first_line(self):
        """\\DocumentMetadata must be the very first line of the file, with
        \\documentclass immediately following -- nothing (not even comments)
        may precede \\documentclass once \\DocumentMetadata is used
        (TeXLive 2026 requirement)."""
        preamble = build_preamble({}, pdfa=True, personal=SAMPLE_CV_DATA["personal"])
        lines = preamble.splitlines()
        assert lines[0].startswith("\\DocumentMetadata{")
        assert lines[1].startswith("\\documentclass[")

    def test_pdfa_enabled_has_babel_english(self):
        preamble = build_preamble({}, pdfa=True, personal=SAMPLE_CV_DATA["personal"])
        assert "\\usepackage[english]{babel}" in preamble

    def test_pdfa_enabled_has_babel_french(self):
        preamble = build_preamble({}, pdfa=True, personal=SAMPLE_CV_DATA["personal"], lang="fr")
        assert "\\usepackage[french]{babel}" in preamble

    def test_pdfa_enabled_no_manual_tagpdf(self):
        """TeXLive 2026: tagging is activated by \\DocumentMetadata itself;
        manually loading `tagpdf` / calling `\\tagpdfsetup` now collides with
        it ("PDF resource management is no active!"). Assert the manual
        package load is gone and \\DocumentMetadata is present instead."""
        preamble = build_preamble({}, pdfa=True, personal=SAMPLE_CV_DATA["personal"])
        assert "\\usepackage{tagpdf}" not in preamble
        assert "\\tagpdfsetup{tags=true}" not in preamble
        assert "\\DocumentMetadata{" in preamble

    def test_pdfa_enabled_tagging_off(self):
        """PDF/A-2b ("basic") does not require tagging, and TeXLive 2026's
        default tagging activation is incompatible with `enumitem`'s
        `leftmargin`/`noitemsep` keys used throughout awesome-cv itemize
        environments ("Package block Error: Some keys specified on the
        itemize environment are unknown"). `tagging=off` is the LaTeX-team
        supported key to disable tagging while keeping full A-2b conformance
        (output intent + XMP marker + font embedding). See
        latex3/tagging-project#1301."""
        preamble = build_preamble({}, pdfa=True, personal=SAMPLE_CV_DATA["personal"])
        assert "tagging=off" in preamble
        idx = preamble.index("\\DocumentMetadata{")
        line_end = preamble.index("\n", idx)
        assert "tagging=off" in preamble[idx:line_end]

    def test_pdfa_disabled_no_tagpdf(self):
        preamble = build_preamble({}, pdfa=False)
        assert "tagpdf" not in preamble

    def test_pdfa_disabled_no_babel(self):
        preamble = build_preamble({}, pdfa=False)
        assert "\\usepackage[english]{babel}" not in preamble
        assert "\\usepackage[french]{babel}" not in preamble


# ---------------------------------------------------------------------------
# render_cv — PDF/A mode
# ---------------------------------------------------------------------------


class TestRenderCvPdfa:
    def test_render_cv_pdfa_passes_lang(self):
        """lang now drives the `lang=` key inside \\DocumentMetadata
        (fr-FR / en-US) instead of a pdfx/babel-only concern."""
        fr_output = render_cv(SAMPLE_CV_DATA, pdfa=True, lang="fr")
        assert "\\usepackage[french]{babel}" in fr_output
        assert "\\DocumentMetadata{pdfstandard=A-2b, pdfversion=1.7, lang=fr-FR, tagging=off}" in fr_output

        en_output = render_cv(SAMPLE_CV_DATA, pdfa=True)
        assert "\\usepackage[english]{babel}" in en_output
        assert "\\DocumentMetadata{pdfstandard=A-2b, pdfversion=1.7, lang=en-US, tagging=off}" in en_output

    def test_render_cv_pdfa_english(self):
        output = render_cv(SAMPLE_CV_DATA, pdfa=True)
        assert "\\usepackage[english]{babel}" in output

    def test_render_cv_no_pdfa(self):
        output = render_cv(SAMPLE_CV_DATA, pdfa=False)
        assert "pdfx" not in output


# ---------------------------------------------------------------------------
# PDF/A metadata flow (TeXLive 2026: no more .xmpdata sidecar)
# ---------------------------------------------------------------------------


class TestPdfaMetadataFlow:
    def test_documentmetadata_carries_standard_and_lang(self):
        """Repurposed from the old `test_xmpdata_content_structure`: the
        `.xmpdata` sidecar file is no longer generated (render.py main() no
        longer writes one -- see the comment above `main()`'s pdfa branch).
        TeXLive 2026's \\DocumentMetadata drives XMP metadata generation
        itself from its own keys (pdfstandard, pdfversion, lang) plus the
        \\hypersetup{pdftitle=..., pdfauthor=...} values already emitted in
        the preamble -- so coverage is repurposed to assert that both halves
        of that metadata (DocumentMetadata keys + hypersetup title/author)
        are present in the rendered output, instead of asserting anything
        about a sidecar file that no longer exists."""
        output = render_cv(SAMPLE_CV_DATA, pdfa=True)

        # \DocumentMetadata carries the PDF/A standard + version + lang keys,
        # plus tagging=off (A-2b needs no tagging; avoids the enumitem/
        # tagging incompatibility on TL2026 -- latex3/tagging-project#1301).
        assert "\\DocumentMetadata{pdfstandard=A-2b, pdfversion=1.7, lang=en-US, tagging=off}" in output

        # Title/author metadata (formerly duplicated into CV.xmpdata for
        # pdfx to consume) still flows through \hypersetup -- \DocumentMetadata
        # sources XMP metadata from it, so no separate .xmpdata is needed.
        assert "pdfauthor={Jerome Soyer}" in output
        assert "pdftitle={Engineering Director - Jerome Soyer}" in output


# ---------------------------------------------------------------------------
# check-pdfa.py — embedded-fonts detection on Type0/CID composite fonts
# ---------------------------------------------------------------------------
#
# XeLaTeX (and therefore every PDF this engine produces, PDF/A or not)
# always emits composite `/Type0` fonts with an `/Encoding /Identity-H` and
# a `/DescendantFonts` array -- never simple fonts. The actual embedded font
# program (`/FontFile`, `/FontFile2`, or `/FontFile3`) and its
# `/FontDescriptor` live on the *descendant* CIDFontType0/CIDFontType2
# dictionary, NOT on the Type0 dict itself (which has no `/FontDescriptor`
# key at all -- see PDF32000-1:2008 sec 9.7.4). `pdffonts` (poppler) reports
# these fonts as `emb yes`, but `check-pdfa.py`'s original embedded_fonts
# check only inspected `font_obj.get("/FontDescriptor")` directly on the
# top-level font dict, which is always None for Type0 fonts -- misreporting
# every genuinely-embedded XeLaTeX font as not-embedded.


def _build_type0_font_pdf(path: Path, embedded: bool) -> None:
    """Build a minimal single-page PDF with one `/Type0` composite font,
    shaped exactly like the fonts XeLaTeX emits (Type0 -> DescendantFonts ->
    CIDFontType0 -> FontDescriptor -> FontFile3), to reproduce the
    embedded-fonts detection bug independent of a real TeX toolchain."""
    from pypdf import PdfWriter
    from pypdf.generic import ArrayObject, DecodedStreamObject, DictionaryObject, NameObject

    writer = PdfWriter()
    page = writer.add_blank_page(width=200, height=200)

    font_descriptor = DictionaryObject()
    font_descriptor[NameObject("/Type")] = NameObject("/FontDescriptor")
    font_descriptor[NameObject("/FontName")] = NameObject("/ABCDEF+TestFont")
    if embedded:
        stream = DecodedStreamObject()
        stream.set_data(b"%fake CFF font program%")
        stream[NameObject("/Subtype")] = NameObject("/CIDFontType0C")
        font_descriptor[NameObject("/FontFile3")] = writer._add_object(stream)
    fd_ref = writer._add_object(font_descriptor)

    descendant = DictionaryObject()
    descendant[NameObject("/Type")] = NameObject("/Font")
    descendant[NameObject("/Subtype")] = NameObject("/CIDFontType0")
    descendant[NameObject("/BaseFont")] = NameObject("/ABCDEF+TestFont")
    descendant[NameObject("/FontDescriptor")] = fd_ref
    descendant_ref = writer._add_object(descendant)

    type0_font = DictionaryObject()
    type0_font[NameObject("/Type")] = NameObject("/Font")
    type0_font[NameObject("/Subtype")] = NameObject("/Type0")
    type0_font[NameObject("/BaseFont")] = NameObject("/ABCDEF+TestFont")
    type0_font[NameObject("/Encoding")] = NameObject("/Identity-H")
    type0_font[NameObject("/DescendantFonts")] = ArrayObject([descendant_ref])
    type0_ref = writer._add_object(type0_font)

    font_dict = DictionaryObject()
    font_dict[NameObject("/F1")] = type0_ref

    if "/Resources" not in page:
        page[NameObject("/Resources")] = DictionaryObject()
    page["/Resources"][NameObject("/Font")] = font_dict

    writer.add_metadata({"/Title": "T", "/Author": "A", "/Subject": "S"})

    with open(path, "wb") as f:
        writer.write(f)


class TestCheckPdfaType0FontEmbedding:
    def _load_check_pdfa_module(self):
        import importlib.util

        spec = importlib.util.spec_from_file_location(
            "check_pdfa",
            str(Path(__file__).parent.parent / "scripts" / "check-pdfa.py"),
        )
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        return mod

    def test_embedded_type0_font_detected_as_embedded(self, tmp_path):
        """A Type0 font whose descendant CIDFontType0 has a FontDescriptor
        with FontFile3 (i.e. genuinely embedded, as poppler's `pdffonts`
        would report `emb yes`) must be detected as embedded."""
        mod = self._load_check_pdfa_module()
        pdf_path = tmp_path / "type0-embedded.pdf"
        _build_type0_font_pdf(pdf_path, embedded=True)

        result = mod.check_pdfa(str(pdf_path))

        fonts_check = result["checks"]["embedded_fonts"]
        assert fonts_check["total_fonts"] == 1
        assert fonts_check["all_embedded"] is True
        assert fonts_check["status"] == "PASS"
        assert result["status"] == "PASS"

    def test_non_embedded_type0_font_still_detected_as_not_embedded(self, tmp_path):
        """A Type0 font whose descendant has no FontFile/FontFile2/FontFile3
        (genuinely not embedded) must still be flagged as not embedded --
        the fix must not turn this check into a rubber stamp."""
        mod = self._load_check_pdfa_module()
        pdf_path = tmp_path / "type0-not-embedded.pdf"
        _build_type0_font_pdf(pdf_path, embedded=False)

        result = mod.check_pdfa(str(pdf_path))

        fonts_check = result["checks"]["embedded_fonts"]
        assert fonts_check["total_fonts"] == 1
        assert fonts_check["all_embedded"] is False
        assert fonts_check["status"] == "FAIL"
        assert result["status"] == "FAIL"

    def test_metadata_check_has_status_key_when_all_fields_present(self, tmp_path):
        """The `metadata` sub-check dict was missing its own `status` key
        (unlike every other sub-check), so `format_text()`'s generic
        `check_data.get("status", "UNKNOWN")` always rendered `metadata:
        UNKNOWN` even when title/author/subject all individually PASS.
        This doesn't affect the overall PASS/FAIL gate (which is computed
        separately from has_title/has_author/has_subject), but the display
        should reflect PASS when all three sub-fields pass."""
        mod = self._load_check_pdfa_module()
        pdf_path = tmp_path / "type0-embedded.pdf"
        _build_type0_font_pdf(pdf_path, embedded=True)

        result = mod.check_pdfa(str(pdf_path))

        metadata_check = result["checks"]["metadata"]
        assert metadata_check["title"] == "PASS"
        assert metadata_check["author"] == "PASS"
        assert metadata_check["subject"] == "PASS"
        assert metadata_check["status"] == "PASS"

        output = mod.format_text([result])
        assert "metadata: UNKNOWN" not in output
        assert "metadata: PASS" in output


class TestCheckPdfa:
    def test_check_pdfa_missing_file(self):
        import importlib.util

        spec = importlib.util.spec_from_file_location(
            "check_pdfa",
            str(Path(__file__).parent.parent / "scripts" / "check-pdfa.py"),
        )
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)

        result = mod.check_pdfa("/nonexistent/file.pdf")
        assert result["status"] == "FAIL"
        assert "File not found" in result["error"]

    def test_check_pdfa_format_text(self):
        import importlib.util

        spec = importlib.util.spec_from_file_location(
            "check_pdfa",
            str(Path(__file__).parent.parent / "scripts" / "check-pdfa.py"),
        )
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)

        results = [{"file": "test.pdf", "status": "PASS", "checks": {}}]
        output = mod.format_text(results)
        assert "test.pdf" in output
        assert "PASS" in output

    def test_check_pdfa_format_text_fail(self):
        import importlib.util

        spec = importlib.util.spec_from_file_location(
            "check_pdfa",
            str(Path(__file__).parent.parent / "scripts" / "check-pdfa.py"),
        )
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)

        results = [{"file": "test.pdf", "status": "FAIL", "error": "Cannot read"}]
        output = mod.format_text(results)
        assert "Cannot read" in output
        assert "test.pdf" in output
