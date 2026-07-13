"""Dashboard screen — overview of pipeline health and recent applications."""

from __future__ import annotations

from textual.app import ComposeResult
from textual.containers import ScrollableContainer
from textual.widgets import Footer, Header, Static

from cv_tui.api.models import DashboardData
from cv_tui.screens.base import LoadableScreen

_PIPELINE_ORDER = ["applied", "interview", "offer", "rejected", "ghosted", "archived"]
_BAR_WIDTH = 30


class DashboardScreen(LoadableScreen):
    """Displays pipeline stats and the most recent applications.

    Args:
        client: The async cv-api client instance.
    """

    def compose(self) -> ComposeResult:
        yield Header()
        with ScrollableContainer():
            yield Static("Loading dashboard...", id="dashboard-content")
        yield Footer()

    async def _load(self) -> None:
        try:
            data = await self._client.get_dashboard()
            self.query_one("#dashboard-content", Static).update(self._build_content(data))
        except Exception as exc:
            self.query_one("#dashboard-content", Static).update(f"[red]Error: {exc}[/red]")

    def _build_content(self, data: DashboardData) -> str:
        lines: list[str] = []
        lines.append("[bold lavender]CV Pipeline Dashboard[/bold lavender]")
        lines.append("")
        lines.append(f"  Total applications: [bold]{data.total_applications}[/bold]")
        lines.append("")
        lines.append("[bold]Pipeline funnel:[/bold]")

        total = data.total_applications or 1
        for status in _PIPELINE_ORDER:
            count = data.by_status.get(status, 0)
            filled = int((count / total) * _BAR_WIDTH)
            bar = "█" * filled + "░" * (_BAR_WIDTH - filled)
            lines.append(f"  {status:<12} {bar}  {count:>3}")

        lines.append("")
        lines.append("[bold]Recent applications:[/bold]")
        for app in data.recent_applications[:10]:
            date = app.created_at.strftime("%Y-%m-%d")
            lines.append(f"  {date}  [cyan]{app.name:<30}[/cyan]  {app.company:<20}  {app.status}")

        return "\n".join(lines)
