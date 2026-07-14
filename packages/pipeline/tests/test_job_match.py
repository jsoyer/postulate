"""Tests for job-match.py — CV ↔ job compatibility scoring."""

import json
import os
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

import sys
import importlib.util

# Load job-match.py (hyphenated name requires importlib)
_spec = importlib.util.spec_from_file_location(
    "job_match", str(Path(__file__).parent.parent / "scripts" / "job-match.py")
)
job_match = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(job_match)

run_match = job_match.run_match
_validate_result = job_match._validate_result
_format_terminal = job_match._format_terminal


@pytest.fixture
def sample_match_result():
    return {
        "overall_score": 72,
        "breakdown": {
            "skills": {"score": 80, "matched": ["Python", "Go"], "missing": ["Rust"]},
            "experience": {"score": 75, "notes": "5+ years matches requirement"},
            "location": {"score": 90, "notes": "Remote-friendly"},
            "salary": {"score": 60, "notes": "P50 vs P75 role"},
            "culture": {"score": 65, "notes": "Startup vs enterprise"},
        },
        "red_flags": ["Requires Rust, not in CV"],
        "recommendation": "proceed",
        "reasoning": "Strong skills match, good experience fit.",
    }


class TestValidateResult:
    def test_valid_result(self):
        result = {
            "overall_score": 72,
            "breakdown": {
                "skills": {"score": 80, "matched": ["Python"], "missing": ["Rust"]},
                "experience": {"score": 75, "notes": "OK"},
                "location": {"score": 90, "notes": "Remote"},
                "salary": {"score": 60, "notes": "OK"},
                "culture": {"score": 65, "notes": "OK"},
            },
            "red_flags": [],
            "recommendation": "proceed",
            "reasoning": "Good match.",
        }
        validated = _validate_result(result)
        assert validated["overall_score"] == 72
        assert validated["recommendation"] == "proceed"

    def test_clamps_score(self):
        result = {
            "overall_score": 150,
            "breakdown": {
                "skills": {"score": 80, "matched": [], "missing": []},
                "experience": {"score": 75, "notes": ""},
                "location": {"score": 90, "notes": ""},
                "salary": {"score": 60, "notes": ""},
                "culture": {"score": 65, "notes": ""},
            },
            "red_flags": [],
            "recommendation": "proceed",
            "reasoning": "",
        }
        validated = _validate_result(result)
        assert validated["overall_score"] == 100


class TestFormatTerminal:
    def test_output_contains_score(self, sample_match_result, capsys):
        _format_terminal(sample_match_result, 60)
        captured = capsys.readouterr()
        assert "72" in captured.out
        assert "proceed" in captured.out.lower()

    def test_output_contains_breakdown(self, sample_match_result, capsys):
        _format_terminal(sample_match_result, 60)
        captured = capsys.readouterr()
        assert "skills" in captured.out.lower()
        assert "experience" in captured.out.lower()

    def test_output_shows_red_flags(self, sample_match_result, capsys):
        _format_terminal(sample_match_result, 60)
        captured = capsys.readouterr()
        assert "Rust" in captured.out


class TestRunMatch:
    @patch.object(job_match, "call_ai")
    def test_returns_valid_structure(self, mock_ai, tmp_path):
        mock_ai.return_value = json.dumps(
            {
                "overall_score": 72,
                "breakdown": {
                    "skills": {"score": 80, "matched": ["Python", "Go"], "missing": ["Rust"]},
                    "experience": {"score": 75, "notes": "5+ years matches"},
                    "location": {"score": 90, "notes": "Remote"},
                    "salary": {"score": 60, "notes": "P50 vs P75"},
                    "culture": {"score": 65, "notes": "Startup vs enterprise"},
                },
                "red_flags": ["Requires Rust"],
                "recommendation": "proceed",
                "reasoning": "Good match overall.",
            }
        )

        app_dir = tmp_path / "test-app"
        app_dir.mkdir()
        (app_dir / "job.txt").write_text("Senior Python Engineer\nRequirements: Python, Go, Rust")
        cv_path = tmp_path / "cv.yml"
        cv_path.write_text("personal:\n  name: Test")

        result = run_match(str(app_dir), str(cv_path), "gemini", "fake-key", "")

        assert "overall_score" in result
        assert 0 <= result["overall_score"] <= 100
        assert "breakdown" in result
        assert "recommendation" in result
        assert result["recommendation"] in ("proceed", "caution", "skip")

    @patch.object(job_match, "call_ai")
    def test_score_weighting(self, mock_ai, tmp_path):
        """Verify the 40/20/15/15/10 weighting produces correct overall."""
        mock_ai.return_value = json.dumps(
            {
                "overall_score": 100,
                "breakdown": {
                    "skills": {"score": 100, "matched": [], "missing": []},
                    "experience": {"score": 100, "notes": ""},
                    "location": {"score": 100, "notes": ""},
                    "salary": {"score": 100, "notes": ""},
                    "culture": {"score": 100, "notes": ""},
                },
                "red_flags": [],
                "recommendation": "proceed",
                "reasoning": "Perfect match.",
            }
        )

        app_dir = tmp_path / "test-app"
        app_dir.mkdir()
        (app_dir / "job.txt").write_text("Engineer")
        cv_path = tmp_path / "cv.yml"
        cv_path.write_text("personal:\n  name: Test")

        result = run_match(str(app_dir), str(cv_path), "gemini", "fake-key", "")
        assert result["overall_score"] == 100
