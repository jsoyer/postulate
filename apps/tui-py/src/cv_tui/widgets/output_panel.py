"""OutputPanel widget — scrollable area for streaming action output."""

from textual.app import ComposeResult
from textual.containers import ScrollableContainer
from textual.widget import Widget
from textual.widgets import Static


class OutputPanel(Widget):
    """A scrollable panel that displays text output from API actions.

    Append lines with :meth:`append` or replace all content with
    :meth:`set_content`. The panel auto-scrolls to the bottom on update.
    """

    DEFAULT_CSS = """
    OutputPanel {
        height: 1fr;
    }
    OutputPanel ScrollableContainer {
        height: 1fr;
    }
    """

    def compose(self) -> ComposeResult:
        with ScrollableContainer():
            yield Static("", id="output-text")

    def set_content(self, text: str) -> None:
        """Replace the entire panel content.

        Args:
            text: The new content to display.
        """
        self.query_one("#output-text", Static).update(text)
        self._scroll_end()

    def append(self, text: str) -> None:
        """Append a line to the panel content.

        Args:
            text: The text line to append.
        """
        widget = self.query_one("#output-text", Static)
        current = str(widget.renderable)  # type: ignore[attr-defined]
        widget.update(current + text)
        self._scroll_end()

    def clear(self) -> None:
        """Clear the panel content."""
        self.query_one("#output-text", Static).update("")

    def _scroll_end(self) -> None:
        container = self.query_one(ScrollableContainer)
        container.scroll_end(animate=False)
