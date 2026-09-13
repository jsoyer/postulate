"""File-system + make wrappers used by the CV MCP server."""

from __future__ import annotations

import os
import re
import shlex
import subprocess
import sys
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

import yaml

from cv_mcp import tracker as tracker_mod

STATUS_OUTCOME = {
    "Draft": "draft",
    "Tailoring": "tailoring",
    "Applied": "applied",
    "Interview": "interview",
    "Offer": "offer",
    "Rejected": "rejected",
    "Ghosted": "ghosted",
}
OUTCOME_STATUS = {value: key for key, value in STATUS_OUTCOME.items()}

ENGINE_ROOT = Path(__file__).resolve().parent.parent


def consumer_root() -> Path:
    out = (os.environ.get("OUT_DIR") or "").strip()
    if out:
        return Path(out)
    data = (os.environ.get("DATA_DIR") or "").strip()
    if data:
        path = Path(data)
        return path.parent if path.name == "data" else path
    cwd = Path.cwd()
    if (cwd / "data" / "cv.yml").is_file():
        return cwd
    return cwd


@dataclass
class CvRepo:
    root: Path
    engine_root: Path | None = None

    @classmethod
    def from_env(cls) -> CvRepo:
        return cls(consumer_root())

    @property
    def apps(self) -> Path:
        env = (os.environ.get("APP_DIR") or "").strip()
        return Path(env) if env else self.root / "applications"

    @property
    def tracker(self) -> Path:
        env = (os.environ.get("TRACKER_DIR") or "").strip()
        return Path(env) if env else self.root / "tracker"

    @property
    def data(self) -> Path:
        env = (os.environ.get("DATA_DIR") or "").strip()
        return Path(env) if env else self.root / "data"

    @property
    def engine(self) -> Path:
        if self.engine_root is not None:
            return self.engine_root
        env = (os.environ.get("ENGINE_DIR") or "").strip()
        return Path(env) if env else ENGINE_ROOT

    @property
    def preferences_path(self) -> Path:
        return self.data / "preferences.yml"

    @property
    def drive_dir(self) -> Path | None:
        env = (os.environ.get("DRIVE_DIR") or "").strip()
        return Path(env) if env else None


def slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", (text or "").lower())
    return slug.strip("-") or "company"


def application_name(company: str, when: date | None = None) -> str:
    day = when or date.today()
    return f"{day:%Y-%m}-{slugify(company)}"


def load_preferences(repo: CvRepo) -> dict[str, Any]:
    path = repo.preferences_path
    if not path.is_file():
        return {}
    loaded = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    return loaded if isinstance(loaded, dict) else {}


def engine_available(repo: CvRepo) -> bool:
    return (repo.engine / "Makefile").is_file()


def _read_yaml(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return {}
    loaded = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    return loaded if isinstance(loaded, dict) else {}


def _write_yaml(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        yaml.safe_dump(data, allow_unicode=True, sort_keys=False),
        encoding="utf-8",
    )


def ingest_job(
    repo: CvRepo,
    company: str,
    position: str,
    url: str | None = None,
    job_text: str | None = None,
    when: date | None = None,
) -> dict[str, Any]:
    name = application_name(company, when=when)
    app_dir = repo.apps / name
    existed = app_dir.is_dir() and (app_dir / "meta.yml").is_file()
    app_dir.mkdir(parents=True, exist_ok=True)
    if job_text:
        (app_dir / "job.txt").write_text(job_text.strip() + "\n", encoding="utf-8")
    if url:
        (app_dir / "job.url").write_text(url.strip() + "\n", encoding="utf-8")
    meta = _read_yaml(app_dir / "meta.yml")
    meta.update(
        {
            "company": company,
            "position": position,
            "created": (when or date.today()).strftime("%Y-%m"),
        }
    )
    if "outcome" not in meta:
        meta["outcome"] = "draft"
    _write_yaml(app_dir / "meta.yml", meta)
    _upsert_tracker(repo, name, meta, status=OUTCOME_STATUS.get(meta.get("outcome", "draft"), "Draft"), url=url)
    return {
        "name": name,
        "folder": str(app_dir.relative_to(repo.root)),
        "deduped": existed,
        "company": company,
        "position": position,
    }


def _upsert_tracker(
    repo: CvRepo,
    name: str,
    meta: dict[str, Any],
    status: str,
    url: str | None = None,
    pr: str | None = None,
) -> Path:
    props = {
        "type": "application",
        "company": meta.get("company"),
        "position": meta.get("position"),
        "status": status,
        "created": meta.get("created"),
        "applied": meta.get("applied"),
        "deadline": meta.get("deadline"),
        "job_url": url or _job_url(repo.apps / name),
        "folder": f"applications/{name}",
        "branch": f"apply/{name}",
        "pr": pr,
        "tags": ["application"],
    }
    path = tracker_mod.upsert_note(
        repo.tracker,
        name,
        props,
        extra_body=tracker_mod.default_body(props),
    )
    tracker_mod.write_index(repo.tracker)
    return path


def _job_url(app_dir: Path) -> str | None:
    path = app_dir / "job.url"
    if not path.is_file():
        return None
    lines = path.read_text(encoding="utf-8").strip().splitlines()
    return lines[0].strip() if lines else None


def _job_text(app_dir: Path) -> str:
    path = app_dir / "job.txt"
    if not path.is_file():
        return ""
    return path.read_text(encoding="utf-8")


def list_applications(repo: CvRepo) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    if not repo.apps.is_dir():
        return rows
    for app_dir in sorted(p for p in repo.apps.iterdir() if p.is_dir()):
        meta = _read_yaml(app_dir / "meta.yml")
        if not meta:
            continue
        outcome = str(meta.get("outcome") or "draft")
        rows.append(
            {
                "name": app_dir.name,
                "company": meta.get("company") or app_dir.name,
                "position": meta.get("position") or "",
                "status": OUTCOME_STATUS.get(outcome, outcome.title()),
                "applied": meta.get("applied") or "",
                "job_url": _job_url(app_dir),
            }
        )
    return rows


def get_application(repo: CvRepo, name: str) -> dict[str, Any]:
    app_dir = repo.apps / Path(name).name
    if not app_dir.is_dir():
        raise FileNotFoundError(
            f"Unknown application {name!r}. Use cv_list_applications."
        )
    meta = _read_yaml(app_dir / "meta.yml")
    pdfs = sorted(str(p.relative_to(repo.root)) for p in app_dir.glob("*.pdf"))
    return {
        "name": app_dir.name,
        "folder": str(app_dir.relative_to(repo.root)),
        "company": meta.get("company"),
        "position": meta.get("position"),
        "status": OUTCOME_STATUS.get(str(meta.get("outcome") or "draft"), "Draft"),
        "meta": meta,
        "job_url": _job_url(app_dir),
        "job_text": _job_text(app_dir),
        "pdfs": pdfs,
        "has_tailored_cv": (app_dir / "cv-tailored.yml").is_file(),
        "has_cover_letter": (app_dir / "coverletter.yml").is_file(),
    }


def set_status(
    repo: CvRepo,
    name: str,
    status: str,
    applied: str | None = None,
) -> dict[str, Any]:
    app_dir = repo.apps / Path(name).name
    if not (app_dir / "meta.yml").is_file():
        raise FileNotFoundError(f"Unknown application {name!r}.")
    canonical = status.strip().title()
    if canonical not in STATUS_OUTCOME:
        allowed = ", ".join(STATUS_OUTCOME)
        raise ValueError(f"Unknown status {status!r}. Use one of: {allowed}")
    meta = _read_yaml(app_dir / "meta.yml")
    meta["outcome"] = STATUS_OUTCOME[canonical]
    if applied:
        meta["applied"] = applied
    elif canonical == "Applied" and not meta.get("applied"):
        meta["applied"] = date.today().isoformat()
    _write_yaml(app_dir / "meta.yml", meta)
    _upsert_tracker(repo, app_dir.name, meta, status=canonical)
    return {
        "name": app_dir.name,
        "status": canonical,
        "applied": meta.get("applied"),
        "company": meta.get("company"),
    }


def _parse_day(value: Any) -> date | None:
    if not value:
        return None
    text = str(value).strip()
    for fmt in ("%Y-%m-%d", "%Y-%m"):
        try:
            parsed = datetime.strptime(text, fmt).date()
            if fmt == "%Y-%m":
                return parsed.replace(day=1)
            return parsed
        except ValueError:
            continue
    return None


def list_followups(repo: CvRepo, older_than_days: int = 7) -> list[dict[str, Any]]:
    cutoff = date.today() - timedelta(days=older_than_days)
    stale: list[dict[str, Any]] = []
    for row in list_applications(repo):
        if row["status"] not in {"Applied", "Ghosted"}:
            continue
        applied = _parse_day(row.get("applied"))
        if applied and applied <= cutoff:
            stale.append({**row, "days_since": (date.today() - applied).days})
    return stale


def _plain(text: str) -> str:
    cleaned = re.sub(r"\*\*(.+?)\*\*", r"\1", text or "")
    cleaned = re.sub(r"[ \t]+\n", "\n", cleaned)
    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
    return cleaned.strip()


def _signer(repo: CvRepo) -> str:
    personal = _read_yaml(repo.data / "cv.yml").get("personal") or {}
    first = str(personal.get("first_name") or "").strip()
    last = str(personal.get("last_name") or "").strip()
    return " ".join(part for part in (first, last) if part)


def _draft_meta(
    name: str,
    company: str,
    position: str,
    subject: str,
    body: str,
    attachments: list[str],
) -> dict[str, Any]:
    return {
        "name": name,
        "company": company,
        "position": position,
        "subject": subject,
        "body": body,
        "attachments": attachments,
        "send": False,
        "draft_only": True,
        "instruction": (
            "Create a Gmail DRAFT with this subject, body, and attachments. "
            "Do not send. Wait for the user to send."
        ),
    }


def _attachment_paths(repo: CvRepo, name: str) -> list[str]:
    app_dir = repo.apps / Path(name).name
    if not app_dir.is_dir():
        return []
    return sorted(str(path.resolve()) for path in app_dir.glob("*.pdf"))


def draft_followup(repo: CvRepo, name: str) -> dict[str, Any]:
    app = get_application(repo, name)
    company = str(app.get("company") or name)
    position = str(app.get("position") or "the role")
    subject = f"Follow-up — {company} ({position})"
    body = (
        f"Hi,\n\n"
        f"I wanted to follow up on my application for {position} at {company}. "
        f"I'm still very interested and happy to share anything that would help "
        f"the team.\n\nBest regards\n"
    )
    signer = _signer(repo)
    if signer:
        body = body.rstrip() + f"\n{signer}\n"
    return _draft_meta(
        name=name,
        company=company,
        position=position,
        subject=subject,
        body=body,
        attachments=_attachment_paths(repo, name),
    )


def draft_application(repo: CvRepo, name: str) -> dict[str, Any]:
    """Build the first-contact application email from coverletter.yml.

    Never sends. Caller (Grokbot) must create a Gmail draft only.
    """
    app = get_application(repo, name)
    company = str(app.get("company") or name)
    position = str(app.get("position") or "the role")
    letter = _read_yaml(repo.apps / Path(name).name / "coverletter.yml")
    recipient = letter.get("recipient") if isinstance(letter.get("recipient"), dict) else {}
    greeting = letter.get("opening") or (
        f"Dear {recipient.get('name') or 'Hiring Manager'},"
    )
    closing = letter.get("closing") or "Best regards,"
    title = letter.get("title")
    subject = _plain(str(title)) if title else f"Application — {position} at {company}"

    paragraphs: list[str] = []
    for section in letter.get("sections") or []:
        if isinstance(section, dict) and section.get("content"):
            paragraphs.append(_plain(str(section["content"])))
    if letter.get("closing_paragraph"):
        paragraphs.append(_plain(str(letter["closing_paragraph"])))
    if not paragraphs:
        paragraphs.append(
            f"Please find attached my application for {position} at {company}."
        )

    signer = _signer(repo)
    signoff = f"{_plain(str(closing))}\n{signer}" if signer else _plain(str(closing))
    body = f"{_plain(str(greeting))}\n\n" + "\n\n".join(paragraphs) + f"\n\n{signoff}\n"
    payload = _draft_meta(
        name=name,
        company=company,
        position=position,
        subject=subject,
        body=body,
        attachments=_attachment_paths(repo, name),
    )
    payload["source"] = "coverletter.yml" if letter else "fallback"
    payload["has_cover_letter"] = bool(app.get("has_cover_letter"))
    return payload



def _make_env(repo: CvRepo | None = None) -> dict[str, str]:
    env = os.environ.copy()
    extras = [
        str(Path.home() / ".local" / "bin"),
        str(Path.home() / ".npm-global" / "bin"),
        "/home/linuxbrew/.linuxbrew/bin",
    ]
    path = env.get("PATH", "")
    prefix = [p for p in extras if p and p not in path.split(":")]
    if prefix:
        env["PATH"] = ":".join(prefix + [path]) if path else ":".join(prefix)
    if repo is not None:
        env["DATA_DIR"] = str(repo.data)
        env["APP_DIR"] = str(repo.apps)
        env["OUT_DIR"] = str(repo.root)
        if repo.drive_dir is not None:
            env["DRIVE_DIR"] = str(repo.drive_dir)
    return env


def _contract_args(repo: CvRepo) -> list[str]:
    return [
        f"DATA_DIR={repo.data}",
        f"APP_DIR={repo.apps}",
        f"OUT_DIR={repo.root}",
        f"AWESOME_CV_DIR={repo.engine / 'awesome-cv'}",
        f"PYTHON={sys.executable}",
    ]


def _run_make(repo: CvRepo, args: list[str], timeout: int) -> dict[str, Any]:
    proc = subprocess.run(
        ["make", *args, *_contract_args(repo)],
        cwd=repo.engine,
        capture_output=True,
        text=True,
        timeout=timeout,
        check=False,
        env=_make_env(repo),
    )
    return {
        "args": args,
        "returncode": proc.returncode,
        "stdout": (proc.stdout or "")[-2000:],
        "stderr": (proc.stderr or "")[-2000:],
    }


def _start_engine(repo: CvRepo, name: str, ai: str, model: str | None) -> dict[str, Any]:
    """Kick tailor+build in the background. Cloudflare/Grok Bot cannot wait 3 min."""
    safe = Path(name).name
    if not safe or safe in {".", ".."}:
        raise ValueError(f"invalid application name: {name!r}")
    log_path = repo.apps / safe / "engine.log"
    log_path.parent.mkdir(parents=True, exist_ok=True)
    extra = _contract_args(repo)
    tailor = ["make", "tailor", f"NAME={safe}", f"AI={ai}"]
    if model:
        tailor.append(f"MODEL={model}")
    tailor.extend(extra)
    build = ["make", "app", f"NAME={safe}", *extra]
    script = f"{shlex.join(tailor)} && {shlex.join(build)}"
    with log_path.open("ab") as log:
        proc = subprocess.Popen(
            ["bash", "-lc", script],
            cwd=str(repo.engine),
            stdout=log,
            stderr=subprocess.STDOUT,
            start_new_session=True,
            env=_make_env(repo),
        )
    try:
        rel = str(log_path.relative_to(repo.root))
    except ValueError:
        rel = str(log_path)
    return {"pid": proc.pid, "log": rel}


def deposit_pdfs(repo: CvRepo, name: str) -> list[str]:
    app_dir = repo.apps / Path(name).name
    script = ENGINE_ROOT / "scripts" / "drive_deposit.py"
    extra: list[str] = []
    if repo.drive_dir is not None and not (os.environ.get("RCLONE_REMOTE") or "").strip():
        extra = [str(repo.drive_dir)]
    proc = subprocess.run(
        [sys.executable, str(script), str(app_dir), *extra],
        capture_output=True,
        text=True,
        check=False,
        env=_make_env(repo),
    )
    if proc.returncode != 0:
        err = (proc.stderr or proc.stdout or "").strip()[-800:]
        raise RuntimeError(f"drive_deposit failed: {err}")
    lines = [ln.strip() for ln in (proc.stdout or "").splitlines() if ln.startswith("  ")]
    return [ln.strip() for ln in lines]


def run_pipeline(
    repo: CvRepo,
    company: str,
    position: str,
    url: str | None = None,
    job_text: str | None = None,
    confirm: bool = False,
    force: bool = False,
    ai: str = "gemini",
    model: str | None = None,
    preferences: dict[str, Any] | None = None,
    when: date | None = None,
    wait: bool = False,
) -> dict[str, Any]:
    """Qualify, then (if confirm) scaffold + tailor + render + tracker.

    Does not send mail, open a GitHub PR, or scrape LinkedIn.
    """
    from cv_mcp.qualify import qualify_job

    text = (job_text or "").strip()
    prefs = preferences if preferences is not None else load_preferences(repo)
    qualification = qualify_job(text, prefs) if text else {
        "score": 50,
        "recommendation": "review",
        "reasons": ["no_job_text"],
    }
    name = application_name(company, when=when)
    plan = [
        f"scaffold applications/{name}/ (job.txt, meta.yml)",
        "write Obsidian tracker note (Draft)",
        f"make tailor NAME={name} AI={ai}" if engine_available(repo) else "SKIP tailor (engine missing)",
        f"make app NAME={name}" if engine_available(repo) else "SKIP PDF render (engine missing)",
    ]
    if qualification["recommendation"] == "skip" and not force:
        return {
            "ok": False,
            "name": name,
            "recommendation": "skip",
            "qualification": qualification,
            "needs_confirm": False,
            "error": "Job looks like a skip. Pass force=true to run anyway.",
        }
    if not confirm:
        return {
            "ok": False,
            "name": name,
            "needs_confirm": True,
            "recommendation": qualification["recommendation"],
            "qualification": qualification,
            "plan": plan,
            "error": "Pass confirm=true to start the pipeline (after you or the agent decide the job is a fit).",
        }
    ingested = ingest_job(
        repo,
        company=company,
        position=position,
        url=url,
        job_text=job_text,
        when=when,
    )
    steps: list[dict[str, Any]] = [{"ingest": ingested}]
    ran_engine = False
    engine_started = False
    if engine_available(repo):
        if wait:
            tailor_args = ["tailor", f"NAME={ingested['name']}", f"AI={ai}"]
            if model:
                tailor_args.append(f"MODEL={model}")
            tailor = _run_make(repo, tailor_args, timeout=300)
            steps.append({"tailor": tailor})
            build = _run_make(repo, ["app", f"NAME={ingested['name']}"], timeout=180)
            steps.append({"build": build})
            ran_engine = tailor["returncode"] == 0 or build["returncode"] == 0
        else:
            started = _start_engine(repo, ingested["name"], ai, model)
            steps.append({"engine": started})
            engine_started = True
    app = get_application(repo, ingested["name"])
    driven = deposit_pdfs(repo, ingested["name"]) if app["pdfs"] else []
    if ran_engine and app["pdfs"]:
        nxt = (
            "Review the PDFs. Call cv_draft_application, then create a Gmail "
            "DRAFT only (do not send). After the user sends, "
            "cv_set_status(status='Applied')."
        )
        if driven:
            nxt += f" Copied to Drive: {driven[0]}"
    elif engine_started:
        nxt = (
            "Tailor started in the background (CLI subscription if logged in). "
            "Poll cv_get_application until has_tailored_cv is true, then "
            "cv_draft_application. Gmail DRAFT only — do not send."
        )
    elif engine_available(repo):
        nxt = "Engine ran but no PDFs were found. Check make tailor / make app output in steps."
    else:
        nxt = (
            "Engine Makefile missing next to cv_mcp. "
            "Folder and tracker note are already created."
        )
    return {
        "ok": True,
        "name": ingested["name"],
        "recommendation": qualification["recommendation"],
        "qualification": qualification,
        "engine_ran": ran_engine,
        "engine_started": engine_started,
        "pdfs": app["pdfs"],
        "drive_pdfs": driven,
        "folder": app["folder"],
        "tracker": f"tracker/{ingested['name']}.md",
        "steps": steps,
        "next": nxt,
    }
