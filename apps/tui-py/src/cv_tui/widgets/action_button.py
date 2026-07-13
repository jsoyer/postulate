"""ActionButton — a button that carries a target name and optional app context."""

from dataclasses import dataclass
from typing import Any

from textual.message import Message
from textual.widgets import Button
from textual.widgets._button import ButtonVariant


class ActionButton(Button):
    """A Button that posts an ActionButton.Pressed message carrying the target name.

    Args:
        label: Display label.
        target: The cv-api target name to execute.
        app_name: Optional application name to pass to the action.
        variant: Textual button variant.
    """

    @dataclass
    class Pressed(Message):
        """Posted when the button is pressed."""

        button: "ActionButton"
        target: str
        app_name: str

    def __init__(
        self,
        label: str,
        target: str,
        app_name: str = "",
        variant: ButtonVariant = "default",
        **kwargs: Any,
    ) -> None:
        super().__init__(label, variant=variant, **kwargs)
        self.target = target
        self.app_name = app_name

    def on_button_pressed(self, event: Button.Pressed) -> None:
        event.stop()
        self.post_message(
            ActionButton.Pressed(button=self, target=self.target, app_name=self.app_name)
        )
