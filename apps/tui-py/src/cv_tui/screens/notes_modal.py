"""Notes editor modal — reads and writes a per-application markdown file."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from platformdirs import user_data_dir
from textual.app import ComposeResult
from textual.binding import Binding
from textual.containers import Horizontal
from textual.screen import ModalScreen
from textual.widgets import Button, Label, Static, TextArea


def _notes_path(app_name: str) -> Path:
    return Path(user_data_dir("cv-tui")) / f"{app_name}.md"


class NotesModal(ModalScreen[None]):
    """Markdown notes editor for a single application. Saves to local file."""

    BINDINGS = [
        Binding("ctrl+s", "save_notes", "Save"),
        Binding("escape", "dismiss_cancel", "Cancel"),
    ]

    DEFAULT_CSS = """
    NotesModal {
        align: center middle;
    }
    #notes-dialog-box {
        width: 80%;
        height: 70%;
        border: thick $lavender;
        background: $surface0;
        padding: 1 2;
    }
    #notes-area {
        height: 1fr;
        margin: 1 0;
    }
    """

    def __init__(self, app_name: str, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self._app_name = app_name

    def compose(self) -> ComposeResult:
        with Static(id="notes-dialog-box"):
            yield Label(f"Notes — {self._app_name}", classes="section-title")
            yield TextArea(id="notes-area", language="markdown")
            with Horizontal():
                yield Button("Save", id="btn-save", variant="success")
                yield Button("Cancel", id="btn-cancel", variant="error")

    def on_mount(self) -> None:
        path = _notes_path(self._app_name)
        content = path.read_text() if path.exists() else ""
        self.query_one("#notes-area", TextArea).load_text(content)

    def _save(self) -> None:
        content = self.query_one("#notes-area", TextArea).text
        path = _notes_path(self._app_name)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)
        self.dismiss(None)
        self.notify(f"Notes saved for {self._app_name}")

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "btn-save":
            self._save()
        elif event.button.id == "btn-cancel":
            self.dismiss(None)

    def action_save_notes(self) -> None:
        self._save()

    def action_dismiss_cancel(self) -> None:
        self.dismiss(None)
