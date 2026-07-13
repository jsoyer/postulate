"""Application detail screen — full view of a single application."""

from __future__ import annotations

from typing import Any

from textual.app import ComposeResult
from textual.binding import Binding
from textual.containers import Horizontal, ScrollableContainer, Vertical
from textual.screen import Screen
from textual.widgets import Button, Footer, Header, Label, Static

from cv_tui.api.client import CvApiClient
from cv_tui.api.models import Application

_BATCH_THEMES = ["catppuccin-mocha", "catppuccin-latte", "dracula", "nord"]


class DetailScreen(Screen):  # type: ignore[type-arg]
    """Shows all fields and files for a single application.

    Provides quick-action buttons that navigate to the Actions screen
    pre-populated with the application name.

    Args:
        client: The async cv-api client instance.
        application: The Application object to display (already fetched).
    """

    BINDINGS = [
        Binding("escape", "pop_screen", "Back"),
        Binding("r", "refresh", "Refresh"),
    ]

    def __init__(self, client: CvApiClient, application: Application, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self._client = client
        self._app = application

    def compose(self) -> ComposeResult:
        yield Header()
        with ScrollableContainer(), Vertical(id="detail-container"):
            yield Label(self._app.name, id="detail-name", classes="section-title")
            yield Static(self._build_info(), id="detail-info")
            yield Label("Files", classes="section-title")
            yield Static(self._build_files(), id="detail-files")
            yield Label("Quick Actions", classes="section-title")
            with Horizontal(id="quick-actions"):
                yield Button("Tailor", id="btn-tailor", variant="success")
                yield Button("Review", id="btn-review", variant="primary")
                yield Button("Build", id="btn-build")
                yield Button("ATS Score", id="btn-score")
                yield Button("Prep", id="btn-prep")
                yield Button("Batch", id="btn-batch", variant="warning")
                yield Button("Notes", id="btn-notes")
                yield Button("Back", id="btn-back", variant="error")
        yield Footer()

    def action_refresh(self) -> None:
        self.run_worker(self._reload(), exclusive=True)

    async def _reload(self) -> None:
        try:
            self._app = await self._client.get_application(self._app.name)
            self.query_one("#detail-info", Static).update(self._build_info())
            self.query_one("#detail-files", Static).update(self._build_files())
        except Exception as exc:
            self.notify(f"Refresh failed: {exc}", severity="error")

    def _build_info(self) -> str:
        app = self._app
        deadline = app.deadline.strftime("%Y-%m-%d") if app.deadline else "—"
        outcome = app.outcome or "—"
        created = app.created_at.strftime("%Y-%m-%d")
        return (
            f"  Company:   [cyan]{app.company}[/cyan]\n"
            f"  Position:  [cyan]{app.position}[/cyan]\n"
            f"  Status:    [bold]{app.status}[/bold]\n"
            f"  Outcome:   {outcome}\n"
            f"  Deadline:  {deadline}\n"
            f"  Created:   {created}"
        )

    def _build_files(self) -> str:
        if not self._app.files:
            return "  No files found."
        lines = [f"  [dim]{kind:<20}[/dim] {path}" for kind, path in self._app.files.items()]
        return "\n".join(lines)

    def _open_tailor(self) -> None:
        from cv_tui.screens.theme_modal import ThemeModal

        def _on_theme_selected(theme: str | None) -> None:
            from cv_tui.screens.actions import ActionsScreen

            extra: dict[str, str] = {"THEME": theme} if theme else {}
            self.app.push_screen(
                ActionsScreen(
                    client=self._client,
                    preselect_target="tailor",
                    preselect_app=self._app.name,
                    preselect_args=extra or None,
                )
            )

        self.app.push_screen(ThemeModal(), _on_theme_selected)

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "btn-back":
            self.app.pop_screen()
            return

        if event.button.id == "btn-tailor":
            self._open_tailor()
            return

        if event.button.id == "btn-notes":
            from cv_tui.screens.notes_modal import NotesModal

            self.app.push_screen(NotesModal(app_name=self._app.name))
            return

        if event.button.id == "btn-batch":
            self.run_worker(self._run_batch_themes(), exclusive=False)
            return

        target_map: dict[str, str] = {
            "btn-review": "review",
            "btn-build": "app",
            "btn-score": "score",
            "btn-prep": "prep",
        }
        target = target_map.get(str(event.button.id))
        if target:
            from cv_tui.screens.actions import ActionsScreen

            self.app.push_screen(
                ActionsScreen(
                    client=self._client,
                    preselect_target=target,
                    preselect_app=self._app.name,
                )
            )

    async def _run_batch_themes(self) -> None:
        total = len(_BATCH_THEMES)
        for i, theme in enumerate(_BATCH_THEMES, 1):
            self.notify(f"Generating {theme} ({i}/{total})...", severity="information", timeout=3)
            try:
                await self._client.execute_action(
                    "tailor",
                    app=self._app.name,
                    args={"THEME": theme},
                )
                self.notify(f"{theme} done", severity="information", timeout=2)
            except Exception as exc:
                self.notify(f"{theme} failed: {exc}", severity="error", timeout=4)
        self.notify(f"Batch complete — {total} themes generated", severity="information", timeout=5)
