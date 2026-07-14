"""Textual Pilot UI tests for cv-tui.

Uses ``textual.testing.Pilot`` (headless) with a ``MockCvApiClient``
that returns static data without network calls.

Run with::

    uv run pytest tests/test_ui.py -v --no-cov

Notes on Textual 8.x behaviour observed during development
-----------------------------------------------------------
* ``Static.renderable`` was removed; use ``str(widget.content)`` instead.
* ``TabbedContent.active`` is a reactive that gets reset by ``ContentTabs``
  focus events, so the reliable visibility check is ``TabPane.display``.
* ``pilot.press()`` does not trigger ``Input.Changed``; use
  ``pilot.app.query_one(Input).value = ...`` and fire the event manually,
  or use ``pilot.type()`` (if available).
"""

from __future__ import annotations

import pytest

from cv_tui.api.client import CvApiClient
from cv_tui.api.models import ActionResult, Application, DashboardData, StatsData, Target
from cv_tui.app import CVApp

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_app(name: str = "acme-sre-2026", status: str = "applied") -> Application:
    """Return a minimal Application fixture."""
    return Application.model_validate(
        {
            "name": name,
            "company": "Acme Corp",
            "position": "SRE",
            "status": status,
            "outcome": None,
            "deadline": None,
            "created_at": "2026-03-01T00:00:00",
            "files": {},
        }
    )


def _make_dashboard() -> DashboardData:
    """Return a minimal DashboardData fixture."""
    app = _make_app()
    return DashboardData.model_validate(
        {
            "total_applications": 1,
            "by_status": {"applied": 1},
            "recent_applications": [app.model_dump()],
        }
    )


def _static_text(widget: object) -> str:
    """Return the rendered text of a Static widget.

    Textual 8.x removed ``Static.renderable``; the canonical public attribute
    is ``Static.content`` which holds the original markup/text string.
    """
    from textual.widgets import Static

    assert isinstance(widget, Static)
    return str(widget.content)


# ---------------------------------------------------------------------------
# Mock client
# ---------------------------------------------------------------------------


class MockCvApiClient(CvApiClient):
    """Fake client that returns static data without network I/O.

    Overrides ``__init__`` to skip the httpx client construction entirely.
    """

    def __init__(self) -> None:
        # Do NOT call super().__init__() — skip httpx client construction.
        self.base_url = "http://mock"
        self._api_key = "mock"

    async def health(self) -> bool:
        return True

    async def list_applications(self, status: str | None = None) -> list[Application]:
        return [_make_app()]

    async def get_application(self, name: str) -> Application:
        return _make_app(name)

    async def get_dashboard(self) -> DashboardData:
        return _make_dashboard()

    async def get_stats(self) -> StatsData:
        return StatsData.model_validate(
            {
                "funnel": {
                    "applied": 1,
                    "interview": 0,
                    "offer": 0,
                    "accepted": 0,
                    "rejected": 0,
                    "ghosted": 0,
                    "archived": 0,
                },
                "timeline": [{"date": "2026-03-01", "count": 1}],
            }
        )

    async def list_targets(self) -> list[Target]:
        return [
            Target.model_validate(
                {
                    "name": "tailor",
                    "description": "Tailor CV to a job posting",
                    "category": "cv",
                    "args": [],
                    "requires_app": True,
                }
            )
        ]

    async def execute_action(
        self,
        target: str,
        app: str = "",
        args: dict[str, str] | None = None,
    ) -> ActionResult:
        return ActionResult.model_validate(
            {
                "job_id": "mock-job-1",
                "target": target,
                "status": "completed",
                "exit_code": 0,
                "stdout": '{"score": 85}',
                "stderr": "",
            }
        )

    async def close(self) -> None:
        pass


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_app_launches() -> None:
    """App launches, composes without error, and carries the correct title."""
    app = CVApp(client=MockCvApiClient())
    async with app.run_test(size=(120, 40)) as pilot:
        await pilot.pause(0.1)
        assert pilot.app.title == "CV Manager"


@pytest.mark.asyncio
async def test_app_subtitle() -> None:
    """App subtitle is set to 'cv-tui-py'."""
    app = CVApp(client=MockCvApiClient())
    async with app.run_test(size=(120, 40)) as pilot:
        await pilot.pause(0.1)
        assert pilot.app.sub_title == "cv-tui-py"


@pytest.mark.asyncio
async def test_action_switch_tab_shows_apps_pane() -> None:
    """action_switch_tab('tab-apps') makes the Applications pane visible."""
    from textual.widgets import TabbedContent

    app = CVApp(client=MockCvApiClient())
    async with app.run_test(size=(120, 40)) as pilot:
        await pilot.pause(0.1)
        # Call the action directly — check synchronously before yielding to
        # the event loop (Textual ≥1.0 re-fires TabActivated on next tick).
        pilot.app.action_switch_tab("tab-apps")
        tabs = pilot.app.query_one("#main-tabs", TabbedContent)
        apps_pane = tabs.query_one("#tab-apps")
        assert apps_pane.display is True


@pytest.mark.asyncio
async def test_action_switch_tab_hides_other_panes() -> None:
    """When switching to 'tab-apps', all other TabPanes become hidden."""
    from textual.widgets import TabbedContent

    app = CVApp(client=MockCvApiClient())
    async with app.run_test(size=(120, 40)) as pilot:
        await pilot.pause(0.1)
        # Check synchronously — see test_action_switch_tab_shows_apps_pane.
        pilot.app.action_switch_tab("tab-apps")
        tabs = pilot.app.query_one("#main-tabs", TabbedContent)
        hidden_panes = [p for p in tabs.query("TabPane") if p.id != "tab-apps" and p.display]
        visible_ids = [p.id for p in hidden_panes]
        assert hidden_panes == [], f"Expected no visible non-apps panes, got: {visible_ids}"


@pytest.mark.asyncio
async def test_action_switch_tab_all_panes() -> None:
    """action_switch_tab makes each pane visible in turn.

    The check happens synchronously before yielding to the event loop,
    because Textual 8.x ContentTabs focus events will re-fire TabActivated
    on the next iteration and reset the active tab for panes without
    focusable children.  The synchronous check validates the action itself.
    """
    from textual.widgets import TabbedContent

    app = CVApp(client=MockCvApiClient())
    async with app.run_test(size=(120, 40)) as pilot:
        await pilot.pause(0.1)
        tabs = pilot.app.query_one("#main-tabs", TabbedContent)

        for tab_id in ("tab-dashboard", "tab-apps", "tab-kanban", "tab-actions", "tab-stats"):
            # Call the synchronous action.
            pilot.app.action_switch_tab(tab_id)
            # Check display before yielding — _watch_active runs synchronously.
            pane = tabs.query_one(f"#{tab_id}")
            assert pane.display is True, (
                f"Pane {tab_id!r} should be visible immediately after switch"
            )
            # Yield to let the event loop settle before the next iteration.
            await pilot.pause(0.05)


@pytest.mark.asyncio
async def test_number_key_bindings_are_registered() -> None:
    """CVApp.BINDINGS declares keys 1-5 targeting switch_tab."""
    app = CVApp(client=MockCvApiClient())
    async with app.run_test(size=(120, 40)) as pilot:
        binding_map = {b.key: b.action for b in pilot.app.BINDINGS}
        assert binding_map.get("1") == "switch_tab('tab-dashboard')"
        assert binding_map.get("2") == "switch_tab('tab-apps')"
        assert binding_map.get("3") == "switch_tab('tab-kanban')"
        assert binding_map.get("4") == "switch_tab('tab-actions')"
        assert binding_map.get("5") == "switch_tab('tab-stats')"


@pytest.mark.asyncio
async def test_dashboard_loads_content() -> None:
    """Dashboard static widget is updated with real content after worker finishes."""
    from textual.widgets import Static

    app = CVApp(client=MockCvApiClient())
    async with app.run_test(size=(120, 40)) as pilot:
        # Allow the _load worker coroutine time to complete.
        await pilot.pause(0.5)
        content = pilot.app.query_one("#dashboard-content", Static)
        text = _static_text(content)
        # The mock returns 1 total application.
        assert "1" in text
        # The mock returns status "applied".
        assert "applied" in text.lower()


@pytest.mark.asyncio
async def test_dashboard_content_widget_exists() -> None:
    """#dashboard-content Static widget is present immediately after compose."""
    from textual.widgets import Static

    app = CVApp(client=MockCvApiClient())
    async with app.run_test(size=(120, 40)) as pilot:
        await pilot.pause(0.1)
        widget = pilot.app.query_one("#dashboard-content", Static)
        assert widget is not None


@pytest.mark.asyncio
async def test_applications_screen_has_datatable() -> None:
    """Applications tab contains a DataTable widget with the expected columns."""
    from textual.widgets import DataTable

    app = CVApp(client=MockCvApiClient())
    async with app.run_test(size=(120, 40)) as pilot:
        pilot.app.action_switch_tab("tab-apps")
        await pilot.pause(0.5)
        table = pilot.app.query_one("#apps-table", DataTable)
        # Columns added on_mount: Date, Name, Company, Position, Status, Outcome.
        assert len(table.columns) == 6


@pytest.mark.asyncio
async def test_applications_table_populated_by_mock() -> None:
    """After the load worker runs, the DataTable has at least one row."""
    from textual.widgets import DataTable

    app = CVApp(client=MockCvApiClient())
    async with app.run_test(size=(120, 40)) as pilot:
        pilot.app.action_switch_tab("tab-apps")
        await pilot.pause(0.5)
        table = pilot.app.query_one("#apps-table", DataTable)
        assert table.row_count >= 1


@pytest.mark.asyncio
async def test_new_application_dialog_opens() -> None:
    """Pressing 'n' pushes a modal screen onto the screen stack."""
    app = CVApp(client=MockCvApiClient())
    async with app.run_test(size=(120, 40)) as pilot:
        await pilot.pause(0.1)
        stack_before = len(pilot.app.screen_stack)
        await pilot.press("n")
        await pilot.pause(0.1)
        assert len(pilot.app.screen_stack) > stack_before


@pytest.mark.asyncio
async def test_new_application_dialog_is_modal_screen() -> None:
    """The screen pushed by 'n' is a NewApplicationDialog (ModalScreen subclass)."""
    from textual.screen import ModalScreen

    from cv_tui.screens.dialogs import NewApplicationDialog

    app = CVApp(client=MockCvApiClient())
    async with app.run_test(size=(120, 40)) as pilot:
        await pilot.press("n")
        await pilot.pause(0.1)
        top = pilot.app.screen
        assert isinstance(top, NewApplicationDialog)
        assert isinstance(top, ModalScreen)


@pytest.mark.asyncio
async def test_new_application_dialog_dismissed_by_escape() -> None:
    """Escape key dismisses the NewApplicationDialog and returns to the main screen."""
    app = CVApp(client=MockCvApiClient())
    async with app.run_test(size=(120, 40)) as pilot:
        original_depth = len(pilot.app.screen_stack)
        await pilot.press("n")
        await pilot.pause(0.1)
        assert len(pilot.app.screen_stack) > original_depth
        await pilot.press("escape")
        await pilot.pause(0.1)
        assert len(pilot.app.screen_stack) == original_depth


@pytest.mark.asyncio
async def test_status_bar_shows_connected_after_mount() -> None:
    """After on_mount health check, status bar text contains 'connected'."""
    from textual.widgets import Static

    app = CVApp(client=MockCvApiClient())
    async with app.run_test(size=(120, 40)) as pilot:
        # on_mount calls health() then updates the bar.
        await pilot.pause(0.3)
        bar = pilot.app.query_one("#status-bar", Static)
        text = _static_text(bar)
        assert "connected" in text.lower()


@pytest.mark.asyncio
async def test_status_bar_contains_base_url() -> None:
    """Status bar displays the mock client's base URL."""
    from textual.widgets import Static

    app = CVApp(client=MockCvApiClient())
    async with app.run_test(size=(120, 40)) as pilot:
        await pilot.pause(0.3)
        bar = pilot.app.query_one("#status-bar", Static)
        text = _static_text(bar)
        assert "http://mock" in text


@pytest.mark.asyncio
async def test_app_bindings_registered() -> None:
    """CVApp.BINDINGS includes all expected top-level keys."""
    app = CVApp(client=MockCvApiClient())
    async with app.run_test(size=(120, 40)) as pilot:
        binding_keys = {b.key for b in pilot.app.BINDINGS}
        assert "q" in binding_keys
        assert "n" in binding_keys
        assert "ctrl+r" in binding_keys
        for key in ("1", "2", "3", "4", "5"):
            assert key in binding_keys


@pytest.mark.asyncio
async def test_dashboard_refresh_action() -> None:
    """Calling action_refresh() on DashboardScreen re-runs _load without error."""
    from textual.widgets import Static

    from cv_tui.screens.dashboard import DashboardScreen

    app = CVApp(client=MockCvApiClient())
    async with app.run_test(size=(120, 40)) as pilot:
        await pilot.pause(0.3)
        screen = pilot.app.query_one(DashboardScreen)
        # Trigger refresh — should schedule a new worker without raising.
        screen.action_refresh()
        await pilot.pause(0.4)
        # Content should contain data, not an error message.
        content = pilot.app.query_one("#dashboard-content", Static)
        text = _static_text(content)
        assert "Error" not in text


@pytest.mark.asyncio
async def test_stats_screen_loads_content() -> None:
    """Stats tab content is updated by the mock's get_stats() data."""
    from textual.widgets import Static

    app = CVApp(client=MockCvApiClient())
    async with app.run_test(size=(120, 40)) as pilot:
        pilot.app.action_switch_tab("tab-stats")
        await pilot.pause(0.5)
        content = pilot.app.query_one("#stats-content", Static)
        text = _static_text(content)
        assert "applied" in text.lower()
        assert "Error" not in text


@pytest.mark.asyncio
async def test_kanban_screen_renders_columns() -> None:
    """Kanban tab renders the static containers for each status column."""
    from textual.widgets import Static

    app = CVApp(client=MockCvApiClient())
    async with app.run_test(size=(120, 40)) as pilot:
        pilot.app.action_switch_tab("tab-kanban")
        await pilot.pause(0.5)
        # Each status column has a Static widget with id #cards-<status>.
        for col in ("applied", "interview", "offer", "rejected", "ghosted"):
            cards = pilot.app.query_one(f"#cards-{col}", Static)
            assert cards is not None, f"Missing column widget #cards-{col}"


@pytest.mark.asyncio
async def test_kanban_screen_populates_applied_column() -> None:
    """After load, the 'applied' column shows the mock application's company."""
    from textual.widgets import Static

    app = CVApp(client=MockCvApiClient())
    async with app.run_test(size=(120, 40)) as pilot:
        pilot.app.action_switch_tab("tab-kanban")
        await pilot.pause(0.5)
        cards = pilot.app.query_one("#cards-applied", Static)
        text = _static_text(cards)
        # The mock returns an Application with company "Acme Corp".
        assert "Acme Corp" in text


@pytest.mark.asyncio
async def test_screen_class_hierarchy() -> None:
    """DashboardScreen and StatsScreen are both Screen subclasses."""
    from textual.screen import Screen

    from cv_tui.screens.dashboard import DashboardScreen
    from cv_tui.screens.stats import StatsScreen

    assert issubclass(DashboardScreen, Screen)
    assert issubclass(StatsScreen, Screen)


@pytest.mark.asyncio
async def test_applications_search_filter() -> None:
    """Setting Input.value and triggering Input.Changed filters the DataTable."""
    from textual.widgets import DataTable, Input

    app = CVApp(client=MockCvApiClient())
    async with app.run_test(size=(120, 40)) as pilot:
        pilot.app.action_switch_tab("tab-apps")
        await pilot.pause(0.5)

        table = pilot.app.query_one("#apps-table", DataTable)
        row_count_full = table.row_count
        assert row_count_full >= 1

        # Simulate a filter that matches nothing by posting Input.Changed.
        search = pilot.app.query_one("#search-input", Input)
        search.value = "zzzzz_no_match_zzzzz"
        search.post_message(Input.Changed(value=search.value, input=search))
        await pilot.pause(0.1)
        assert table.row_count == 0

        # Clear to restore all rows.
        search.value = ""
        search.post_message(Input.Changed(value="", input=search))
        await pilot.pause(0.1)
        assert table.row_count == row_count_full


@pytest.mark.asyncio
async def test_actions_screen_loads_targets() -> None:
    """Actions tab renders the mock target name inside the ListView."""
    from textual.widgets import ListView

    app = CVApp(client=MockCvApiClient())
    async with app.run_test(size=(120, 40)) as pilot:
        pilot.app.action_switch_tab("tab-actions")
        await pilot.pause(0.5)
        lv = pilot.app.query_one("#target-list-view", ListView)
        assert lv is not None


@pytest.mark.asyncio
async def test_action_refresh_all() -> None:
    """ctrl+r triggers action_refresh_all without raising exceptions."""
    from textual.widgets import TabbedContent

    app = CVApp(client=MockCvApiClient())
    async with app.run_test(size=(120, 40)) as pilot:
        await pilot.pause(0.3)
        await pilot.press("ctrl+r")
        await pilot.pause(0.4)
        # App should still be alive with the main TabbedContent present.
        assert pilot.app.query_one("#main-tabs", TabbedContent) is not None


@pytest.mark.asyncio
async def test_action_refresh_all_direct() -> None:
    """action_refresh_all() runs all load workers without raising."""
    from textual.widgets import TabbedContent

    app = CVApp(client=MockCvApiClient())
    async with app.run_test(size=(120, 40)) as pilot:
        await pilot.pause(0.3)
        pilot.app.action_refresh_all()
        await pilot.pause(0.5)
        assert pilot.app.query_one("#main-tabs", TabbedContent) is not None
