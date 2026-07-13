"""Integration tests for CvApiClient using a mock httpx transport."""

from __future__ import annotations

import httpx
import pytest

from cv_tui.api.client import CvApiClient
from cv_tui.api.models import (
    ActionResult,
    APIError,
    Application,
    DashboardData,
    StatsData,
    Target,
)

_APP_JSON: dict[str, object] = {
    "name": "acme-software-engineer",
    "company": "Acme",
    "position": "Software Engineer",
    "status": "applied",
    "created_at": "2024-01-15T10:00:00Z",
}

_DASHBOARD_JSON: dict[str, object] = {
    "total_applications": 5,
    "by_status": {"applied": 3, "interview": 2},
    "recent_applications": [_APP_JSON],
}

_STATS_JSON: dict[str, object] = {
    "funnel": {"applied": 5, "interview": 2},
    "timeline": [{"date": "2024-01-15", "count": 2}],
}

_TARGET_JSON: dict[str, object] = {
    "name": "tailor",
    "category": "cv",
    "description": "Tailor CV",
    "args": ["NAME", "THEME"],
}

_ACTION_RESULT_JSON: dict[str, object] = {
    "job_id": "abc123",
    "target": "tailor",
    "status": "completed",
    "exit_code": 0,
    "stdout": "Done",
    "stderr": None,
    "duration_ms": 1234,
}


class _MockTransport(httpx.AsyncBaseTransport):
    def __init__(self, routes: dict[str, tuple[int, object]]) -> None:
        self._routes = routes
        self.call_count = 0

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        self.call_count += 1
        key = f"{request.method} {request.url.path}"
        if key in self._routes:
            status, body = self._routes[key]
            return httpx.Response(status, json=body)
        return httpx.Response(404, json={"message": "not found"})


class _ErrorTransport(httpx.AsyncBaseTransport):
    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        raise httpx.TransportError("connection refused")


def _make_client(routes: dict[str, tuple[int, object]]) -> tuple[CvApiClient, _MockTransport]:
    transport = _MockTransport(routes)
    client = CvApiClient("http://test", "test-key")
    client._client = httpx.AsyncClient(
        base_url="http://test",
        headers={"X-API-Key": "test-key"},
        transport=transport,
    )
    return client, transport


async def test_health_ok() -> None:
    client, _ = _make_client({"GET /health": (200, {"ok": True})})
    try:
        result = await client.health()
        assert result is True
    finally:
        await client.close()


async def test_health_non_200() -> None:
    client, _ = _make_client({"GET /health": (503, {"message": "unavailable"})})
    try:
        result = await client.health()
        assert result is False
    finally:
        await client.close()


async def test_health_transport_error() -> None:
    client = CvApiClient("http://test", "test-key")
    client._client = httpx.AsyncClient(
        base_url="http://test",
        headers={"X-API-Key": "test-key"},
        transport=_ErrorTransport(),
    )
    try:
        result = await client.health()
        assert result is False
    finally:
        await client.close()


async def test_list_applications_returns_list() -> None:
    client, transport = _make_client({"GET /api/applications": (200, [_APP_JSON])})
    try:
        apps = await client.list_applications()
        assert isinstance(apps, list)
        assert len(apps) == 1
        assert isinstance(apps[0], Application)
        assert apps[0].company == "Acme"
        assert transport.call_count == 1
    finally:
        await client.close()


async def test_list_applications_second_call_uses_cache() -> None:
    client, transport = _make_client({"GET /api/applications": (200, [_APP_JSON])})
    try:
        await client.list_applications()
        await client.list_applications()
        assert transport.call_count == 1
    finally:
        await client.close()


async def test_list_applications_status_filter() -> None:
    routes: dict[str, tuple[int, object]] = {
        "GET /api/applications": (200, [_APP_JSON]),
    }
    client, transport = _make_client(routes)
    try:
        apps = await client.list_applications(status="interview")
        assert isinstance(apps, list)
        assert transport.call_count == 1
    finally:
        await client.close()


async def test_list_applications_error_raises() -> None:
    client, _ = _make_client({"GET /api/applications": (500, {"message": "internal error"})})
    try:
        with pytest.raises(APIError) as exc_info:
            await client.list_applications()
        assert exc_info.value.status_code == 500
    finally:
        await client.close()


async def test_get_application_ok() -> None:
    client, _ = _make_client(
        {"GET /api/applications/acme-software-engineer": (200, _APP_JSON)}
    )
    try:
        app = await client.get_application("acme-software-engineer")
        assert isinstance(app, Application)
        assert app.name == "acme-software-engineer"
        assert app.position == "Software Engineer"
    finally:
        await client.close()


async def test_get_application_404() -> None:
    client, _ = _make_client(
        {"GET /api/applications/missing": (404, {"message": "not found"})}
    )
    try:
        with pytest.raises(APIError) as exc_info:
            await client.get_application("missing")
        assert exc_info.value.status_code == 404
    finally:
        await client.close()


async def test_create_application_ok() -> None:
    client, _ = _make_client({"POST /api/applications": (201, _APP_JSON)})
    try:
        app = await client.create_application("Acme", "Software Engineer")
        assert isinstance(app, Application)
        assert app.company == "Acme"
    finally:
        await client.close()


async def test_create_application_with_url() -> None:
    client, transport = _make_client({"POST /api/applications": (201, _APP_JSON)})
    try:
        app = await client.create_application(
            "Acme", "Software Engineer", url="https://jobs.acme.com/123"
        )
        assert isinstance(app, Application)
        assert transport.call_count == 1
    finally:
        await client.close()


async def test_get_dashboard_ok() -> None:
    client, _ = _make_client({"GET /api/dashboard": (200, _DASHBOARD_JSON)})
    try:
        dashboard = await client.get_dashboard()
        assert isinstance(dashboard, DashboardData)
        assert dashboard.total_applications == 5
        assert dashboard.by_status["applied"] == 3
        assert len(dashboard.recent_applications) == 1
    finally:
        await client.close()


async def test_get_dashboard_second_call_uses_cache() -> None:
    client, transport = _make_client({"GET /api/dashboard": (200, _DASHBOARD_JSON)})
    try:
        await client.get_dashboard()
        await client.get_dashboard()
        assert transport.call_count == 1
    finally:
        await client.close()


async def test_get_stats_ok() -> None:
    client, _ = _make_client({"GET /api/stats": (200, _STATS_JSON)})
    try:
        stats = await client.get_stats()
        assert isinstance(stats, StatsData)
        assert stats.funnel["applied"] == 5
        assert len(stats.timeline) == 1
        assert stats.timeline[0].date == "2024-01-15"
    finally:
        await client.close()


async def test_list_targets_ok() -> None:
    client, _ = _make_client({"GET /api/targets": (200, [_TARGET_JSON])})
    try:
        targets = await client.list_targets()
        assert isinstance(targets, list)
        assert len(targets) == 1
        assert isinstance(targets[0], Target)
        assert targets[0].name == "tailor"
        assert targets[0].args == ["NAME", "THEME"]
    finally:
        await client.close()


async def test_execute_action_ok() -> None:
    client, _ = _make_client(
        {"POST /api/actions/tailor": (200, _ACTION_RESULT_JSON)}
    )
    try:
        result = await client.execute_action("tailor", app="acme-software-engineer")
        assert isinstance(result, ActionResult)
        assert result.job_id == "abc123"
        assert result.exit_code == 0
        assert result.stdout == "Done"
        assert result.duration_ms == 1234
    finally:
        await client.close()


async def test_execute_action_with_args() -> None:
    client, transport = _make_client(
        {"POST /api/actions/tailor": (200, _ACTION_RESULT_JSON)}
    )
    try:
        result = await client.execute_action(
            "tailor", app="acme", args={"THEME": "modern"}
        )
        assert result.status == "completed"
        assert transport.call_count == 1
    finally:
        await client.close()


async def test_execute_action_error_raises() -> None:
    client, _ = _make_client(
        {"POST /api/actions/missing-target": (422, {"message": "unknown target"})}
    )
    try:
        with pytest.raises(APIError) as exc_info:
            await client.execute_action("missing-target")
        assert exc_info.value.status_code == 422
        assert "unknown target" in exc_info.value.message
    finally:
        await client.close()


async def test_get_settings_ok() -> None:
    settings_data: dict[str, object] = {"theme": "nord", "notifications": True}
    client, _ = _make_client({"GET /api/settings": (200, settings_data)})
    try:
        settings = await client.get_settings()
        assert settings["theme"] == "nord"
    finally:
        await client.close()


async def test_update_settings_ok() -> None:
    settings_data: dict[str, object] = {"theme": "dracula"}
    client, _ = _make_client({"PUT /api/settings": (200, settings_data)})
    try:
        result = await client.update_settings({"theme": "dracula"})
        assert result["theme"] == "dracula"
    finally:
        await client.close()


async def test_raise_for_status_uses_message_field() -> None:
    client, _ = _make_client(
        {"GET /api/applications": (400, {"message": "bad request detail"})}
    )
    try:
        with pytest.raises(APIError) as exc_info:
            await client.list_applications()
        assert exc_info.value.message == "bad request detail"
        assert str(exc_info.value) == "bad request detail"
    finally:
        await client.close()


async def test_raise_for_status_non_json_body() -> None:
    transport = _MockTransport({})
    client = CvApiClient("http://test", "test-key")

    async def _handle(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, content=b"plain text error")

    transport.handle_async_request = _handle  # type: ignore[method-assign]
    client._client = httpx.AsyncClient(
        base_url="http://test",
        headers={"X-API-Key": "test-key"},
        transport=transport,
    )
    try:
        with pytest.raises(APIError) as exc_info:
            await client.list_applications()
        assert exc_info.value.status_code == 500
    finally:
        await client.close()


async def test_context_manager_closes_client() -> None:
    routes: dict[str, tuple[int, object]] = {"GET /health": (200, {})}
    client, _ = _make_client(routes)
    async with client:
        result = await client.health()
    assert result is True


async def test_api_key_sent_in_header() -> None:
    received_headers: list[str] = []

    class _HeaderCapture(httpx.AsyncBaseTransport):
        async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
            received_headers.append(request.headers.get("x-api-key", ""))
            return httpx.Response(200, json=[])

    client = CvApiClient("http://test", "my-secret-key")
    client._client = httpx.AsyncClient(
        base_url="http://test",
        headers={"X-API-Key": "my-secret-key"},
        transport=_HeaderCapture(),
    )
    try:
        await client.list_applications()
        assert received_headers[0] == "my-secret-key"
    finally:
        await client.close()


async def test_base_url_trailing_slash_stripped() -> None:
    client = CvApiClient("http://test/", "key")
    try:
        assert client.base_url == "http://test"
    finally:
        await client.close()
