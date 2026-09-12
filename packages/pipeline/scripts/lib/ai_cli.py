"""Subscription CLI backends for call_ai (OAuth lives in the CLI, not here).

Hybrid rule: API key first, else a logged-in CLI in print/ask mode.
Never spawn repo-driving harnesses (omp, pi) as tailor backends.
OpenCode is allowed: HTTP API (`OPENCODE_URL`) or `opencode run -m provider/model`.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

# Harnesses: they drive a repo (tools, MCP, TUI). Not tailor backends.
HARNESS_BINARIES = frozenset({"omp", "pi"})

ArgvBuilder = Callable[[str, Path, str | None], list[str]]


def _grok_argv(binary: str, prompt_file: Path, model: str | None) -> list[str]:
    cmd = [
        binary,
        "--prompt-file",
        str(prompt_file),
        "--verbatim",
        "--max-turns",
        "8",
        "--disable-web-search",
        "--output-format",
        "plain",
    ]
    if model:
        cmd.extend(["-m", model])
    return cmd


def _claude_argv(binary: str, prompt_file: Path, model: str | None) -> list[str]:
    prompt = prompt_file.read_text(encoding="utf-8")
    cmd = [
        binary,
        "-p",
        prompt,
        "--bare",
        "--output-format",
        "text",
        "--permission-mode",
        "plan",
    ]
    if model:
        cmd.extend(["--model", model])
    return cmd


def _gemini_argv(binary: str, prompt_file: Path, model: str | None) -> list[str]:
    prompt = prompt_file.read_text(encoding="utf-8")
    cmd = [binary, "-p", prompt, "--approval-mode", "plan", "-o", "text"]
    if model:
        cmd.extend(["-m", model])
    return cmd


def _cursor_argv(binary: str, prompt_file: Path, model: str | None) -> list[str]:
    prompt = prompt_file.read_text(encoding="utf-8")
    cmd = [binary, "-p", "--mode", "ask", "--output-format", "text"]
    if model:
        cmd.extend(["--model", model])
    cmd.append(prompt)
    return cmd


def _codex_argv(binary: str, prompt_file: Path, model: str | None) -> list[str]:
    prompt = prompt_file.read_text(encoding="utf-8")
    cmd = [binary, "exec", "--skip-git-repo-check", "-"]
    if model:
        cmd.extend(["-m", model])
    return cmd


def _opencode_argv(binary: str, prompt_file: Path, model: str | None) -> list[str]:
    prompt = prompt_file.read_text(encoding="utf-8")
    cmd = [binary, "run", "--format", "json", "--pure", "--dir", str(prompt_file.parent)]
    chosen = model or os.environ.get("OPENCODE_MODEL")
    if chosen:
        cmd.extend(["-m", chosen])
    attach = os.environ.get("OPENCODE_URL")
    if attach:
        cmd.extend(["--attach", attach])
    cmd.append(prompt)
    return cmd


@dataclass(frozen=True)
class CliSpec:
    binary: str
    argv: ArgvBuilder
    aliases: tuple[str, ...] = ()
    stdin_prompt: bool = False


CLI_SPECS: dict[str, CliSpec] = {
    "grok": CliSpec(binary="grok", argv=_grok_argv, aliases=("xai",)),
    "claude": CliSpec(binary="claude", argv=_claude_argv),
    "gemini": CliSpec(binary="gemini", argv=_gemini_argv),
    "cursor": CliSpec(
        binary="cursor-agent",
        argv=_cursor_argv,
        aliases=("cursor-agent",),
    ),
    "codex": CliSpec(binary="codex", argv=_codex_argv, stdin_prompt=True),
    "opencode": CliSpec(binary="opencode", argv=_opencode_argv),
}

# openai/chatgpt have no native CLI; Codex is the ChatGPT subscription fallback.
CLI_FALLBACK: dict[str, str] = {
    "openai": "codex",
}

PROVIDER_ALIASES: dict[str, str] = {}
for _name, _spec in CLI_SPECS.items():
    for _alias in _spec.aliases:
        PROVIDER_ALIASES[_alias] = _name
PROVIDER_ALIASES["chatgpt"] = "openai"
PROVIDER_ALIASES["gpt"] = "openai"


def canonical_provider(provider: str) -> str:
    return PROVIDER_ALIASES.get(provider, provider)


def cli_spec_for(provider: str) -> CliSpec | None:
    name = canonical_provider(provider)
    name = CLI_FALLBACK.get(name, name)
    return CLI_SPECS.get(name)


def cli_available(provider: str, *, which: Callable[[str], str | None] | None = None) -> bool:
    spec = cli_spec_for(provider)
    if spec is None:
        return False
    if spec.binary in HARNESS_BINARIES:
        return False
    finder = which or shutil.which
    return finder(spec.binary) is not None


def call_cli(
    provider: str,
    prompt: str,
    *,
    model: str | None = None,
    timeout: int = 300,
    runner: Callable[..., subprocess.CompletedProcess[str]] | None = None,
    which: Callable[[str], str | None] | None = None,
) -> str:
    """Run a logged-in CLI in an empty temp dir (no CV repo tools)."""
    spec = cli_spec_for(provider)
    if spec is None:
        raise ValueError(f"No CLI backend for {provider!r}")
    if spec.binary in HARNESS_BINARIES:
        raise ValueError(f"{spec.binary} is a harness, not a tailor backend")
    finder = which or shutil.which
    binary = finder(spec.binary)
    if not binary:
        raise RuntimeError(
            f"{spec.binary} CLI not found on PATH. Log in once (`{spec.binary} login`) "
            "or set the API key instead."
        )
    tmp = Path(tempfile.mkdtemp(prefix="cv-ai-cli-"))
    prompt_file = tmp / "prompt.txt"
    try:
        prompt_file.write_text(prompt, encoding="utf-8")
        cmd = spec.argv(binary, prompt_file, model)
        run = runner or subprocess.run
        proc = run(
            cmd,
            cwd=str(tmp),
            capture_output=True,
            text=True,
            timeout=timeout,
            input=prompt if spec.stdin_prompt else None,
            env=os.environ.copy(),
            check=False,
        )
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    if proc.returncode != 0:
        err = (proc.stderr or proc.stdout or "").strip()[-1500:]
        raise RuntimeError(f"{spec.binary} CLI failed (exit {proc.returncode}): {err}")
    text = (proc.stdout or "").strip()
    if not text:
        raise RuntimeError(f"{spec.binary} CLI returned empty stdout")
    return text
