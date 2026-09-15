"""Tests for the CV MCP pipeline (qualify → ingest → run → follow-up)."""

from __future__ import annotations

import json
import sys
from datetime import date, timedelta
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from cv_mcp.pipeline import (  # noqa: E402
    CvRepo,
    _start_engine,
    application_name,
    deposit_pdfs,
    draft_application,
    draft_followup,
    get_application,
    ingest_job,
    list_applications,
    list_followups,
    run_pipeline,
    set_status,
    slugify,
)
from cv_mcp.qualify import qualify_job  # noqa: E402


def _prefs() -> dict:
    return {
        "salary": {"min": 130000, "currency": "EUR"},
        "remote": {"preferred": "hybrid", "acceptable": ["remote", "hybrid"]},
        "location": {"acceptable": ["Paris", "France", "Remote", "Europe"]},
        "industry": {
            "preferred": ["cybersecurity", "ai", "cloud"],
            "avoid": ["gambling", "tobacco"],
        },
        "deal_breakers": ["fully on-site", "must relocate"],
    }


def test_slugify_and_name() -> None:
    assert slugify("Cloudflare, Inc.") == "cloudflare-inc"
    name = application_name("Anthropic", when=date(2026, 2, 1))
    assert name == "2026-02-anthropic"


def test_qualify_skip_deal_breaker() -> None:
    result = qualify_job(
        "On-site security role. Fully on-site in London. Must relocate.",
        _prefs(),
    )
    assert result["recommendation"] == "skip"
    assert result["score"] < 40
    assert any("deal_breaker" in r or "on-site" in r.lower() for r in result["reasons"])


def test_qualify_skip_avoid_industry() -> None:
    result = qualify_job("Dealer role at a gambling platform, remote EU", _prefs())
    assert result["recommendation"] == "skip"


def test_qualify_apply_good_match() -> None:
    jd = (
        "Staff Solutions Engineer, cybersecurity and AI, hybrid Paris. "
        "Cloud security for enterprise SaaS. Remote-friendly EU."
    )
    result = qualify_job(jd, _prefs())
    assert result["recommendation"] in {"apply", "review"}
    assert result["score"] >= 60


def test_ingest_and_list(tmp_path: Path) -> None:
    repo = CvRepo(tmp_path, engine_root=tmp_path / "_no_engine")
    ingested = ingest_job(
        repo,
        company="Acme",
        position="Staff Engineer",
        url="https://jobs.example.com/acme",
        job_text="Build cloud security products in Paris, hybrid.",
        when=date(2026, 8, 1),
    )
    assert ingested["name"] == "2026-08-acme"
    assert (tmp_path / "applications" / "2026-08-acme" / "job.txt").is_file()
    assert (tmp_path / "applications" / "2026-08-acme" / "meta.yml").is_file()
    apps = list_applications(repo)
    assert len(apps) == 1
    assert apps[0]["company"] == "Acme"
    got = get_application(repo, "2026-08-acme")
    assert got["position"] == "Staff Engineer"
    assert "cloud security" in got["job_text"]


def test_ingest_is_idempotent(tmp_path: Path) -> None:
    repo = CvRepo(tmp_path, engine_root=tmp_path / "_no_engine")
    kwargs = dict(
        company="Acme",
        position="SE",
        job_text="hello",
        when=date(2026, 8, 1),
    )
    first = ingest_job(repo, **kwargs)
    second = ingest_job(repo, **kwargs)
    assert first["name"] == second["name"]
    assert second["deduped"] is True


def test_run_pipeline_requires_confirm(tmp_path: Path) -> None:
    repo = CvRepo(tmp_path, engine_root=tmp_path / "_no_engine")
    result = run_pipeline(
        repo,
        company="Acme",
        position="SE",
        job_text="hybrid cybersecurity Paris",
        confirm=False,
        preferences=_prefs(),
    )
    assert result["ok"] is False
    assert result["needs_confirm"] is True
    assert "plan" in result
    assert not (tmp_path / "applications").exists() or not any(
        (tmp_path / "applications").iterdir()
    )


def test_run_pipeline_skip_when_qualify_skip(tmp_path: Path) -> None:
    repo = CvRepo(tmp_path, engine_root=tmp_path / "_no_engine")
    result = run_pipeline(
        repo,
        company="Casino",
        position="Dealer",
        job_text="Gambling floor role, fully on-site, must relocate",
        confirm=True,
        force=False,
        preferences=_prefs(),
    )
    assert result["ok"] is False
    assert result["recommendation"] == "skip"


def test_run_pipeline_scaffolds_and_tracks(tmp_path: Path) -> None:
    repo = CvRepo(tmp_path, engine_root=tmp_path / "_no_engine")
    result = run_pipeline(
        repo,
        company="Acme",
        position="Solutions Engineer",
        url="https://jobs.example.com/x",
        job_text="Hybrid cybersecurity AI role in Paris.",
        confirm=True,
        preferences=_prefs(),
        when=date(2026, 8, 28),
    )
    assert result["ok"] is True
    assert result["name"] == "2026-08-acme"
    assert result["engine_ran"] is False
    assert "submodule" in result["next"].lower() or "engine" in result["next"].lower()
    note = tmp_path / "tracker" / "2026-08-acme.md"
    assert note.is_file()
    assert "Draft" in note.read_text(encoding="utf-8")


def test_set_status_and_followups(tmp_path: Path) -> None:
    repo = CvRepo(tmp_path, engine_root=tmp_path / "_no_engine")
    run_pipeline(
        repo,
        company="Acme",
        position="SE",
        job_text="hybrid cybersecurity Paris",
        confirm=True,
        preferences=_prefs(),
        when=date(2026, 8, 1),
    )
    stale_day = (date.today() - timedelta(days=10)).isoformat()
    updated = set_status(repo, "2026-08-acme", status="Applied", applied=stale_day)
    assert updated["status"] == "Applied"
    stale = list_followups(repo, older_than_days=7)
    assert any(item["name"] == "2026-08-acme" for item in stale)
    draft = draft_followup(repo, "2026-08-acme")
    assert "Acme" in draft["subject"]
    assert "SE" in draft["body"] or "Solutions" in draft["body"] or "role" in draft["body"].lower()


def test_draft_application_from_cover_letter(tmp_path: Path) -> None:
    repo = CvRepo(tmp_path, engine_root=tmp_path / "_no_engine")
    ingest_job(
        repo,
        company="Acme",
        position="Solutions Engineer",
        job_text="hybrid cybersecurity Paris",
        when=date(2026, 8, 1),
    )
    (tmp_path / "data").mkdir(parents=True, exist_ok=True)
    (tmp_path / "data" / "cv.yml").write_text(
        "personal:\n  first_name: Jerome\n  last_name: Soyer\n",
        encoding="utf-8",
    )
    (tmp_path / "applications" / "2026-08-acme" / "coverletter.yml").write_text(
        "recipient:\n  name: Hiring Team\n  company: Acme\n"
        'title: "Application for Solutions Engineer"\n'
        'opening: "Dear Hiring Team,"\n'
        'closing: "Best regards,"\n'
        "sections:\n"
        "  - title: About Me\n"
        "    content: I lead **SE** teams in Paris.\n"
        "closing_paragraph: Glad to discuss.\n",
        encoding="utf-8",
    )
    (tmp_path / "applications" / "2026-08-acme" / "CV.pdf").write_bytes(b"%PDF-1.4\n")
    draft = draft_application(repo, "2026-08-acme")
    assert draft["send"] is False
    assert draft["draft_only"] is True
    assert "do not send" in draft["instruction"].lower()
    assert draft["source"] == "coverletter.yml"
    assert "Solutions Engineer" in draft["subject"]
    assert "Dear Hiring Team" in draft["body"]
    assert "**" not in draft["body"]
    assert "SE teams" in draft["body"]
    assert "Jerome Soyer" in draft["body"]
    assert draft["attachments"] and draft["attachments"][0].endswith("CV.pdf")


def test_draft_application_fallback_without_letter(tmp_path: Path) -> None:
    repo = CvRepo(tmp_path, engine_root=tmp_path / "_no_engine")
    ingest_job(
        repo,
        company="Beta",
        position="Staff SE",
        job_text="remote AI Paris",
        when=date(2026, 9, 1),
    )
    draft = draft_application(repo, "2026-09-beta")
    assert draft["send"] is False
    assert draft["source"] == "fallback"
    assert "Staff SE" in draft["body"]
    assert "Beta" in draft["subject"]


def test_deposit_pdfs_copies_into_drive_tree(tmp_path: Path, monkeypatch) -> None:
    repo = CvRepo(tmp_path, engine_root=tmp_path / "_no_engine")
    ingest_job(repo, company="Acme", position="SE", job_text="hybrid paris", when=date(2026, 8, 1))
    app = tmp_path / "applications" / "2026-08-acme"
    (app / "CV.pdf").write_bytes(b"%PDF-1.4\n")
    drive = tmp_path / "GoogleDrive" / "CV"
    monkeypatch.delenv("RCLONE_REMOTE", raising=False)
    monkeypatch.setenv("DRIVE_DIR", str(drive))
    copied = deposit_pdfs(repo, "2026-08-acme")
    dest = drive / "2026-08-Acme-SE" / "CV-Acme-SE.pdf"
    assert dest.is_file()
    assert any(str(dest) in c or c.endswith("CV-Acme-SE.pdf") for c in copied)


def test_start_engine_creates_log_when_app_dir_missing(tmp_path: Path, monkeypatch) -> None:
    repo = CvRepo(tmp_path, engine_root=tmp_path / "engine")
    (tmp_path / "engine").mkdir()
    (tmp_path / "engine" / "Makefile").write_text("all:\n")
    seen: dict = {}

    class FakeProc:
        pid = 4242

    def fake_popen(cmd, **kwargs):
        seen["cmd"] = cmd
        return FakeProc()

    monkeypatch.setattr("cv_mcp.pipeline.subprocess.Popen", fake_popen)
    result = _start_engine(repo, "2026-09-elevenlabs", "grok", None)
    log = tmp_path / "applications" / "2026-09-elevenlabs" / "engine.log"
    assert log.is_file()
    assert result["pid"] == 4242
    assert str(log.relative_to(tmp_path)) == result["log"]
    script = seen["cmd"][2]
    assert seen["cmd"][:2] == ["bash", "-c"]
    assert "TARGET=both" in script
    assert "make tailor" in script
    assert "make app" in script


def test_start_engine_rejects_unsafe_name(tmp_path: Path) -> None:
    repo = CvRepo(tmp_path, engine_root=tmp_path / "engine")
    with pytest.raises(ValueError, match="invalid application name"):
        _start_engine(repo, "..", "grok", None)

def test_server_registers_expected_tools() -> None:
    pytest.importorskip("mcp")
    from cv_mcp.server import mcp

    names = {t.name for t in mcp._tool_manager.list_tools()}
    assert names >= {
        "cv_qualify_job",
        "cv_ingest_job",
        "cv_run_pipeline",
        "cv_list_applications",
        "cv_get_application",
        "cv_set_status",
        "cv_list_followups",
        "cv_draft_followup",
        "cv_draft_application",
    }
    dumped = json.dumps(sorted(names))
    assert "linkedin_scrape" not in dumped
    assert "send_email" not in dumped
