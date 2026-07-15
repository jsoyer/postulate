"""Theme selection modal — dismisses with the selected theme slug or empty string on cancel."""

from __future__ import annotations

from textual.app import ComposeResult
from textual.binding import Binding
from textual.screen import ModalScreen
from textual.widgets import Button, Label, ListItem, ListView, Static

_THEMES: list[tuple[str, str]] = [
    ("catppuccin-mocha", "Catppuccin Mocha (dark)"),
    ("catppuccin-latte", "Catppuccin Latte (light)"),
    ("dracula", "Dracula"),
    ("nord", "Nord"),
    ("solarized-dark", "Solarized Dark"),
    ("solarized-light", "Solarized Light"),
]


class ThemeModal(ModalScreen[str]):
    """Theme selection modal. Dismisses with the selected theme name."""

    BINDINGS = [Binding("escape", "dismiss_cancel", "Cancel")]

    DEFAULT_CSS = """
    ThemeModal {
        align: center middle;
    }
    #theme-dialog-box {
        width: 50;
        height: auto;
        border: thick $lavender;
        background: $surface0;
        padding: 1 2;
    }
    #theme-list {
        height: auto;
        max-height: 12;
        margin: 1 0;
    }
    """

    def compose(self) -> ComposeResult:
        with Static(id="theme-dialog-box"):
            yield Label("Select CV Theme", classes="section-title")
            yield ListView(id="theme-list")
            yield Button("Cancel", id="btn-cancel", variant="error")

    def on_mount(self) -> None:
        list_view = self.query_one("#theme-list", ListView)
        for slug, display_name in _THEMES:
            list_view.mount(ListItem(Label(display_name), id=f"theme-{slug}"))
        list_view.focus()

    def on_list_view_selected(self, event: ListView.Selected) -> None:
        item_id = event.item.id or ""
        if item_id.startswith("theme-"):
            self.dismiss(item_id[len("theme-") :])

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "btn-cancel":
            self.dismiss("")

    def action_dismiss_cancel(self) -> None:
        self.dismiss("")
