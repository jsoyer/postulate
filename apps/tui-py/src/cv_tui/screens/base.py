"""Base screen class — shared load/refresh pattern for cv-tui screens."""

from __future__ import annotations

from abc import abstractmethod
from typing import Any

from textual.binding import Binding
from textual.screen import Screen

from cv_tui.api.client import CvApiClient


class LoadableScreen(Screen):  # type: ignore[type-arg]
    """Screen base that provides a standard load/refresh pattern.

    Subclasses must implement :meth:`_load`. On mount the load worker
    fires automatically; pressing ``r`` triggers a fresh reload.

    Args:
        client: The async cv-api client instance.
    """

    BINDINGS = [
        Binding("r", "refresh", "Refresh"),
    ]

    def __init__(self, client: CvApiClient, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self._client = client

    def on_mount(self) -> None:
        self.run_worker(self._load(), exclusive=True)

    def action_refresh(self) -> None:
        self.run_worker(self._load(), exclusive=True)

    @abstractmethod
    async def _load(self) -> None:
        """Fetch data and update the screen widgets."""
