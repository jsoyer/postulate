"""CVApp — the root Textual application for cv-tui."""

from __future__ import annotations

from typing import Any

from textual.app import App, ComposeResult
from textual.binding import Binding
from textual.widgets import Footer, Header, Static, TabbedContent, TabPane

from cv_tui.api.client import CvApiClient
from cv_tui.screens.actions import ActionsScreen
from cv_tui.screens.applications import ApplicationsScreen
from cv_tui.screens.dashboard import DashboardScreen
from cv_tui.screens.dialogs import NewApplicationDialog
from cv_tui.screens.kanban import KanbanScreen
from cv_tui.screens.stats import StatsScreen
from cv_tui.theme.catppuccin import CATPPUCCIN_CSS

_TAB_IDS = ["tab-dashboard", "tab-apps", "tab-kanban", "tab-actions", "tab-stats"]


class CVApp(App):  # type: ignore[type-arg]
    """Root Textual application.

    Args:
        client: The async cv-api client instance.
    """

    CSS = CATPPUCCIN_CSS + """
    #status-bar {
        dock: bottom;
        height: 1;
        padding: 0 1;
    }
    TabbedContent {
        height: 1fr;
    }
    """

    TITLE = "CV Manager"
    SUB_TITLE = "cv-tui-py"

    BINDINGS = [
        Binding("q", "quit", "Quit"),
        Binding("1", "switch_tab('tab-dashboard')", "Dashboard", show=False),
        Binding("2", "switch_tab('tab-apps')", "Applications", show=False),
        Binding("3", "switch_tab('tab-kanban')", "Kanban", show=False),
        Binding("4", "switch_tab('tab-actions')", "Actions", show=False),
        Binding("5", "switch_tab('tab-stats')", "Stats", show=False),
        Binding("n", "new_application", "New App"),
        Binding("ctrl+r", "refresh_all", "Refresh"),
        Binding("j", "focus_cursor_down", "Down", show=False),
        Binding("k", "focus_cursor_up", "Up", show=False),
    ]

    def __init__(self, client: CvApiClient, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self._client = client

    def compose(self) -> ComposeResult:
        yield Header()
        with TabbedContent(id="main-tabs"):
            with TabPane("Dashboard", id="tab-dashboard"):
                yield DashboardScreen(client=self._client)
            with TabPane("Applications", id="tab-apps"):
                yield ApplicationsScreen(client=self._client)
            with TabPane("Kanban", id="tab-kanban"):
                yield KanbanScreen(client=self._client)
            with TabPane("Actions", id="tab-actions"):
                yield ActionsScreen(client=self._client)
            with TabPane("Stats", id="tab-stats"):
                yield StatsScreen(client=self._client)
        yield Static(
            f"  API: {self._client.base_url}  |  1-5 switch tabs  |  n new app  |  q quit",
            id="status-bar",
            classes="status-bar",
        )
        yield Footer()

    async def on_mount(self) -> None:
        ok = await self._client.health()
        bar = self.query_one("#status-bar", Static)
        status = "[green]connected[/green]" if ok else "[red]unreachable[/red]"
        bar.update(
            f"  API: {self._client.base_url}  ({status})"
            "  |  1-5 switch tabs  |  n new app  |  q quit"
        )

    async def on_unmount(self) -> None:
        await self._client.close()

    def action_switch_tab(self, tab_id: str) -> None:
        tabs = self.query_one("#main-tabs", TabbedContent)
        tabs.active = tab_id

    def action_new_application(self) -> None:
        self.push_screen(NewApplicationDialog(), self._on_new_app_submitted)

    async def _on_new_app_submitted(self, result: None) -> None:
        pass

    def on_new_application_dialog_submitted(
        self, event: NewApplicationDialog.Submitted
    ) -> None:
        self.run_worker(
            self._create_app(event.company, event.position, event.url),
            exclusive=False,
        )

    async def _create_app(self, company: str, position: str, url: str) -> None:
        try:
            app = await self._client.create_application(company, position, url)
            self.notify(f"Created: {app.name}", severity="information")
            apps_screen = self.query_one(ApplicationsScreen)
            apps_screen.run_worker(apps_screen._load(), exclusive=True)
        except Exception as exc:
            self.notify(f"Failed to create application: {exc}", severity="error")

    def action_focus_cursor_down(self) -> None:
        """Fallback j binding: delegate to the focused widget's cursor/scroll down."""
        focused = self.focused
        if focused is not None and hasattr(focused, "action_scroll_cursor_down"):
            focused.action_scroll_cursor_down()
        elif focused is not None and hasattr(focused, "action_cursor_down"):
            focused.action_cursor_down()

    def action_focus_cursor_up(self) -> None:
        """Fallback k binding: delegate to the focused widget's cursor/scroll up."""
        focused = self.focused
        if focused is not None and hasattr(focused, "action_scroll_cursor_up"):
            focused.action_scroll_cursor_up()
        elif focused is not None and hasattr(focused, "action_cursor_up"):
            focused.action_cursor_up()

    def action_refresh_all(self) -> None:
        for screen in [DashboardScreen, ApplicationsScreen, KanbanScreen, StatsScreen]:
            try:
                widget = self.query_one(screen)
                widget.run_worker(widget._load(), exclusive=True)  # type: ignore[attr-defined]
            except Exception:
                pass
