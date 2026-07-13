"""StatusBadge widget — colored label for application status."""

from typing import Any

from textual.app import ComposeResult
from textual.widget import Widget
from textual.widgets import Static

_STATUS_CLASSES: dict[str, str] = {
    "applied": "badge-applied",
    "interview": "badge-interview",
    "offer": "badge-offer",
    "rejected": "badge-rejected",
    "ghosted": "badge-ghosted",
    "archived": "badge-archived",
}


class StatusBadge(Widget):
    """A small colored badge displaying an application status string.

    Args:
        status: The status string (e.g. "applied", "interview").
    """

    DEFAULT_CSS = """
    StatusBadge {
        width: auto;
        height: 1;
    }
    """

    def __init__(self, status: str, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self._status = status

    def compose(self) -> ComposeResult:
        css_class = _STATUS_CLASSES.get(self._status.lower(), "badge-unknown")
        yield Static(self._status.upper(), classes=f"badge {css_class}")

    def update_status(self, status: str) -> None:
        """Update the displayed status without re-mounting.

        Args:
            status: The new status string.
        """
        self._status = status
        badge = self.query_one(Static)
        css_class = _STATUS_CLASSES.get(status.lower(), "badge-unknown")
        badge.update(status.upper())
        badge.set_classes(f"badge {css_class}")
