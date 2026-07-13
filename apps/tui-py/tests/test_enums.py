"""Tests for ApplicationStatus enum."""

from __future__ import annotations

from cv_tui.api.enums import ApplicationStatus


class TestApplicationStatusValues:
    """Verify each member has the expected string value."""

    def test_applied_value(self) -> None:
        assert ApplicationStatus.APPLIED == "applied"

    def test_interview_value(self) -> None:
        assert ApplicationStatus.INTERVIEW == "interview"

    def test_offer_value(self) -> None:
        assert ApplicationStatus.OFFER == "offer"

    def test_accepted_value(self) -> None:
        assert ApplicationStatus.ACCEPTED == "accepted"

    def test_rejected_value(self) -> None:
        assert ApplicationStatus.REJECTED == "rejected"

    def test_ghosted_value(self) -> None:
        assert ApplicationStatus.GHOSTED == "ghosted"

    def test_archived_value(self) -> None:
        assert ApplicationStatus.ARCHIVED == "archived"

    def test_is_str_subclass(self) -> None:
        assert isinstance(ApplicationStatus.APPLIED, str)

    def test_equality_with_string(self) -> None:
        assert ApplicationStatus.APPLIED == "applied"

    def test_all_members_count(self) -> None:
        assert len(ApplicationStatus) == 7


class TestPipelineOrder:
    """Verify pipeline_order() returns a correctly ordered full list."""

    def test_returns_list(self) -> None:
        assert isinstance(ApplicationStatus.pipeline_order(), list)

    def test_length(self) -> None:
        assert len(ApplicationStatus.pipeline_order()) == 7

    def test_first_is_applied(self) -> None:
        assert ApplicationStatus.pipeline_order()[0] == ApplicationStatus.APPLIED

    def test_contains_all_statuses(self) -> None:
        order = ApplicationStatus.pipeline_order()
        for status in ApplicationStatus:
            assert status in order

    def test_applied_before_interview(self) -> None:
        order = ApplicationStatus.pipeline_order()
        assert order.index(ApplicationStatus.APPLIED) < order.index(
            ApplicationStatus.INTERVIEW
        )

    def test_interview_before_offer(self) -> None:
        order = ApplicationStatus.pipeline_order()
        assert order.index(ApplicationStatus.INTERVIEW) < order.index(
            ApplicationStatus.OFFER
        )


class TestKanbanColumns:
    """Verify kanban_columns() returns the correct five-column subset."""

    def test_returns_list(self) -> None:
        assert isinstance(ApplicationStatus.kanban_columns(), list)

    def test_length(self) -> None:
        assert len(ApplicationStatus.kanban_columns()) == 5

    def test_contains_applied(self) -> None:
        assert ApplicationStatus.APPLIED in ApplicationStatus.kanban_columns()

    def test_contains_interview(self) -> None:
        assert ApplicationStatus.INTERVIEW in ApplicationStatus.kanban_columns()

    def test_contains_offer(self) -> None:
        assert ApplicationStatus.OFFER in ApplicationStatus.kanban_columns()

    def test_contains_rejected(self) -> None:
        assert ApplicationStatus.REJECTED in ApplicationStatus.kanban_columns()

    def test_contains_ghosted(self) -> None:
        assert ApplicationStatus.GHOSTED in ApplicationStatus.kanban_columns()

    def test_does_not_contain_accepted(self) -> None:
        assert ApplicationStatus.ACCEPTED not in ApplicationStatus.kanban_columns()

    def test_does_not_contain_archived(self) -> None:
        assert ApplicationStatus.ARCHIVED not in ApplicationStatus.kanban_columns()
