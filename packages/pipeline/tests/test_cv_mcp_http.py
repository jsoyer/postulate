"""Tests for cv_mcp streamable-HTTP auth (Grok Bot transport)."""

from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest
from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.responses import PlainTextResponse
from starlette.routing import Route
from starlette.testclient import TestClient

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from cv_mcp.http_server import (  # noqa: E402
    BearerMiddleware,
    bearer_ok,
    health,
    load_dotenv,
    require_token,
)

TOKEN = "a" * 16


def test_bearer_ok_accepts_exact_match() -> None:
    assert bearer_ok(f"Bearer {TOKEN}", TOKEN) is True


def test_bearer_ok_rejects_wrong_and_missing() -> None:
    assert bearer_ok(f"Bearer {TOKEN}x", TOKEN) is False
    assert bearer_ok("Bearer ", TOKEN) is False
    assert bearer_ok(None, TOKEN) is False
    assert bearer_ok(f"Basic {TOKEN}", TOKEN) is False


def test_middleware_rejects_without_token() -> None:
    app = _app()
    client = TestClient(app)
    assert client.get("/ping").status_code == 401
    assert client.get("/ping", headers={"Authorization": f"Bearer {TOKEN}"}).status_code == 200
    assert client.get("/health").json() == {"ok": True, "service": "cv_mcp"}


def test_require_token_exits_when_missing(monkeypatch) -> None:
    monkeypatch.delenv("MCP_TOKEN", raising=False)
    with pytest.raises(SystemExit) as exc:
        require_token()
    assert exc.value.code == 2


def test_require_token_exits_when_short(monkeypatch) -> None:
    monkeypatch.setenv("MCP_TOKEN", "short")
    with pytest.raises(SystemExit) as exc:
        require_token()
    assert exc.value.code == 2


def test_load_dotenv_does_not_override(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("MCP_TOKEN", "already-set-token-ok")
    (tmp_path / ".env").write_text("MCP_TOKEN=from-file-should-lose\n", encoding="utf-8")
    load_dotenv(tmp_path)
    assert os.environ["MCP_TOKEN"] == "already-set-token-ok"


def _app() -> Starlette:
    async def ping(_request):
        return PlainTextResponse("pong")

    async def health_route(_request):
        return await health(_request)

    return Starlette(
        routes=[
            Route("/health", health_route, methods=["GET"]),
            Route("/ping", ping, methods=["GET"]),
        ],
        middleware=[Middleware(BearerMiddleware, token=TOKEN)],
    )
