"""Tests for exponential backoff retry logic in CvApiClient."""

from __future__ import annotations

import json

import httpx
import pytest

from cv_tui.api.client import CvApiClient
from cv_tui.api.models import APIError


class _FailingTransport(httpx.AsyncBaseTransport):
    """Raises TransportError for the first ``fail_count`` calls, then delegates.

    Args:
        fail_count: Number of requests that should raise ConnectError.
        response_json: Body to return once past the failure threshold.
        status: HTTP status code for the successful response.
    """

    def __init__(self, fail_count: int, response_json: object, status: int = 200) -> None:
        self._fail_count = fail_count
        self._calls = 0
        self._response_json = response_json
        self._status = status

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        self._calls += 1
        if self._calls <= self._fail_count:
            raise httpx.ConnectError("simulated failure")
        content = json.dumps(self._response_json).encode()
        return httpx.Response(
            self._status,
            content=content,
            headers={"content-type": "application/json"},
        )


def _make_retrying_client(
    transport: _FailingTransport,
    max_retries: int = 3,
) -> CvApiClient:
    """Construct a CvApiClient with a custom transport, bypassing __init__.

    Args:
        transport: The transport to inject into the underlying AsyncClient.
        max_retries: Maximum retry count to configure on the client.

    Returns:
        A CvApiClient ready for testing.
    """
    client: CvApiClient = CvApiClient.__new__(CvApiClient)
    client.base_url = "http://test"
    client._api_key = "test"
    client._headers = {"X-API-Key": "test"}
    client._max_retries = max_retries
    client._retry_delay = 0.0  # zero delay so tests run instantly
    client._cache: dict = {}
    client._client = httpx.AsyncClient(
        base_url="http://test",
        headers={"X-API-Key": "test"},
        transport=transport,
    )
    return client


async def test_retries_and_succeeds_after_transient_failure() -> None:
    """Failing twice then succeeding should return the parsed result."""
    app_json: dict[str, object] = {
        "name": "acme-engineer",
        "company": "Acme",
        "position": "Engineer",
        "status": "applied",
        "created_at": "2024-01-15T10:00:00Z",
    }
    transport = _FailingTransport(fail_count=2, response_json=[app_json])
    client = _make_retrying_client(transport, max_retries=3)
    try:
        apps = await client.list_applications()
        assert len(apps) == 1
        assert apps[0].company == "Acme"
        # 2 failures + 1 success = 3 total calls
        assert transport._calls == 3
    finally:
        await client.close()


async def test_raises_after_max_retries_exhausted() -> None:
    """Exhausting all retries should propagate httpx.TransportError."""
    # fail_count exceeds max_retries so every attempt raises
    transport = _FailingTransport(fail_count=10, response_json={})
    client = _make_retrying_client(transport, max_retries=3)
    try:
        with pytest.raises(httpx.TransportError):
            await client.list_applications()
        # max_retries=3 means 4 total attempts (attempt 0..3)
        assert transport._calls == 4
    finally:
        await client.close()


async def test_no_retry_on_api_error() -> None:
    """A 404 HTTP response should raise APIError immediately without retrying."""
    transport = _FailingTransport(
        fail_count=0,
        response_json={"message": "not found"},
        status=404,
    )
    client = _make_retrying_client(transport, max_retries=3)
    try:
        with pytest.raises(APIError) as exc_info:
            await client.get_application("missing")
        assert exc_info.value.status_code == 404
        # Only one HTTP call — no retry for non-transport errors
        assert transport._calls == 1
    finally:
        await client.close()


async def test_health_does_not_retry() -> None:
    """health() uses self._client.get directly and should fail fast on TransportError."""
    transport = _FailingTransport(fail_count=10, response_json={})
    client = _make_retrying_client(transport, max_retries=3)
    try:
        result = await client.health()
        # health() catches TransportError and returns False — no retries
        assert result is False
        # Exactly one attempt regardless of max_retries
        assert transport._calls == 1
    finally:
        await client.close()
