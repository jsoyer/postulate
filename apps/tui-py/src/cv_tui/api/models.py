"""Pydantic v2 models mirroring the cv-api Go structs."""

from datetime import datetime

from pydantic import BaseModel, Field


class Application(BaseModel):
    """A single job application."""

    name: str
    company: str
    position: str
    status: str
    created_at: datetime
    deadline: datetime | None = None
    outcome: str | None = None
    files: dict[str, str] | None = None


class Target(BaseModel):
    """An allowed Make target exposed by cv-api."""

    name: str
    category: str
    description: str
    args: list[str] = Field(default_factory=list)
    timeout: str | None = None


class ActionResult(BaseModel):
    """Result of a Make target execution."""

    job_id: str
    target: str
    status: str
    exit_code: int
    stdout: str | None = None
    stderr: str | None = None
    duration_ms: int = Field(alias="duration_ms", default=0)

    model_config = {"populate_by_name": True}


class TimelineEntry(BaseModel):
    """A single point in the application timeline."""

    date: str
    count: int


class DashboardData(BaseModel):
    """Aggregated dashboard information."""

    total_applications: int
    by_status: dict[str, int]
    recent_applications: list[Application]


class StatsData(BaseModel):
    """Pipeline statistics."""

    funnel: dict[str, int]
    timeline: list[TimelineEntry] = Field(default_factory=list)


class APIError(Exception):
    """Raised when cv-api returns a non-2xx response."""

    def __init__(self, status_code: int, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.message = message
