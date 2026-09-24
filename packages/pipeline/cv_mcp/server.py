#!/usr/bin/env python3
"""cv_mcp — local MCP server for the CV apply pipeline.

Connect this server to Grok, Claude Code, or any MCP client. The agent
qualifies a job; when the posting looks like a fit (or you confirm), it
calls cv_run_pipeline(confirm=true) which scaffolds the application,
tailors CV + cover letter, renders PDFs, and writes the Obsidian tracker.

This server never scrapes LinkedIn, never sends email, and never opens a
GitHub PR. Pair it with Gmail/GitHub MCPs for those.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from mcp.server.fastmcp import FastMCP
from pydantic import BaseModel, ConfigDict, Field

from cv_mcp.pipeline import (
    CvRepo,
    consumer_root,
    draft_application,
    draft_followup,
    get_application,
    ingest_job,
    list_applications,
    list_followups,
    load_preferences,
    run_pipeline,
    set_status,
)
from cv_mcp.qualify import qualify_job

REPO_ROOT = consumer_root()
mcp = FastMCP("cv_mcp")


def _repo() -> CvRepo:
    return CvRepo.from_env()


def _json(data: Any) -> str:
    return json.dumps(data, indent=2, ensure_ascii=False, default=str)


def _error(exc: Exception) -> str:
    return _json({"ok": False, "error": str(exc)})


class QualifyInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    job_text: str = Field(..., min_length=20, max_length=50000, description="Full job description text")


class IngestInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    company: str = Field(..., min_length=1, max_length=80, description="Company name, e.g. Cloudflare")
    position: str = Field(..., min_length=1, max_length=160, description="Job title")
    url: str | None = Field(default=None, description="Job posting URL if you have one")
    job_text: str | None = Field(default=None, max_length=50000, description="Job description text (preferred over scraping)")


class RunPipelineInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    company: str = Field(..., min_length=1, max_length=80)
    position: str = Field(..., min_length=1, max_length=160)
    url: str | None = Field(default=None, description="Job posting URL")
    job_text: str | None = Field(
        default=None,
        max_length=50000,
        description="Paste the job description. Required for qualify. Do not scrape LinkedIn.",
    )
    confirm: bool = Field(
        default=False,
        description="Must be true to actually run. False returns the plan only.",
    )
    force: bool = Field(default=False, description="Run even if qualify says skip")
    ai: str = Field(
        default="claude",
        description=(
            "Tailor backend. CLI: claude, grok, codex, antigravity (agy). "
            "OpenCode Go: opencode (OPENCODE_URL HTTP). "
            "chatgpt/openai uses Codex CLI."
        ),
    )
    model: str | None = Field(
        default=None,
        description="Optional model id. OpenCode: provider/model e.g. openai/gpt-5.4",
    )
    wait: bool = Field(
        default=False,
        description=(
            "If true, block until tailor+PDFs finish (local stdio only). "
            "False (default): start tailor in background — required for Grok Bot / Cloudflare."
        ),
    )


class GetAppInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    name: str = Field(..., min_length=3, max_length=80, description="Application folder, e.g. 2026-02-anthropic")


class SetStatusInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    name: str = Field(..., min_length=3, max_length=80)
    status: str = Field(..., description="Draft, Tailoring, Applied, Interview, Offer, Rejected, Ghosted")
    applied: str | None = Field(default=None, description="YYYY-MM-DD if marking Applied")


class FollowupsInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    older_than_days: int = Field(default=7, ge=1, le=90)


@mcp.tool(
    name="cv_qualify_job",
    annotations={
        "title": "Qualify a job against preferences",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def cv_qualify_job(params: QualifyInput) -> str:
    """Score a job description against data/preferences.yml.

    Use this first. recommendation=apply means the posting looks like a fit
    ('sympa'); call cv_run_pipeline with confirm=true. recommendation=skip
    means do not apply unless the user overrides with force=true.

    Returns JSON: {score, recommendation, reasons}.
    """
    result = qualify_job(params.job_text, load_preferences(_repo()))
    return _json({"ok": True, **result})


@mcp.tool(
    name="cv_ingest_job",
    annotations={
        "title": "Save a job without running the pipeline",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def cv_ingest_job(params: IngestInput) -> str:
    """Create applications/<YYYY-MM-company>/ with job.txt and meta.yml only.

    Does not tailor or render. Use cv_run_pipeline when you are ready for
    CV + cover letter.
    """
    try:
        return _json({"ok": True, **ingest_job(_repo(), **params.model_dump())})
    except Exception as exc:
        return _error(exc)


@mcp.tool(
    name="cv_run_pipeline",
    annotations={
        "title": "Run the full apply pipeline",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": False,
        "openWorldHint": True,
    },
)
async def cv_run_pipeline(params: RunPipelineInput) -> str:
    """After a job looks like a fit (or the user validates it), produce a tailored CV and cover letter.

    Workflow the connected agent MUST follow:
    1. cv_qualify_job on the job text (paste the description; do not scrape LinkedIn).
    2. If recommendation is apply, or the user says yes, call this tool with confirm=true.
    3. Confirm=false only returns the plan (safe dry-run).
    4. Tailor starts in the background (subscription CLI if logged in). Poll
       cv_get_application until has_tailored_cv, then cv_draft_application.
       Gmail DRAFT only — never send.
    5. After the user sends, cv_set_status(status='Applied').
    6. Later, cv_list_followups + cv_draft_followup (Gmail DRAFT only, never send).

    Tailoring uses a logged-in CLI (claude, grok, chatgpt/codex, gemini) when
    present. Set wait=true only on local stdio.
    """
    try:
        result = run_pipeline(
            _repo(),
            company=params.company,
            position=params.position,
            url=params.url,
            job_text=params.job_text,
            confirm=params.confirm,
            force=params.force,
            ai=params.ai,
            model=params.model,
            wait=params.wait,
        )
        return _json(result)
    except Exception as exc:
        return _error(exc)


@mcp.tool(
    name="cv_list_applications",
    annotations={
        "title": "List applications",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def cv_list_applications() -> str:
    """List tracked applications with status (Draft / Applied / Interview / …)."""
    return _json({"ok": True, "applications": list_applications(_repo())})


@mcp.tool(
    name="cv_get_application",
    annotations={
        "title": "Get one application",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def cv_get_application(params: GetAppInput) -> str:
    """Return meta, job text, PDF paths, and tailor status for one application."""
    try:
        return _json({"ok": True, **get_application(_repo(), params.name)})
    except Exception as exc:
        return _error(exc)


@mcp.tool(
    name="cv_set_status",
    annotations={
        "title": "Update application status",
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def cv_set_status(params: SetStatusInput) -> str:
    """Update meta.yml + the Obsidian tracker note (Applied, Interview, …)."""
    try:
        return _json({"ok": True, **set_status(_repo(), params.name, params.status, applied=params.applied)})
    except Exception as exc:
        return _error(exc)


@mcp.tool(
    name="cv_list_followups",
    annotations={
        "title": "List stale applications",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def cv_list_followups(params: FollowupsInput) -> str:
    """Applications still in Applied/Ghosted older than N days (default 7)."""
    return _json({"ok": True, "followups": list_followups(_repo(), older_than_days=params.older_than_days)})


@mcp.tool(
    name="cv_draft_followup",
    annotations={
        "title": "Draft a follow-up email",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def cv_draft_followup(params: GetAppInput) -> str:
    """Return a follow-up email subject+body. Does not send.

    Grokbot MUST create a Gmail DRAFT only. Never send.
    """
    try:
        return _json({"ok": True, **draft_followup(_repo(), params.name)})
    except Exception as exc:
        return _error(exc)


@mcp.tool(
    name="cv_draft_application",
    annotations={
        "title": "Draft the application email",
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    },
)
async def cv_draft_application(params: GetAppInput) -> str:
    """Return the first-contact application email (subject, body, PDF paths).

    Built from applications/<name>/coverletter.yml. Does not send.
    Grokbot MUST create a Gmail DRAFT only. Never send. Wait for the user.
    """
    try:
        return _json({"ok": True, **draft_application(_repo(), params.name)})
    except Exception as exc:
        return _error(exc)


@mcp.prompt()
def apply_workflow() -> str:
    """How the connected agent should run a job from posting to follow-up."""
    return (
        "You are connected to cv_mcp, the local CV apply pipeline.\n"
        "Never scrape LinkedIn. Never send email. Never open a GitHub PR.\n"
        "Gmail: create a DRAFT only. Do not send. Wait for the user.\n\n"
        "When the user shares a job (URL + pasted description) or you judge it a good fit:\n"
        "1. Call cv_qualify_job with the job text.\n"
        "2. If recommendation is apply, or the user validates, call cv_run_pipeline\n"
        "   with the same company/position/job_text and confirm=true.\n"
        "3. Call cv_draft_application. Create a Gmail DRAFT (subject + body +\n"
        "   PDF attachments). Do not send.\n"
        "4. After the user sends, cv_set_status name=… status=Applied.\n"
        "5. On later turns, cv_list_followups then cv_draft_followup — Gmail DRAFT only.\n"
    )


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
