"""Stats screen — funnel chart and application timeline."""

from __future__ import annotations

from textual.app import ComposeResult
from textual.containers import ScrollableContainer
from textual.widgets import Footer, Header, Static

from cv_tui.api.models import StatsData
from cv_tui.screens.base import LoadableScreen

_FUNNEL_ORDER = ["applied", "interview", "offer", "accepted", "rejected", "ghosted"]
_BAR_WIDTH = 40


class StatsScreen(LoadableScreen):
    """Displays a funnel chart and weekly application timeline.

    Args:
        client: The async cv-api client instance.
    """

    def compose(self) -> ComposeResult:
        yield Header()
        with ScrollableContainer():
            yield Static("Loading stats...", id="stats-content")
        yield Footer()

    async def _load(self) -> None:
        try:
            data = await self._client.get_stats()
            self.query_one("#stats-content", Static).update(self._build_content(data))
        except Exception as exc:
            self.query_one("#stats-content", Static).update(f"[red]Error: {exc}[/red]")

    def _build_content(self, data: StatsData) -> str:
        lines: list[str] = []
        lines.append("[bold lavender]Application Statistics[/bold lavender]")
        lines.append("")

        # Funnel
        lines.append("[bold]Pipeline Funnel[/bold]")
        lines.append("")
        total = max(data.funnel.get("applied", 1), 1)
        for stage in _FUNNEL_ORDER:
            count = data.funnel.get(stage, 0)
            if count == 0 and stage not in data.funnel:
                continue
            filled = int((count / total) * _BAR_WIDTH)
            bar = "█" * filled + "░" * (_BAR_WIDTH - filled)
            pct = (count / total * 100) if total else 0
            lines.append(f"  {stage:<12} {bar}  {count:>3}  ({pct:4.1f}%)")

        lines.append("")
        lines.append("[bold]Timeline (recent)[/bold]")
        lines.append("")

        if not data.timeline:
            lines.append("  No timeline data available.")
        else:
            max_count = max((e.count for e in data.timeline), default=1) or 1
            for entry in data.timeline[-20:]:
                filled = int((entry.count / max_count) * 20)
                bar = "█" * filled
                lines.append(f"  {entry.date}  {bar:<20}  {entry.count}")

        return "\n".join(lines)
