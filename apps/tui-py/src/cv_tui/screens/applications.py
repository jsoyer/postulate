"""Applications list screen — sortable/filterable DataTable of all applications."""

from __future__ import annotations

from typing import Any

from textual.app import ComposeResult
from textual.binding import Binding
from textual.screen import Screen
from textual.widgets import DataTable, Footer, Header, Input, Static

from cv_tui.api.client import CvApiClient
from cv_tui.api.models import Application


class ApplicationsScreen(Screen):  # type: ignore[type-arg]
    """Searchable DataTable listing all applications from cv-api.

    Press Enter on a row to view its detail screen.

    Args:
        client: The async cv-api client instance.
    """

    BINDINGS = [
        Binding("r", "refresh", "Refresh"),
        Binding("/", "focus_search", "Search", show=True),
        Binding("j", "cursor_down", "Down", show=False),
        Binding("k", "cursor_up", "Up", show=False),
        Binding("g", "cursor_top", "Top", show=False),
        Binding("G", "cursor_bottom", "Bottom", show=False),
        Binding("escape", "blur_search", "Focus table", show=False),
    ]

    def __init__(self, client: CvApiClient, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self._client = client
        self._apps: list[Application] = []

    def compose(self) -> ComposeResult:
        yield Header()
        yield Input(placeholder="Filter by company, position or status...", id="search-input")
        yield Static("Loading...", id="status-line")
        yield DataTable(id="apps-table", cursor_type="row")
        yield Footer()

    def on_mount(self) -> None:
        table = self.query_one("#apps-table", DataTable)
        table.add_columns("Date", "Name", "Company", "Position", "Status", "Outcome")
        self.run_worker(self._load(), exclusive=True)

    def action_refresh(self) -> None:
        self.run_worker(self._load(), exclusive=True)

    def action_focus_search(self) -> None:
        self.query_one("#search-input", Input).focus()

    def action_cursor_down(self) -> None:
        """Move table cursor down one row."""
        self.query_one("#apps-table", DataTable).action_cursor_down()

    def action_cursor_up(self) -> None:
        """Move table cursor up one row."""
        self.query_one("#apps-table", DataTable).action_cursor_up()

    def action_cursor_top(self) -> None:
        """Jump table cursor to the first row."""
        table = self.query_one("#apps-table", DataTable)
        if table.row_count:
            table.move_cursor(row=0)

    def action_cursor_bottom(self) -> None:
        """Jump table cursor to the last row."""
        table = self.query_one("#apps-table", DataTable)
        if table.row_count:
            table.move_cursor(row=table.row_count - 1)

    def action_blur_search(self) -> None:
        """Return focus to the applications table."""
        self.query_one("#apps-table", DataTable).focus()

    async def _load(self) -> None:
        try:
            self._apps = await self._client.list_applications()
            self._populate(self._apps)
        except Exception as exc:
            self.query_one("#status-line", Static).update(f"[red]Error: {exc}[/red]")

    def _populate(self, apps: list[Application]) -> None:
        table = self.query_one("#apps-table", DataTable)
        table.clear()
        for app in apps:
            date = app.created_at.strftime("%Y-%m-%d")
            table.add_row(
                date,
                app.name,
                app.company,
                app.position,
                app.status,
                app.outcome or "",
                key=app.name,
            )
        self.query_one("#status-line", Static).update(
            f"[green]{len(apps)} application(s)[/green]"
        )

    def on_input_changed(self, event: Input.Changed) -> None:
        if event.input.id == "search-input":
            query = event.value.lower()
            if not query:
                self._populate(self._apps)
                return
            filtered = [
                a
                for a in self._apps
                if query in a.company.lower()
                or query in a.position.lower()
                or query in a.status.lower()
                or query in a.name.lower()
            ]
            self._populate(filtered)

    def on_data_table_row_selected(self, event: DataTable.RowSelected) -> None:
        name = str(event.row_key.value)
        app = next((a for a in self._apps if a.name == name), None)
        if app is not None:
            from cv_tui.screens.detail import DetailScreen

            self.app.push_screen(DetailScreen(client=self._client, application=app))
