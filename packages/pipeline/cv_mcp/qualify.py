"""Score a job description against data/preferences.yml."""

from __future__ import annotations

from typing import Any


def qualify_job(job_text: str, preferences: dict[str, Any]) -> dict[str, Any]:
    """Return score 0-100, recommendation apply|review|skip, and reasons.

    Skip on deal-breakers or avoided industries. Boost for preferred
    industry, acceptable remote mode, and acceptable location.
    """
    text = (job_text or "").lower()
    reasons: list[str] = []
    score = 50

    for breaker in preferences.get("deal_breakers") or []:
        needle = str(breaker).lower()
        if needle and needle in text:
            return {
                "score": 10,
                "recommendation": "skip",
                "reasons": [f"deal_breaker: {breaker}"],
            }

    industry = preferences.get("industry") or {}
    for avoided in industry.get("avoid") or []:
        needle = str(avoided).lower()
        if needle and needle in text:
            return {
                "score": 15,
                "recommendation": "skip",
                "reasons": [f"avoid_industry: {avoided}"],
            }

    hits = [
        str(item)
        for item in (industry.get("preferred") or [])
        if str(item).lower() and str(item).lower() in text
    ]
    if hits:
        score += min(30, 10 * len(hits))
        reasons.append("industry_match: " + ", ".join(hits))

    remote = preferences.get("remote") or {}
    remote_ok = [str(item).lower() for item in (remote.get("acceptable") or [])]
    if any(item and item in text for item in remote_ok):
        score += 15
        reasons.append("remote_ok")

    location = preferences.get("location") or {}
    loc_ok = [str(item).lower() for item in (location.get("acceptable") or [])]
    if any(item and item in text for item in loc_ok):
        score += 10
        reasons.append("location_ok")

    score = max(0, min(100, score))
    if score >= 70:
        recommendation = "apply"
    elif score >= 50:
        recommendation = "review"
    else:
        recommendation = "skip"
    return {
        "score": score,
        "recommendation": recommendation,
        "reasons": reasons or ["no_strong_signal"],
    }
