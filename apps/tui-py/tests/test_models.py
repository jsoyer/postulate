"""Unit tests for Pydantic models in cv_tui.api.models."""

from __future__ import annotations

from datetime import datetime

import pytest
from pydantic import ValidationError

from cv_tui.api.models import (
    ActionResult,
    APIError,
    Application,
    DashboardData,
    StatsData,
    Target,
    TimelineEntry,
)


class TestApplication:
    def test_full_fields(self) -> None:
        app = Application.model_validate(
            {
                "name": "acme-swe",
                "company": "Acme",
                "position": "Software Engineer",
                "status": "applied",
                "created_at": "2024-01-15T10:00:00Z",
                "deadline": "2024-02-01T00:00:00Z",
                "outcome": "rejected",
                "files": {"cv": "/path/cv.pdf", "cover": "/path/cover.pdf"},
            }
        )
        assert app.name == "acme-swe"
        assert app.company == "Acme"
        assert app.position == "Software Engineer"
        assert app.status == "applied"
        assert isinstance(app.created_at, datetime)
        assert app.deadline is not None
        assert app.outcome == "rejected"
        assert app.files == {"cv": "/path/cv.pdf", "cover": "/path/cover.pdf"}

    def test_minimal_fields(self) -> None:
        app = Application.model_validate(
            {
                "name": "minimal-app",
                "company": "Corp",
                "position": "Dev",
                "status": "draft",
                "created_at": "2024-03-01T12:00:00Z",
            }
        )
        assert app.deadline is None
        assert app.outcome is None
        assert app.files is None

    def test_missing_required_raises(self) -> None:
        with pytest.raises(ValidationError) as exc_info:
            Application.model_validate(
                {
                    "company": "Acme",
                    "position": "Dev",
                    "status": "applied",
                    "created_at": "2024-01-15T10:00:00Z",
                }
            )
        errors = exc_info.value.errors()
        missing_fields = {e["loc"][0] for e in errors}
        assert "name" in missing_fields

    def test_datetime_parsed_from_iso_string(self) -> None:
        app = Application.model_validate(
            {
                "name": "x",
                "company": "X",
                "position": "Y",
                "status": "applied",
                "created_at": "2024-06-15T08:30:00Z",
            }
        )
        assert app.created_at.year == 2024
        assert app.created_at.month == 6
        assert app.created_at.day == 15
        assert app.created_at.tzinfo is not None

    def test_invalid_datetime_raises(self) -> None:
        with pytest.raises(ValidationError):
            Application.model_validate(
                {
                    "name": "x",
                    "company": "X",
                    "position": "Y",
                    "status": "applied",
                    "created_at": "not-a-date",
                }
            )

    def test_files_dict_accepts_string_values(self) -> None:
        app = Application.model_validate(
            {
                "name": "x",
                "company": "X",
                "position": "Y",
                "status": "applied",
                "created_at": "2024-01-01T00:00:00Z",
                "files": {"cv": "cv.pdf"},
            }
        )
        assert app.files is not None
        assert app.files["cv"] == "cv.pdf"


class TestTarget:
    def test_with_args(self) -> None:
        target = Target.model_validate(
            {
                "name": "tailor",
                "category": "cv",
                "description": "Tailor CV to job",
                "args": ["NAME", "THEME"],
                "timeout": "120s",
            }
        )
        assert target.name == "tailor"
        assert target.category == "cv"
        assert target.args == ["NAME", "THEME"]
        assert target.timeout == "120s"

    def test_args_defaults_to_empty_list(self) -> None:
        target = Target.model_validate(
            {
                "name": "build",
                "category": "general",
                "description": "Build project",
            }
        )
        assert target.args == []
        assert target.timeout is None

    def test_missing_required_raises(self) -> None:
        with pytest.raises(ValidationError):
            Target.model_validate({"name": "build", "category": "general"})


class TestActionResult:
    def test_full_fields(self) -> None:
        result = ActionResult.model_validate(
            {
                "job_id": "abc123",
                "target": "tailor",
                "status": "completed",
                "exit_code": 0,
                "stdout": "Done",
                "stderr": None,
                "duration_ms": 1234,
            }
        )
        assert result.job_id == "abc123"
        assert result.target == "tailor"
        assert result.status == "completed"
        assert result.exit_code == 0
        assert result.stdout == "Done"
        assert result.stderr is None
        assert result.duration_ms == 1234

    def test_duration_ms_alias(self) -> None:
        result = ActionResult.model_validate(
            {
                "job_id": "xyz",
                "target": "build",
                "status": "failed",
                "exit_code": 1,
                "duration_ms": 500,
            }
        )
        assert result.duration_ms == 500

    def test_duration_ms_defaults_to_zero(self) -> None:
        result = ActionResult.model_validate(
            {
                "job_id": "xyz",
                "target": "build",
                "status": "failed",
                "exit_code": 1,
            }
        )
        assert result.duration_ms == 0

    def test_stdout_stderr_optional_none(self) -> None:
        result = ActionResult.model_validate(
            {
                "job_id": "j1",
                "target": "t",
                "status": "completed",
                "exit_code": 0,
            }
        )
        assert result.stdout is None
        assert result.stderr is None

    def test_non_zero_exit_code(self) -> None:
        result = ActionResult.model_validate(
            {
                "job_id": "j2",
                "target": "t",
                "status": "failed",
                "exit_code": 2,
                "stderr": "command not found",
            }
        )
        assert result.exit_code == 2
        assert result.stderr == "command not found"


class TestDashboardData:
    def test_full_structure(self) -> None:
        app_data = {
            "name": "acme-swe",
            "company": "Acme",
            "position": "SWE",
            "status": "applied",
            "created_at": "2024-01-15T10:00:00Z",
        }
        dashboard = DashboardData.model_validate(
            {
                "total_applications": 5,
                "by_status": {"applied": 3, "interview": 2},
                "recent_applications": [app_data],
            }
        )
        assert dashboard.total_applications == 5
        assert dashboard.by_status["applied"] == 3
        assert dashboard.by_status["interview"] == 2
        assert len(dashboard.recent_applications) == 1
        assert isinstance(dashboard.recent_applications[0], Application)

    def test_empty_recent_applications(self) -> None:
        dashboard = DashboardData.model_validate(
            {
                "total_applications": 0,
                "by_status": {},
                "recent_applications": [],
            }
        )
        assert dashboard.total_applications == 0
        assert dashboard.recent_applications == []

    def test_missing_required_raises(self) -> None:
        with pytest.raises(ValidationError):
            DashboardData.model_validate({"total_applications": 0})

    def test_nested_application_validated(self) -> None:
        dashboard = DashboardData.model_validate(
            {
                "total_applications": 1,
                "by_status": {"applied": 1},
                "recent_applications": [
                    {
                        "name": "corp-dev",
                        "company": "Corp",
                        "position": "Dev",
                        "status": "applied",
                        "created_at": "2024-05-01T00:00:00Z",
                        "files": {"cv": "resume.pdf"},
                    }
                ],
            }
        )
        nested = dashboard.recent_applications[0]
        assert nested.files == {"cv": "resume.pdf"}


class TestStatsData:
    def test_with_timeline(self) -> None:
        stats = StatsData.model_validate(
            {
                "funnel": {"applied": 5, "interview": 2, "offer": 1},
                "timeline": [
                    {"date": "2024-01-15", "count": 2},
                    {"date": "2024-01-22", "count": 3},
                ],
            }
        )
        assert stats.funnel["applied"] == 5
        assert len(stats.timeline) == 2
        assert isinstance(stats.timeline[0], TimelineEntry)
        assert stats.timeline[0].date == "2024-01-15"
        assert stats.timeline[1].count == 3

    def test_timeline_defaults_to_empty(self) -> None:
        stats = StatsData.model_validate({"funnel": {"applied": 1}})
        assert stats.timeline == []

    def test_missing_funnel_raises(self) -> None:
        with pytest.raises(ValidationError):
            StatsData.model_validate({"timeline": []})

    def test_funnel_empty_dict(self) -> None:
        stats = StatsData.model_validate({"funnel": {}})
        assert stats.funnel == {}


class TestTimelineEntry:
    def test_valid(self) -> None:
        entry = TimelineEntry.model_validate({"date": "2024-01-01", "count": 3})
        assert entry.date == "2024-01-01"
        assert entry.count == 3

    def test_missing_fields_raise(self) -> None:
        with pytest.raises(ValidationError):
            TimelineEntry.model_validate({"date": "2024-01-01"})


class TestAPIError:
    def test_status_code_attribute(self) -> None:
        err = APIError(404, "not found")
        assert err.status_code == 404

    def test_message_attribute(self) -> None:
        err = APIError(500, "internal server error")
        assert err.message == "internal server error"

    def test_str_representation(self) -> None:
        err = APIError(403, "forbidden")
        assert str(err) == "forbidden"

    def test_isinstance_exception(self) -> None:
        err = APIError(400, "bad request")
        assert isinstance(err, Exception)

    def test_can_be_raised_and_caught(self) -> None:
        with pytest.raises(APIError) as exc_info:
            raise APIError(422, "unprocessable entity")
        assert exc_info.value.status_code == 422
        assert exc_info.value.message == "unprocessable entity"

    def test_can_be_caught_as_exception(self) -> None:
        caught: Exception | None = None
        try:
            raise APIError(503, "service unavailable")
        except Exception as exc:
            caught = exc
        assert caught is not None
        assert isinstance(caught, APIError)
