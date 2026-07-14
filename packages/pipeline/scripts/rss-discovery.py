#!/usr/bin/env python3
"""
RSS Job Discovery — aggregate RSS feeds from job boards and filter by keywords.

Usage:
    scripts/rss-discovery.py --keywords "python,go,remote"
    scripts/rss-discovery.py --keywords "python,go" --location "Remote" --limit 20
    scripts/rss-discovery.py --keywords "python" --json
    scripts/rss-discovery.py --keywords "python" --save /tmp/results.json

Feeds:
    - RemoteOK:      https://remoteok.com/rss
    - WeWorkRemotely: https://weworkremotely.com/categories/remote-jobs/feed
    - HN Jobs:       https://hnrss.org/newest?q=hiring
    - AngelList:     (skipped — no stable RSS)
    - Indeed:        (skipped — no stable RSS)

Handles feed errors gracefully (network timeouts, invalid XML).
Caches results to avoid re-fetching the same jobs.
"""

import argparse
import datetime
import hashlib
import json
import os
import sys
from pathlib import Path

from lib.common import REPO_ROOT, SCRIPTS_DIR, USER_AGENT

try:
    import feedparser
except ImportError:
    print("Missing deps: pip install feedparser")
    sys.exit(1)

try:
    import requests
except ImportError:
    print("Missing deps: pip install requests")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

FEEDS = [
    {
        "name": "remoteok",
        "url": "https://remoteok.com/rss",
    },
    {
        "name": "weworkremotely",
        "url": "https://weworkremotely.com/categories/remote-jobs/feed",
    },
    {
        "name": "hnrss",
        "url": "https://hnrss.org/newest?q=hiring",
    },
]

REQUEST_TIMEOUT = 15  # seconds
CACHE_FILE = SCRIPTS_DIR / ".rss-cache.json"
CACHE_TTL_SECONDS = 3600  # 1 hour

HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "application/rss+xml, application/xml, text/xml, */*",
}


# ---------------------------------------------------------------------------
# Cache helpers
# ---------------------------------------------------------------------------


def load_cache() -> dict:
    """Load the RSS cache from disk."""
    if not CACHE_FILE.exists():
        return {}
    try:
        with open(CACHE_FILE, encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return {}


def save_cache(cache: dict) -> None:
    """Persist the RSS cache to disk."""
    try:
        with open(CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(cache, f, indent=2)
    except OSError:
        pass


def job_id(entry: dict) -> str:
    """Generate a stable ID for a job entry."""
    url = entry.get("link", entry.get("id", ""))
    title = entry.get("title", "")
    raw = f"{url}:{title}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def normalize_text(text: str) -> str:
    """Strip HTML tags and normalize whitespace."""
    import re

    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"&[a-zA-Z]+;", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def extract_company(entry: dict, source: str) -> str:
    """Extract company name from feed entry, source-specific."""
    if source == "remoteok":
        # RemoteOK puts company in tags or description
        tags = entry.get("tags", [])
        for tag in tags:
            label = tag.get("label", "")
            if label and label.lower() not in ("full time", "part time", "contract", "freelance", "remote"):
                return label
        return "Unknown"
    elif source == "weworkremotely":
        # WeWorkRemotely puts company in author or description
        author = entry.get("author", "")
        if author:
            return author
        return "Unknown"
    elif source == "hnrss":
        # HN Jobs: company is often in the title or first line of description
        desc = normalize_text(entry.get("summary", ""))
        # Try to extract company from description
        for pattern in [r"([A-Z][A-Za-z\s&.,'-]+)\s+(?:is|looking for|hiring|seeks)"]:
            import re

            m = re.search(pattern, desc)
            if m:
                return m.group(1).strip()
        return "HN Job"
    return "Unknown"


def extract_location(entry: dict, source: str) -> str:
    """Extract location from feed entry."""
    if source == "remoteok":
        tags = entry.get("tags", [])
        for tag in tags:
            label = tag.get("label", "")
            if label and "remote" in label.lower():
                return "Remote"
        return "Not specified"
    elif source == "weworkremotely":
        return "Remote"
    elif source == "hnrss":
        return "Remote"
    return "Not specified"


def extract_posted(entry: dict) -> str:
    """Extract posted date as ISO string."""
    # Try various date fields
    for field in ("published_parsed", "updated_parsed"):
        parsed = entry.get(field)
        if parsed:
            try:
                return datetime.datetime(*parsed[:6]).strftime("%Y-%m-%d")
            except (TypeError, ValueError):
                pass
    # Fallback: try string fields
    for field in ("published", "updated"):
        raw = entry.get(field, "")
        if raw:
            try:
                dt = datetime.datetime.fromisoformat(raw.replace("Z", "+00:00"))
                return dt.strftime("%Y-%m-%d")
            except (ValueError, AttributeError):
                pass
    return datetime.date.today().isoformat()


# ---------------------------------------------------------------------------
# Feed fetching
# ---------------------------------------------------------------------------


def fetch_feed(feed_cfg: dict, cache: dict) -> list[dict]:
    """Fetch a single RSS feed, using cache if fresh."""
    url = feed_cfg["url"]
    source = feed_cfg["name"]
    now = datetime.datetime.now(datetime.timezone.utc).timestamp()

    # Check cache
    cached = cache.get(url)
    if cached and (now - cached.get("fetched_at", 0)) < CACHE_TTL_SECONDS:
        return cached.get("entries", [])

    # Fetch fresh
    try:
        resp = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        feed = feedparser.parse(resp.content)
    except Exception as e:
        print(f"   Warning: {source} feed failed: {e}", file=sys.stderr)
        return []

    if feed.bozo and not feed.entries:
        print(f"   Warning: {source} feed parse error: {feed.bozo_exception}", file=sys.stderr)
        return []

    entries = []
    for entry in feed.entries:
        entries.append(
            {
                "title": entry.get("title", "").strip(),
                "company": extract_company(entry, source),
                "location": extract_location(entry, source),
                "url": entry.get("link", ""),
                "posted": extract_posted(entry),
                "description_snippet": normalize_text(entry.get("summary", ""))[:300],
                "source": source,
                "id": job_id(entry),
            }
        )

    # Update cache
    cache[url] = {
        "fetched_at": now,
        "entries": entries,
    }

    return entries


# ---------------------------------------------------------------------------
# Keyword / location matching
# ---------------------------------------------------------------------------


def matches_keywords(job: dict, keywords: list[str]) -> list[str]:
    """Return list of matched keywords (empty = no match)."""
    text = f"{job['title']} {job['description_snippet']}".lower()
    matched = [kw for kw in keywords if kw.lower() in text]
    return matched


def matches_location(job: dict, location: str | None) -> bool:
    """Return True if job matches the location filter."""
    if not location:
        return True
    loc_lower = location.lower()
    job_loc = job.get("location", "").lower()
    return loc_lower in job_loc or "remote" in job_loc


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(
        description="RSS Job Discovery — aggregate RSS feeds from job boards.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--keywords",
        required=True,
        help="Comma-separated keywords to filter by (e.g. 'python,go,remote')",
    )
    parser.add_argument(
        "--location",
        default=None,
        help="Optional location filter (e.g. 'Remote', 'Paris')",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=50,
        metavar="N",
        help="Maximum number of results (default: 50)",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output results as JSON",
    )
    parser.add_argument(
        "--save",
        default=None,
        metavar="PATH",
        help="Save results to a file",
    )
    args = parser.parse_args()

    keywords = [kw.strip().lower() for kw in args.keywords.split(",") if kw.strip()]
    if not keywords:
        print("Error: at least one keyword is required", file=sys.stderr)
        return 1

    # Load cache
    cache = load_cache()

    # Fetch all feeds
    all_jobs = []
    sources_checked = 0
    for feed_cfg in FEEDS:
        sources_checked += 1
        entries = fetch_feed(feed_cfg, cache)
        all_jobs.extend(entries)

    # Save cache
    save_cache(cache)

    # Filter by keywords and location
    filtered = []
    for job in all_jobs:
        matched = matches_keywords(job, keywords)
        if not matched:
            continue
        if not matches_location(job, args.location):
            continue
        job["keywords_matched"] = matched
        filtered.append(job)

    # Deduplicate by ID
    seen_ids: set[str] = set()
    unique = []
    for job in filtered:
        if job["id"] not in seen_ids:
            seen_ids.add(job["id"])
            unique.append(job)

    # Apply limit
    unique = unique[: args.limit]

    # Build output
    timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
    output = {
        "jobs": [
            {
                "title": j["title"],
                "company": j["company"],
                "location": j["location"],
                "url": j["url"],
                "posted": j["posted"],
                "description_snippet": j["description_snippet"],
                "keywords_matched": j["keywords_matched"],
                "source": j["source"],
            }
            for j in unique
        ],
        "total": len(unique),
        "sources_checked": sources_checked,
        "timestamp": timestamp,
    }

    # Save to file if requested
    if args.save:
        save_path = Path(args.save)
        save_path.parent.mkdir(parents=True, exist_ok=True)
        with open(save_path, "w", encoding="utf-8") as f:
            json.dump(output, f, indent=2)

    # JSON output
    if args.json:
        print(json.dumps(output, indent=2))
        return 0

    # Human-readable output
    if not unique:
        print(f"No jobs found matching keywords: {', '.join(keywords)}")
        print(f"Sources checked: {sources_checked}")
        return 0

    print(f"RSS Job Discovery — {len(unique)} jobs found")
    print(f"Keywords: {', '.join(keywords)}")
    if args.location:
        print(f"Location: {args.location}")
    print(f"Sources checked: {sources_checked}")
    print()

    for i, job in enumerate(unique, start=1):
        print(f"  {i}. {job['company']} — {job['title']}")
        print(f"     Location: {job['location']}  |  Source: {job['source']}  |  Posted: {job['posted']}")
        print(f"     Matched: {', '.join(job['keywords_matched'])}")
        print(f"     {job['url']}")
        print()

    print(f"Tip: --json for machine output, --save PATH to save results")
    return 0


if __name__ == "__main__":
    sys.exit(main())
