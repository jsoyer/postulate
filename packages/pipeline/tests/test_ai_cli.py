"""Unit tests for scripts/lib/ai_cli.py — no live CLI calls."""

from __future__ import annotations

import subprocess
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from lib.ai_cli import (
    HARNESS_BINARIES,
    call_cli,
    canonical_provider,
    cli_available,
    cli_spec_for,
)


def test_harnesses_are_not_backends() -> None:
    assert "omp" in HARNESS_BINARIES
    assert "pi" in HARNESS_BINARIES
    assert "opencode" not in HARNESS_BINARIES
    assert cli_spec_for("omp") is None
    assert cli_spec_for("pi") is None
    assert cli_spec_for("opencode") is not None


def test_aliases() -> None:
    assert canonical_provider("xai") == "grok"
    assert canonical_provider("cursor-agent") == "cursor"
    assert canonical_provider("chatgpt") == "openai"
    assert canonical_provider("gemini") == "antigravity"
    assert canonical_provider("agy") == "antigravity"
    assert cli_spec_for("openai") is not None
    assert cli_spec_for("chatgpt").binary == "codex"
    assert cli_spec_for("gemini").binary == "agy"
    assert cli_spec_for("antigravity").binary == "agy"


def test_cli_available_uses_which() -> None:
    assert cli_available("grok", which=lambda name: "/usr/bin/grok" if name == "grok" else None)
    assert not cli_available("grok", which=lambda _name: None)
    assert not cli_available("mistral", which=lambda _name: "/bin/true")


def test_call_cli_runs_in_isolation() -> None:
    seen: dict[str, object] = {}

    def fake_run(cmd, **kwargs):  # noqa: ANN003
        seen["cmd"] = cmd
        seen["cwd"] = kwargs.get("cwd")
        seen["input"] = kwargs.get("input")
        return subprocess.CompletedProcess(cmd, 0, stdout="YAML_OK\n", stderr="")

    text = call_cli(
        "grok",
        "write a cover letter",
        runner=fake_run,
        which=lambda name: "/opt/grok" if name == "grok" else None,
    )
    assert text == "YAML_OK"
    cmd = seen["cmd"]
    assert cmd[0] == "/opt/grok"
    assert "--prompt-file" in cmd
    assert "--max-turns" in cmd
    assert "--reasoning-effort" in cmd
    assert cmd[cmd.index("--reasoning-effort") + 1] == "high"
    assert "-m" in cmd
    assert cmd[cmd.index("-m") + 1] == "grok-4.6"
    assert seen["cwd"]
    assert not Path(str(seen["cwd"])).exists()  # cleaned up


def test_call_cli_rejects_missing_binary() -> None:
    with pytest.raises(RuntimeError, match="not found"):
        call_cli("cursor", "hello", which=lambda _name: None)


def test_call_cli_nonzero_exit() -> None:
    def fake_run(cmd, **kwargs):  # noqa: ANN003
        return subprocess.CompletedProcess(cmd, 2, stdout="", stderr="login required")

    with pytest.raises(RuntimeError, match="exit 2"):
        call_cli(
            "claude",
            "hello",
            runner=fake_run,
            which=lambda name: "/opt/claude" if name == "claude" else None,
        )

def test_opencode_argv_includes_model() -> None:
    seen: dict[str, object] = {}

    def fake_run(cmd, **kwargs):  # noqa: ANN003
        seen["cmd"] = cmd
        return subprocess.CompletedProcess(cmd, 0, stdout='{"parts":[{"type":"text","text":"ok"}]}', stderr="")

    call_cli(
        "opencode",
        "hello",
        model="openai/gpt-5.4",
        runner=fake_run,
        which=lambda name: "/opt/opencode" if name == "opencode" else None,
    )
    cmd = seen["cmd"]
    assert cmd[0] == "/opt/opencode"
    assert "run" in cmd
    assert "-m" in cmd
    assert "openai/gpt-5.4" in cmd

