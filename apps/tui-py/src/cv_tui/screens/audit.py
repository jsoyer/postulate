"""Audit screen — run the `audit` Make target and display structured health results."""

from __future__ import annotations

import json
from typing import Any

from textual.app import ComposeResult
from textual.binding import Binding
from textual.containers import Horizontal, ScrollableContainer, Vertical
from textual.screen import Screen
from textual.widgets import Button, Label, ProgressBar, Select

from cv_tui.api.client import CvApiClient
from cv_tui.api.models import APIError
from cv_tui.widgets.output_panel import OutputPanel

_MetricValue = int | float


class AuditScreen(Screen):  # type: ignore[type-arg]
    """Run the `audit` Make target for a selected application and render the health report.

    Args:
        client: The async cv-api client instance.
    """

    BINDINGS = [
        Binding("r", "run_audit", "Run Audit"),
        Binding("escape", "pop_screen", "Back"),
    ]

    CSS = """
    AuditScreen {
        height: 1fr;
    }
    #audit-scroll {
        height: 1fr;
    }
    #audit-controls {
        height: auto;
        margin: 1 0;
        align: left middle;
    }
    #audit-app-select {
        width: 40;
        margin: 0 1 0 0;
    }
    #btn-audit {
        width: auto;
        margin: 0;
    }
    #score-row {
        height: auto;
        margin: 0 0 1 0;
        align: left middle;
    }
    #score-bar {
        width: 1fr;
    }
    #score-label {
        width: 8;
        text-align: right;
    }
    #metrics-container {
        margin: 1 0;
    }
    .metric-row {
        height: auto;
        margin: 0 0 1 0;
        align: left middle;
    }
    .metric-bar {
        width: 1fr;
    }
    .metric-label {
        width: 16;
        color: $subtext0;
    }
    .metric-value {
        width: 8;
        text-align: right;
    }
    #section-metrics {
        display: none;
    }
    """

    def __init__(self, client: CvApiClient, **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self._client = client
        self._app_names: list[tuple[str, str]] = []

    def compose(self) -> ComposeResult:
        with ScrollableContainer(id="audit-scroll"):
            yield Label("CV Health Audit", classes="section-title")
            with Horizontal(id="audit-controls"):
                yield Select[str](
                    [],
                    id="audit-app-select",
                    prompt="Select application...",
                )
                yield Button("Run Audit", id="btn-audit", variant="success")
            yield Label("Health Score", classes="section-title")
            with Horizontal(id="score-row"):
                yield Label("Overall", classes="funnel-label")
                yield ProgressBar(
                    total=100,
                    id="score-bar",
                    show_percentage=True,
                    show_eta=False,
                )
                yield Label("—", id="score-label", classes="funnel-count")
            with Vertical(id="section-metrics"):
                yield Label("Metrics", classes="section-title")
                yield Vertical(id="metrics-container")
            yield Label("Output", classes="section-title")
            yield OutputPanel(id="audit-output")

    def on_mount(self) -> None:
        self.run_worker(self._load_apps(), exclusive=True)

    async def _load_apps(self) -> None:
        try:
            apps = await self._client.list_applications()
            self._app_names = [(a.name, a.name) for a in apps]
            sel = self.query_one("#audit-app-select", Select)
            sel.set_options(self._app_names)
        except Exception as exc:
            self.notify(f"Failed to load applications: {exc}", severity="error")

    def action_run_audit(self) -> None:
        self.run_worker(self._run_audit(), exclusive=True)

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "btn-audit":
            self.run_worker(self._run_audit(), exclusive=True)

    async def _run_audit(self) -> None:
        sel = self.query_one("#audit-app-select", Select)
        selected = sel.value
        app_name = "" if selected is Select.BLANK else str(selected)

        metrics_section = self.query_one("#section-metrics")
        metrics_section.display = False
        self.query_one("#metrics-container", Vertical).remove_children()

        score_bar = self.query_one("#score-bar", ProgressBar)
        score_bar.update(progress=0)
        self.query_one("#score-label", Label).update("—")

        output = self.query_one("#audit-output", OutputPanel)
        output.clear()
        output.append(f"Running audit for: {app_name or '(no app)'}\n\n")

        stdout_buffer: list[str] = []

        try:
            async for raw in self._client.stream_action("audit", app=app_name):
                try:
                    msg = json.loads(raw)
                    msg_type = msg.get("type", "")
                    data = msg.get("data", "")
                    if msg_type == "stdout":
                        stdout_buffer.append(str(data))
                        output.append(str(data))
                    elif msg_type == "stderr":
                        output.append(str(data))
                    elif msg_type == "exit":
                        output.append(f"\n[bold]Exit code: {data}[/bold]")
                        self._parse_and_render("".join(stdout_buffer))
                    elif msg_type == "error":
                        output.append(f"\n[red]Error: {data}[/red]")
                except json.JSONDecodeError:
                    stdout_buffer.append(raw)
                    output.append(raw)
        except APIError as exc:
            if exc.status_code == 404:
                self.notify("No 'audit' target found in cv-api", severity="warning")
            else:
                output.append(f"\n[red]API error {exc.status_code}: {exc.message}[/red]")
                self._try_fallback(app_name, output, stdout_buffer)
        except Exception as exc:
            output.append(f"\n[red]Stream error: {exc}[/red]")
            self._try_fallback(app_name, output, stdout_buffer)

    def _try_fallback(
        self,
        app_name: str,
        output: OutputPanel,
        stdout_buffer: list[str],
    ) -> None:
        self.run_worker(
            self._fallback_execute(app_name, output, stdout_buffer),
            exclusive=False,
        )

    async def _fallback_execute(
        self,
        app_name: str,
        output: OutputPanel,
        stdout_buffer: list[str],
    ) -> None:
        try:
            result = await self._client.execute_action("audit", app=app_name)
            text = result.stdout or ""
            if result.stderr:
                text += f"\n{result.stderr}"
            stdout_buffer.append(text)
            output.append(text)
            output.append(f"\n[bold]Exit code: {result.exit_code}[/bold]")
            self._parse_and_render("".join(stdout_buffer))
        except APIError as exc:
            if exc.status_code == 404:
                self.notify("No 'audit' target found in cv-api", severity="warning")
            else:
                output.append(f"\n[red]Fallback failed: {exc.message}[/red]")
        except Exception as exc:
            output.append(f"\n[red]Fallback failed: {exc}[/red]")

    def _parse_and_render(self, raw: str) -> None:
        raw = raw.strip()
        if not raw:
            return

        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            return

        if not isinstance(data, dict):
            return

        score_raw = data.get("score")
        if isinstance(score_raw, (int, float)):
            score = int(score_raw)
            bar = self.query_one("#score-bar", ProgressBar)
            bar.update(progress=score)
            self.query_one("#score-label", Label).update(f"{score}%")

        metrics = data.get("metrics")
        if isinstance(metrics, dict) and metrics:
            self._render_metrics(metrics)

        output = self.query_one("#audit-output", OutputPanel)

        duplicates = data.get("duplicates")
        if isinstance(duplicates, list) and duplicates:
            output.append("\n[bold]Duplicates:[/bold]\n")
            for item in duplicates:
                output.append(f"  {item}\n")

        overused = data.get("overused_words")
        if isinstance(overused, list) and overused:
            output.append("\n[bold]Overused words:[/bold]\n")
            for item in overused:
                output.append(f"  {item}\n")

    def _render_metrics(self, metrics: dict[str, Any]) -> None:
        container = self.query_one("#metrics-container", Vertical)
        container.remove_children()

        for metric_name, raw_value in metrics.items():
            if not isinstance(raw_value, (int, float)):
                continue
            value: _MetricValue = raw_value
            display = f"{value:.0f}/100" if isinstance(value, float) else f"{value}/100"
            bar = ProgressBar(
                total=100,
                show_percentage=False,
                show_eta=False,
                classes="metric-bar",
            )
            row = Horizontal(
                Label(metric_name, classes="metric-label"),
                bar,
                Label(display, classes="metric-value"),
                classes="metric-row",
            )
            container.mount(row)
            bar.update(progress=int(value))

        section = self.query_one("#section-metrics")
        section.display = True

    async def _load(self) -> None:
        await self._load_apps()

    def action_pop_screen(self) -> None:
        self.app.pop_screen()
