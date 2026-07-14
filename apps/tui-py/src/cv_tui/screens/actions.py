"""Actions screen — browse targets by category, fill args, run with streaming output."""

from __future__ import annotations

import json
import re
from typing import Any, cast

from textual.app import ComposeResult
from textual.binding import Binding
from textual.containers import Horizontal, Vertical
from textual.screen import Screen
from textual.widgets import Button, Footer, Header, Input, Label, ListItem, ListView, Select, Static

from cv_tui.api.client import CvApiClient
from cv_tui.api.models import Target
from cv_tui.widgets.output_panel import OutputPanel


def _item_id(target_name: str) -> str:
    sanitized = re.sub(r"[^a-zA-Z0-9_-]", "_", target_name)
    return f"item-{sanitized}"


class ActionsScreen(Screen):  # type: ignore[type-arg]
    """Browse all targets from cv-api grouped by category.

    Selecting a target displays its argument inputs. Running it streams
    output via WebSocket into the output panel.

    Args:
        client: The async cv-api client instance.
        preselect_target: Optional target to pre-highlight on mount.
        preselect_app: Optional application name to pre-fill the NAME arg.
        preselect_args: Optional mapping of arg name to value for pre-filling non-NAME inputs.
    """

    BINDINGS = [
        Binding("escape", "clear_selection", "Clear"),
        Binding("r", "refresh_targets", "Refresh"),
        Binding("j", "list_cursor_down", "Down", show=False),
        Binding("k", "list_cursor_up", "Up", show=False),
    ]

    CSS = """
    .provider-badge {
        height: 1;
        margin: 0 0 1 0;
        padding: 0 1;
    }
    """

    def __init__(
        self,
        client: CvApiClient,
        preselect_target: str = "",
        preselect_app: str = "",
        preselect_args: dict[str, str] | None = None,
        **kwargs: Any,
    ) -> None:
        super().__init__(**kwargs)
        self._client = client
        self._preselect_target = preselect_target
        self._preselect_app = preselect_app
        self._preselect_args: dict[str, str] = preselect_args or {}
        self._targets: list[Target] = []
        self._selected: Target | None = None
        self._app_names: list[tuple[str, str]] = []

    def compose(self) -> ComposeResult:
        yield Header()
        with Horizontal(id="actions-layout"):
            yield ListView(id="target-list-view")
            with Vertical(id="action-panel"):
                yield Static("Select a target from the list.", id="action-header")
                yield Static("", id="arg-inputs")
                yield Button("Run", id="btn-run", variant="success", disabled=True)
                yield Label("", id="provider-label", classes="provider-badge")
                yield OutputPanel(id="action-output")
        yield Footer()

    def on_mount(self) -> None:
        self.query_one("#target-list-view", ListView).focus()
        self.run_worker(self._load(), exclusive=True)

    def action_refresh_targets(self) -> None:
        self.run_worker(self._load(), exclusive=True)

    def action_clear_selection(self) -> None:
        self._selected = None
        list_view = self.query_one("#target-list-view", ListView)
        list_view.index = None
        self.query_one("#action-header", Static).update("Select a target from the list.")
        self.query_one("#arg-inputs").remove_children()
        self.query_one("#btn-run", Button).disabled = True

    def action_list_cursor_down(self) -> None:
        self.query_one("#target-list-view", ListView).action_cursor_down()

    def action_list_cursor_up(self) -> None:
        self.query_one("#target-list-view", ListView).action_cursor_up()

    async def _load(self) -> None:
        try:
            self._targets = await self._client.list_targets()
            apps = await self._client.list_applications()
            self._app_names = [(a.name, a.name) for a in apps]
            self._render_target_list()
            if self._preselect_target:
                match = next((t for t in self._targets if t.name == self._preselect_target), None)
                if match:
                    self._select_target(match)
                    self._scroll_to_target(match)
        except Exception as exc:
            self.query_one("#target-list-view", ListView).mount(
                ListItem(Label(f"[red]Error: {exc}[/red]"))
            )

    def _render_target_list(self) -> None:
        by_category: dict[str, list[Target]] = {}
        for t in self._targets:
            by_category.setdefault(t.category, []).append(t)

        list_view = self.query_one("#target-list-view", ListView)
        list_view.clear()

        for category in sorted(by_category):
            list_view.mount(Label(category, classes="target-category-title"))
            for target in sorted(by_category[category], key=lambda t: t.name):
                list_view.mount(ListItem(Label(target.name), id=_item_id(target.name)))

    def _scroll_to_target(self, target: Target) -> None:
        list_view = self.query_one("#target-list-view", ListView)
        item_id = _item_id(target.name)
        try:
            item = self.query_one(f"#{item_id}", ListItem)
            children = [c for c in list_view.children if isinstance(c, ListItem)]
            if item in children:
                list_view.index = children.index(item)
        except Exception:
            pass

    def on_list_view_selected(self, event: ListView.Selected) -> None:
        item_id = event.item.id
        if not item_id or not item_id.startswith("item-"):
            return
        raw_name = item_id[len("item-") :]
        match = next(
            (t for t in self._targets if _item_id(t.name) == item_id),
            None,
        )
        if match is None:
            match = next((t for t in self._targets if t.name == raw_name), None)
        if match:
            self._select_target(match)

    def _select_target(self, target: Target) -> None:
        self._selected = target
        self.query_one("#action-header", Static).update(
            f"[bold lavender]{target.name}[/bold lavender]  [dim]{target.description}[/dim]"
        )
        self._build_arg_inputs(target)
        self.query_one("#btn-run", Button).disabled = False

    def _build_arg_inputs(self, target: Target) -> None:
        container = self.query_one("#arg-inputs")
        container.remove_children()

        if not target.args:
            return

        for arg in target.args:
            container.mount(Label(arg, classes="arg-label"))
            if arg.upper() == "NAME" and self._app_names:
                sel: Select[str] = Select(
                    self._app_names,
                    id=f"arg-{arg}",
                    prompt="Select application...",
                )
                if self._preselect_app:
                    sel.value = self._preselect_app
                container.mount(sel)
            else:
                input_widget = Input(placeholder=arg, id=f"arg-{arg}")
                if arg in self._preselect_args:
                    input_widget.value = self._preselect_args[arg]
                container.mount(input_widget)

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "btn-run" and self._selected:
            args = self._collect_args()
            self.run_worker(self._run_action(self._selected, args), exclusive=True)

    def _collect_args(self) -> dict[str, str]:
        if self._selected is None:
            return {}
        result: dict[str, str] = {}
        for arg in self._selected.args:
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
        return result

    def _detect_provider(self, text: str) -> str | None:
        lower = text.lower()
        if "gemini" in lower:
            return "[bold yellow]Provider: Gemini[/bold yellow]"
        if "claude" in lower or "anthropic" in lower:
            return "[bold lavender]Provider: Claude[/bold lavender]"
        if "openai" in lower or "gpt" in lower:
            return "[bold green]Provider: OpenAI[/bold green]"
        if "mistral" in lower:
            return "[bold peach]Provider: Mistral[/bold peach]"
        if "ollama" in lower:
            return "[bold cyan]Provider: Ollama (local)[/bold cyan]"
        return None

    async def _run_action(self, target: Target, args: dict[str, str]) -> None:
        output = self.query_one("#action-output", OutputPanel)
        provider_label = self.query_one("#provider-label", Label)
        output.clear()
        provider_label.update("")
        output.append(f"Running: {target.name}  args={args}\n\n")

        provider_found: bool = False
        app_name = args.pop("NAME", "")
        try:
            async for raw in self._client.stream_action(target.name, app=app_name):
                try:
                    msg = json.loads(raw)
                    msg_type = msg.get("type", "")
                    data = msg.get("data", "")
                    if msg_type in ("stdout", "stderr"):
                        output.append(data)
                        if not provider_found:
                            badge = self._detect_provider(data)
                            if badge is not None:
                                provider_label.update(badge)
                                provider_found = True
                    elif msg_type == "exit":
                        output.append(f"\n[bold]Exit code: {data}[/bold]")
                    elif msg_type == "error":
                        output.append(f"\n[red]Error: {data}[/red]")
                except json.JSONDecodeError:
                    output.append(raw)
        except Exception as exc:
            output.append(f"\n[red]Stream error: {exc}[/red]")
            try:
                result = await self._client.execute_action(
                    target.name, app=app_name, args=args or None
                )
                text = result.stdout or ""
                if result.stderr:
                    text += f"\n{result.stderr}"
                output.append(text)
                output.append(f"\n[bold]Exit code: {result.exit_code}[/bold]")
            except Exception as fallback_exc:
                output.append(f"\n[red]Fallback failed: {fallback_exc}[/red]")
