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

    def test_pdfa_enabled_has_pdfx_a2b(self):
        preamble = build_preamble({}, pdfa=True, personal=SAMPLE_CV_DATA["personal"])
        assert "\\usepackage[a-2b]{pdfx}" in preamble

    def test_pdfa_enabled_has_babel_english(self):
        preamble = build_preamble({}, pdfa=True, personal=SAMPLE_CV_DATA["personal"])
        assert "\\usepackage[english]{babel}" in preamble

    def test_pdfa_enabled_has_babel_french(self):
        preamble = build_preamble(
            {}, pdfa=True, personal=SAMPLE_CV_DATA["personal"], lang="fr"
        )
        assert "\\usepackage[french]{babel}" in preamble

    def test_pdfa_enabled_has_tagpdf(self):
        preamble = build_preamble({}, pdfa=True, personal=SAMPLE_CV_DATA["personal"])
        assert "\\usepackage{tagpdf}" in preamble
        assert "\\tagpdfsetup{tags=true}" in preamble

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
        output = render_cv(SAMPLE_CV_DATA, pdfa=True, lang="fr")
        assert "\\usepackage[french]{babel}" in output
        assert "\\usepackage[a-2b]{pdfx}" in output

    def test_render_cv_pdfa_english(self):
        output = render_cv(SAMPLE_CV_DATA, pdfa=True)
        assert "\\usepackage[english]{babel}" in output

    def test_render_cv_no_pdfa(self):
        output = render_cv(SAMPLE_CV_DATA, pdfa=False)
        assert "pdfx" not in output


# ---------------------------------------------------------------------------
# xmpdata generation (tested via render.py main() output)
# ---------------------------------------------------------------------------


class TestXmpdataGeneration:
    def test_xmpdata_content_structure(self):
        """Verify that when pdfa is enabled, the generated LaTeX includes
        the pdfx package which will read the .xmpdata file."""
        output = render_cv(SAMPLE_CV_DATA, pdfa=True)
        # The .xmpdata file is generated separately by main(); verify
        # the LaTeX preamble references pdfx correctly.
        assert "\\usepackage[a-2b]{pdfx}" in output


# ---------------------------------------------------------------------------
# check-pdfa.py — import and function tests
# ---------------------------------------------------------------------------


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
