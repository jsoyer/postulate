"""Reusable modal dialogs for collecting user input before running actions."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, cast

from textual.app import ComposeResult
from textual.binding import Binding
from textual.message import Message
from textual.screen import ModalScreen
from textual.widgets import Button, Footer, Header, Input, Label, Select, Static


class NewApplicationDialog(ModalScreen[None]):
    """Modal dialog for creating a new application via cv-api.

    Emits :class:`NewApplicationDialog.Submitted` when the user confirms.
    """

    BINDINGS = [Binding("escape", "dismiss", "Cancel")]

    @dataclass
    class Submitted(Message):
        """Posted when the user submits the new application form."""

        company: str
        position: str
        url: str

    def compose(self) -> ComposeResult:
        yield Header()
        with Static(id="dialog-box"):
            yield Label("New Application", classes="section-title")
            yield Input(placeholder="Company (e.g. Snowflake)", id="company")
            yield Input(placeholder="Position (e.g. Senior Director SE)", id="position")
            yield Input(placeholder="Job URL (optional)", id="url")
            yield Button("Create", id="btn-create", variant="success")
            yield Button("Cancel", id="btn-cancel", variant="error")
        yield Footer()

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "btn-cancel":
            self.dismiss()
            return
        if event.button.id == "btn-create":
            company = self.query_one("#company", Input).value.strip()
            position = self.query_one("#position", Input).value.strip()
            url = self.query_one("#url", Input).value.strip()
            if company and position:
                self.post_message(
                    NewApplicationDialog.Submitted(company=company, position=position, url=url)
                )
                self.dismiss()


class ArgInputDialog(ModalScreen[dict[str, str]]):
    """Modal dialog for collecting free-form key=value arguments for a target.

    Args:
        target_name: The name of the target (shown in the title).
        arg_names: List of argument names to collect (e.g. ["NAME", "AI"]).
        app_names: Optional list of (label, value) tuples for an app selector.
    """

    BINDINGS = [Binding("escape", "dismiss", "Cancel")]

    def __init__(
        self,
        target_name: str,
        arg_names: list[str],
        app_names: list[tuple[str, str]] | None = None,
        **kwargs: Any,
    ) -> None:
        super().__init__(**kwargs)
        self._target_name = target_name
        self._arg_names = arg_names
        self._app_names = app_names or []

    def compose(self) -> ComposeResult:
        yield Header()
        with Static(id="dialog-box"):
            yield Label(f"Run: {self._target_name}", classes="section-title")
            for arg in self._arg_names:
                yield Label(arg, classes="arg-label")
                if arg.upper() == "NAME" and self._app_names:
                    yield Select(self._app_names, id=f"arg-{arg}", prompt="Select application...")
                else:
                    yield Input(placeholder=arg, id=f"arg-{arg}")
            yield Button("Run", id="btn-run", variant="success")
            yield Button("Cancel", id="btn-cancel", variant="error")
        yield Footer()

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "btn-cancel":
            self.dismiss({})
            return
        if event.button.id == "btn-run":
            result: dict[str, str] = {}
            for arg in self._arg_names:
                widget_id = f"arg-{arg}"
                try:
                    widget = self.query_one(f"#{widget_id}")
                    if isinstance(widget, Select):
                        val = widget.value
                        result[arg] = "" if val is Select.BLANK else str(val)
                    else:
                        result[arg] = cast(Input, widget).value.strip()
                except Exception:
                    result[arg] = ""
            self.dismiss(result)
