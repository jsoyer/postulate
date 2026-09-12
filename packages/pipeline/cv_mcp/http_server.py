"""Streamable-HTTP front for Grok Bot (and any remote MCP client).

Binds localhost by default. Grok Bot cannot reach stdio; put a HTTPS tunnel
in front and pass Authorization: Bearer $MCP_TOKEN.
"""

from __future__ import annotations

import hmac
import os
import sys
from pathlib import Path

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from cv_mcp.pipeline import consumer_root

REPO_ROOT = consumer_root()
MIN_TOKEN_LEN = 16


def load_dotenv(root: Path | None = None) -> None:
    path = (root or REPO_ROOT) / ".env"
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip("'").strip('"')
        if key:
            os.environ.setdefault(key, value)


def bearer_ok(authorization: str | None, token: str) -> bool:
    if not authorization or not token:
        return False
    scheme, _, value = authorization.partition(" ")
    if scheme.lower() != "bearer" or not value:
        return False
    left = value.encode("utf-8")
    right = token.encode("utf-8")
    if len(left) != len(right):
        return False
    return hmac.compare_digest(left, right)


class BearerMiddleware(BaseHTTPMiddleware):
    """Reject every path except /health unless Authorization matches MCP_TOKEN."""

    def __init__(self, app, token: str):
        super().__init__(app)
        self.token = token

    async def dispatch(self, request: Request, call_next) -> Response:
        if request.url.path in {"/health", "/health/"}:
            return await call_next(request)
        if not bearer_ok(request.headers.get("authorization"), self.token):
            return JSONResponse({"ok": False, "error": "unauthorized"}, status_code=401)
        return await call_next(request)


async def health(_request: Request) -> JSONResponse:
    return JSONResponse({"ok": True, "service": "cv_mcp"})


def require_token() -> str:
    token = (os.environ.get("MCP_TOKEN") or "").strip()
    if len(token) < MIN_TOKEN_LEN:
        print(
            f"MCP_TOKEN missing or shorter than {MIN_TOKEN_LEN} chars. "
            "Set it in .env before `make mcp-http`.",
            file=sys.stderr,
        )
        raise SystemExit(2)
    return token


def serve_http(host: str, port: int, token: str) -> None:
    import uvicorn
    from starlette.routing import Route

    from cv_mcp.server import mcp

    mcp.settings.host = host
    mcp.settings.port = port
    mcp.settings.stateless_http = True
    mcp.settings.transport_security.enable_dns_rebinding_protection = False

    app = mcp.streamable_http_app()
    app.router.routes.insert(0, Route("/health", health, methods=["GET"]))
    app.add_middleware(BearerMiddleware, token=token)

    if host not in {"127.0.0.1", "localhost", "::1"}:
        print(
            f"warning: binding {host!r} (not loopback). Prefer 127.0.0.1 + a tunnel.",
            file=sys.stderr,
        )
    print(
        f"cv_mcp streamable-http http://{host}:{port}/mcp  (Bearer required, /health open)",
        flush=True,
    )
    uvicorn.run(app, host=host, port=port, timeout_keep_alive=300)


def main() -> None:
    load_dotenv()
    token = require_token()
    host = (os.environ.get("MCP_HOST") or "127.0.0.1").strip()
    port = int(os.environ.get("MCP_PORT") or "8765")
    serve_http(host, port, token)


if __name__ == "__main__":
    main()
