"""Application status and pipeline stage enumerations."""

from __future__ import annotations

from enum import StrEnum


class ApplicationStatus(StrEnum):
    """All known application pipeline statuses."""

    APPLIED = "applied"
    INTERVIEW = "interview"
    OFFER = "offer"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    GHOSTED = "ghosted"
    ARCHIVED = "archived"

    @classmethod
    def pipeline_order(cls) -> list[ApplicationStatus]:
        """Return statuses in funnel display order."""
        return [
            cls.APPLIED,
            cls.INTERVIEW,
            cls.OFFER,
            cls.ACCEPTED,
            cls.REJECTED,
            cls.GHOSTED,
            cls.ARCHIVED,
        ]

    @classmethod
    def kanban_columns(cls) -> list[ApplicationStatus]:
        """Return statuses shown as Kanban columns."""
        return [cls.APPLIED, cls.INTERVIEW, cls.OFFER, cls.REJECTED, cls.GHOSTED]
