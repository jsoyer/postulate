"""Kanban board screen — applications grouped into status columns."""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from textual.app import ComposeResult
from textual.binding import Binding
from textual.containers import Horizontal, ScrollableContainer, Vertical
from textual.screen import Screen
from textual.widgets import Footer, Header, Label, Static

from cv_tui.api.client import CvApiClient
from cv_tui.api.models import Application

_COLUMNS = ["applied", "interview", "offer", "rejected", "ghosted"]

_COLUMN_COLORS: dict[str, str] = {
    "applied": "blue",
    "interview": "yellow",
    "offer": "green",
    "rejected": "red",
    "ghosted": "dim",
}


class KanbanScreen(Screen):  # type: ignore[type-arg]
    """5-column Kanban board showing applications by pipeline stage.

    Args:
        client: The async cv-api client instance.
    """

    BINDINGS = [
        Binding("r", "refresh", "Refresh"),
        Binding("j", "scroll_down", "Scroll down", show=False),
        Binding("k", "scroll_up", "Scroll up", show=False),
    ]

    def __init__(self, client: CvApiClient, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self._client = client

    def compose(self) -> ComposeResult:
        yield Header()
        with ScrollableContainer(), Horizontal(id="kanban-board"):
                for col in _COLUMNS:
                    color = _COLUMN_COLORS.get(col, "white")
                    with Vertical(classes="kanban-column", id=f"col-{col}"):
                        yield Label(
                            f"[bold {color}]{col.upper()}[/bold {color}]",
                            classes="kanban-column-title",
                        )
                        yield Static("Loading...", id=f"cards-{col}")
        yield Footer()

    def on_mount(self) -> None:
        self.run_worker(self._load(), exclusive=True)

    def action_refresh(self) -> None:
        self.run_worker(self._load(), exclusive=True)

    def action_scroll_down(self) -> None:
        """Scroll the kanban board down."""
        self.query_one(ScrollableContainer).scroll_down()

    def action_scroll_up(self) -> None:
        """Scroll the kanban board up."""
        self.query_one(ScrollableContainer).scroll_up()

    async def _load(self) -> None:
        try:
            apps = await self._client.list_applications()
            by_status: dict[str, list[Application]] = defaultdict(list)
            for app in apps:
                by_status[app.status.lower()].append(app)
            for col in _COLUMNS:
                self._render_column(col, by_status.get(col, []))
        except Exception as exc:
            for col in _COLUMNS:
                self.query_one(f"#cards-{col}", Static).update(f"[red]{exc}[/red]")

    def _render_column(self, col: str, apps: list[Application]) -> None:
        if not apps:
            self.query_one(f"#cards-{col}", Static).update("[dim]empty[/dim]")
            return
        lines: list[str] = []
        for app in sorted(apps, key=lambda a: a.created_at, reverse=True):
            date = app.created_at.strftime("%Y-%m-%d")
            lines.append(f"[bold cyan]{app.company}[/bold cyan]")
            lines.append(f"  {app.position}")
            lines.append(f"  [dim]{date}[/dim]")
            lines.append("")
        self.query_one(f"#cards-{col}", Static).update("\n".join(lines))
