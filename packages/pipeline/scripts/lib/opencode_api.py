"""OpenCode HTTP API client (`opencode serve`).

Auth: OpenCode's own OAuth/keys (openai oauth on this machine).
Model format: provider/model, e.g. openai/gpt-5.4
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any

DEFAULT_MODEL = "openai/gpt-5.4"


def split_model(model: str | None) -> tuple[str, str]:
    text = (model or os.environ.get("OPENCODE_MODEL") or DEFAULT_MODEL).strip()
    if "/" not in text:
        return "openai", text
    provider, _, rest = text.partition("/")
    if not provider or not rest:
        raise ValueError(f"OpenCode model must be provider/model, got {model!r}")
    return provider, rest


def _basic_auth_header() -> dict[str, str]:
    password = os.environ.get("OPENCODE_SERVER_PASSWORD")
    if not password:
        return {}
    import base64

    user = os.environ.get("OPENCODE_SERVER_USERNAME") or "opencode"
    token = base64.b64encode(f"{user}:{password}".encode()).decode()
    return {"Authorization": f"Basic {token}"}


def _request(
    method: str,
    url: str,
    data: dict[str, Any] | None = None,
    *,
    timeout: int = 180,
) -> Any:
    body = json.dumps(data).encode() if data is not None else None
    headers = {
        "content-type": "application/json",
        "accept": "application/json",
        **_basic_auth_header(),
    }
    req = urllib.request.Request(url, data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:800]
        raise RuntimeError(f"OpenCode API {method} {url} → HTTP {exc.code}: {detail}") from exc
    if not raw:
        return None
    return json.loads(raw.decode("utf-8"))


def _parts_text(payload: Any) -> str:
    chunks: list[str] = []
    parts = payload.get("parts") if isinstance(payload, dict) else None
    if isinstance(parts, list):
        for part in parts:
            if not isinstance(part, dict):
                continue
            if part.get("type") in {None, "text"} and isinstance(part.get("text"), str):
                chunks.append(part["text"])
    text = "\n".join(c.strip() for c in chunks if c.strip()).strip()
    if text:
        return text
    if isinstance(payload, dict):
        info = payload.get("info") or {}
        if isinstance(info, dict) and isinstance(info.get("content"), str):
            return info["content"].strip()
    raise RuntimeError("OpenCode API returned no text parts")


def call_opencode_http(
    prompt: str,
    *,
    model: str | None = None,
    base_url: str | None = None,
    timeout: int = 180,
    request=_request,
) -> str:
    """POST /session then /session/:id/message on a running `opencode serve`."""
    root = (base_url or os.environ.get("OPENCODE_URL") or "").rstrip("/")
    if not root:
        raise ValueError("OPENCODE_URL is not set (e.g. http://127.0.0.1:4096)")
    provider_id, model_id = split_model(model)
    session = request("POST", f"{root}/session", {"title": "cv-tailor"}, timeout=30)
    if not isinstance(session, dict) or not session.get("id"):
        raise RuntimeError(f"OpenCode session create failed: {session!r}")
    sid = session["id"]
    try:
        payload = request(
            "POST",
            f"{root}/session/{sid}/message",
            {
                "model": {"providerID": provider_id, "modelID": model_id},
                "parts": [{"type": "text", "text": prompt}],
            },
            timeout=timeout,
        )
        return _parts_text(payload)
    finally:
        try:
            request("DELETE", f"{root}/session/{sid}", timeout=15)
        except Exception:
            pass
