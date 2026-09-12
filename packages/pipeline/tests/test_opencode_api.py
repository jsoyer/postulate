"""Unit tests for OpenCode HTTP API — no live server."""

from __future__ import annotations

import pytest

from lib.opencode_api import call_opencode_http, split_model


def test_split_model_provider_slash() -> None:
    assert split_model("openai/gpt-5.4") == ("openai", "gpt-5.4")
    assert split_model("openai/gpt-5.4-mini") == ("openai", "gpt-5.4-mini")


def test_split_model_bare_defaults_openai() -> None:
    assert split_model("gpt-5.4") == ("openai", "gpt-5.4")


def test_call_opencode_http_posts_session_and_message() -> None:
    calls: list[tuple[str, str, object]] = []

    def fake_request(method, url, data=None, timeout=180):  # noqa: ANN001
        calls.append((method, url, data))
        if method == "POST" and url.endswith("/session"):
            return {"id": "ses_1"}
        if method == "POST" and url.endswith("/message"):
            return {"parts": [{"type": "text", "text": "COVER LETTER"}]}
        if method == "DELETE":
            return True
        raise AssertionError(url)

    text = call_opencode_http(
        "write yaml",
        model="openai/gpt-5.4",
        base_url="http://127.0.0.1:4096",
        request=fake_request,
    )
    assert text == "COVER LETTER"
    assert calls[0][0] == "POST" and calls[0][1].endswith("/session")
    method, url, body = calls[1]
    assert method == "POST" and url.endswith("/session/ses_1/message")
    assert body["model"] == {"providerID": "openai", "modelID": "gpt-5.4"}
    assert body["parts"][0]["text"] == "write yaml"
    assert calls[-1][0] == "DELETE"


def test_call_opencode_http_requires_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("OPENCODE_URL", raising=False)
    with pytest.raises(ValueError, match="OPENCODE_URL"):
        call_opencode_http("hi", request=lambda *a, **k: None)
