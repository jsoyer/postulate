"""Async HTTP client for the cv-api backend."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any, cast

import httpx
import websockets
import websockets.exceptions

from cv_tui.api.models import (
    ActionResult,
    APIError,
    Application,
    DashboardData,
    StatsData,
    Target,
)

_APPLICATIONS_TTL = 60.0
_DASHBOARD_TTL = 60.0
_STATS_TTL = 60.0
_TARGETS_TTL = 300.0


@dataclass
class _CacheEntry:
    value: Any
    expires_at: float


class CvApiClient:
    """Async HTTP client wrapping all cv-api endpoints.

    Args:
        base_url: The base URL of the cv-api server (e.g. http://localhost:3001).
        api_key: The API key sent via the X-API-Key header.
        timeout: Request timeout in seconds.
    """

    def __init__(
        self,
        base_url: str,
        api_key: str,
        timeout: float = 30.0,
        max_retries: int = 3,
        retry_delay: float = 1.0,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._headers = {"X-API-Key": api_key}
        self._max_retries = max_retries
        self._retry_delay = retry_delay
        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            headers=self._headers,
            timeout=timeout,
        )
        self._cache: dict[str, _CacheEntry] = {}

    # ------------------------------------------------------------------
    # Health
    # ------------------------------------------------------------------

    async def health(self) -> bool:
        """Return True if cv-api is reachable and healthy.

        Returns:
            True when the server responds with HTTP 200.
        """
        try:
            resp = await self._client.get("/health")
            return resp.status_code == 200
        except httpx.TransportError:
            return False

    # ------------------------------------------------------------------
    # Applications
    # ------------------------------------------------------------------

    async def list_applications(self, status: str | None = None) -> list[Application]:
        """List all applications, optionally filtered by status.

        Args:
            status: Optional status filter (e.g. "applied", "interview").

        Returns:
            List of Application objects.

        Raises:
            APIError: When the server returns a non-2xx response.
        """
        cache_key = f"applications:{status}" if status else "applications"
        cached = self._cache_get(cache_key)
        if cached is not None:
            return cast(list[Application], cached)

        params: dict[str, str] = {}
        if status:
            params["status"] = status
        resp = await self._request("GET", "/api/applications", params=params)
        self._raise_for_status(resp)
        result = [Application.model_validate(item) for item in resp.json()]
        self._cache_set(cache_key, result, _APPLICATIONS_TTL)
        return result

    async def get_application(self, name: str) -> Application:
        """Fetch a single application by name.

        Args:
            name: Application directory name.

        Returns:
            The Application object.

        Raises:
            APIError: When the server returns a non-2xx response.
        """
        resp = await self._request("GET", f"/api/applications/{name}")
        self._raise_for_status(resp)
        return Application.model_validate(resp.json())

    async def create_application(
        self, company: str, position: str, url: str = ""
    ) -> Application:
        """Create a new application directory.

        Args:
            company: Company name.
            position: Job title / position.
            url: Optional job posting URL.

        Returns:
            The newly created Application object.

        Raises:
            APIError: When the server returns a non-2xx response.
        """
        payload: dict[str, str] = {"company": company, "position": position}
        if url:
            payload["url"] = url
        resp = await self._request("POST", "/api/applications", json=payload)
        self._raise_for_status(resp)
        self._cache = {k: v for k, v in self._cache.items() if not k.startswith("applications")}
        return Application.model_validate(resp.json())

    # ------------------------------------------------------------------
    # Dashboard & Stats
    # ------------------------------------------------------------------

    async def get_dashboard(self) -> DashboardData:
        """Fetch aggregated dashboard data.

        Returns:
            DashboardData with totals and recent applications.

        Raises:
            APIError: When the server returns a non-2xx response.
        """
        cached = self._cache_get("dashboard")
        if cached is not None:
            return cast(DashboardData, cached)

        resp = await self._request("GET", "/api/dashboard")
        self._raise_for_status(resp)
        result = DashboardData.model_validate(resp.json())
        self._cache_set("dashboard", result, _DASHBOARD_TTL)
        return result

    async def get_stats(self) -> StatsData:
        """Fetch pipeline statistics.

        Returns:
            StatsData with funnel counts and timeline.

        Raises:
            APIError: When the server returns a non-2xx response.
        """
        cached = self._cache_get("stats")
        if cached is not None:
            return cast(StatsData, cached)

        resp = await self._request("GET", "/api/stats")
        self._raise_for_status(resp)
        result = StatsData.model_validate(resp.json())
        self._cache_set("stats", result, _STATS_TTL)
        return result

    # ------------------------------------------------------------------
    # Targets & Actions
    # ------------------------------------------------------------------

    async def list_targets(self) -> list[Target]:
        """List all allowed Make targets from cv-api.

        Returns:
            List of Target objects grouped by category.

        Raises:
            APIError: When the server returns a non-2xx response.
        """
        cached = self._cache_get("targets")
        if cached is not None:
            return cast(list[Target], cached)

        resp = await self._request("GET", "/api/targets")
        self._raise_for_status(resp)
        result = [Target.model_validate(item) for item in resp.json()]
        self._cache_set("targets", result, _TARGETS_TTL)
        return result

    async def execute_action(
        self,
        target: str,
        app: str = "",
        args: dict[str, str] | None = None,
    ) -> ActionResult:
        """Execute a Make target synchronously and wait for the result.

        Args:
            target: The Make target name.
            app: Optional application name (passed as NAME= arg).
            args: Optional extra key/value args for the target.

        Returns:
            ActionResult with exit code, stdout, and stderr.

        Raises:
            APIError: When the server returns a non-2xx response.
        """
        payload: dict[str, Any] = {}
        if app:
            payload["application"] = app
        if args:
            payload["args"] = args
        resp = await self._request("POST", f"/api/actions/{target}", json=payload)
        self._raise_for_status(resp)
        for key in ("applications", "dashboard", "stats"):
            self._cache.pop(key, None)
        return ActionResult.model_validate(resp.json())

    async def get_action_status(self, job_id: str) -> ActionResult:
        """Poll the status of a running or completed job.

        Args:
            job_id: The job identifier returned by execute_action.

        Returns:
            ActionResult with current status fields.

        Raises:
            APIError: When the server returns a non-2xx response.
        """
        resp = await self._request("GET", f"/api/actions/jobs/{job_id}")
        self._raise_for_status(resp)
        return ActionResult.model_validate(resp.json())

    async def stream_action(
        self, target: str, app: str = ""
    ) -> AsyncIterator[str]:
        """Stream real-time output from a Make target via WebSocket.

        Yields JSON-encoded WSMessage strings as they arrive. The caller
        should parse each message (type: stdout | stderr | exit | error).

        Args:
            target: The Make target name.
            app: Optional application name appended as ?app= query param.

        Yields:
            Raw JSON strings from the WebSocket stream.
        """
        ws_base = self.base_url.replace("http://", "ws://").replace("https://", "wss://")
        url = f"{ws_base}/ws/actions/{target}"
        if app:
            url += f"?app={app}"
        extra_headers = {"X-API-Key": self._api_key}
        async with websockets.connect(url, additional_headers=extra_headers) as ws:
            async for message in ws:
                yield str(message)

    # ------------------------------------------------------------------
    # Settings
    # ------------------------------------------------------------------

    async def get_settings(self) -> dict[str, Any]:
        """Fetch current user settings.

        Returns:
            Settings dict.

        Raises:
            APIError: When the server returns a non-2xx response.
        """
        resp = await self._request("GET", "/api/settings")
        self._raise_for_status(resp)
        return resp.json()  # type: ignore[no-any-return]

    async def update_settings(self, settings: dict[str, Any]) -> dict[str, Any]:
        """Update user settings.

        Args:
            settings: Partial settings dict to merge.

        Returns:
            Updated settings dict.

        Raises:
            APIError: When the server returns a non-2xx response.
        """
        resp = await self._request("PUT", "/api/settings", json=settings)
        self._raise_for_status(resp)
        return resp.json()  # type: ignore[no-any-return]

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def close(self) -> None:
        """Close the underlying HTTP client."""
        await self._client.aclose()

    async def __aenter__(self) -> CvApiClient:
        return self

    async def __aexit__(self, *_: object) -> None:
        await self.close()

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def invalidate_cache(self, key: str | None = None) -> None:
        """Evict one entry or the entire cache.

        Args:
            key: Cache key to remove. Pass None to clear everything.
        """
        if key is None:
            self._cache.clear()
        else:
            self._cache.pop(key, None)

    def _cache_get(self, key: str) -> Any | None:
        entry = self._cache.get(key)
        if entry is None or time.monotonic() > entry.expires_at:
            return None
        return entry.value

    def _cache_set(self, key: str, value: Any, ttl: float) -> None:
        self._cache[key] = _CacheEntry(value=value, expires_at=time.monotonic() + ttl)

    async def _request(self, method: str, url: str, **kwargs: Any) -> httpx.Response:
        """Execute an HTTP request with exponential backoff on TransportError.

        Args:
            method: HTTP method (GET, POST, PUT).
            url: Endpoint path relative to base_url.
            **kwargs: Extra args forwarded to httpx AsyncClient.request.

        Returns:
            The httpx Response object.

        Raises:
            httpx.TransportError: After all retries are exhausted.
        """
        delay = self._retry_delay
        for attempt in range(self._max_retries + 1):
            try:
                return await self._client.request(method, url, **kwargs)
            except httpx.TransportError:
                if attempt == self._max_retries:
                    raise
                logging.debug(
                    "cv-api %s %s failed (attempt %d/%d), retrying in %.1fs",
                    method,
                    url,
                    attempt + 1,
                    self._max_retries,
                    delay,
                )
                await asyncio.sleep(delay)
                delay *= 2
        raise RuntimeError("unreachable")

    @staticmethod
    def _raise_for_status(resp: httpx.Response) -> None:
        """Raise APIError for non-2xx responses.

        Args:
            resp: The httpx response to inspect.

        Raises:
            APIError: When the response status code indicates failure.
        """
        if resp.is_success:
            return
        try:
            body = resp.json()
            message = body.get("message", resp.text)
        except (json.JSONDecodeError, AttributeError):
            message = resp.text
        raise APIError(resp.status_code, message)
