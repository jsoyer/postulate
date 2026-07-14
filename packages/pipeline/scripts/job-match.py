#!/usr/bin/env python3
"""
Job Match AI — CV ↔ job compatibility scoring.

Runs BEFORE tailoring to filter out non-relevant offers.

Usage:
    scripts/job-match.py --name APPLICATION_NAME [--ai PROVIDER] [--json] [--threshold N]

Scoring breakdown:
    Skills match     40%  — Required vs available skills
    Experience level 20%  — Years, seniority, domain expertise
    Location/Remote  15%  — Remote-friendly, location match
    Salary range     15%  — Does CV experience justify the salary band
    Culture fit      10%  — Company values vs CV signals

Output:
    applications/{name}/job-match.json  (always saved)
    stdout: human-readable summary or JSON (--json flag)
"""

import argparse
import json
import logging
import os
import re
import sys
import tempfile

log = logging.getLogger(__name__)

try:
    import yaml
except ImportError:
    print("❌ pyyaml required: pip install pyyaml")
    sys.exit(1)

from lib.ai import call_ai, KEY_ENV, VALID_PROVIDERS
from lib.common import load_env, setup_logging, REPO_ROOT


def _atomic_write(path: str, content: str) -> None:
    """Write content atomically using tempfile + os.replace."""
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(os.path.abspath(path)), suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(content)
        os.replace(tmp, path)
    except BaseException:
        os.unlink(tmp)
        raise


def _extract_json(text: str) -> str:
    """Extract JSON content from AI response that may contain markdown fences."""
    match = re.search(r"```json\s*\n(.*?)```", text, re.DOTALL)
    if match:
        return match.group(1).strip()
    match = re.search(r"```\s*\n(.*?)```", text, re.DOTALL)
    if match:
        return match.group(1).strip()
    return text.strip()


def _build_prompt(cv_yaml: str, job_text: str) -> str:
    """Build the AI prompt for job matching analysis."""
    return f"""You are an expert career advisor and recruiter specializing in Sales Engineering, Pre-Sales, and Technical Leadership roles.

Analyze the compatibility between this candidate's CV and the job description below.

### Candidate CV (YAML)

```yaml
{cv_yaml}
```

### Job Description

{job_text}

### Scoring Criteria

Score each dimension from 0-100:

1. **Skills match (40% weight)**: Compare required skills in the job vs skills in the CV. List matched and missing key skills.
2. **Experience level (20% weight)**: Does the candidate's years of experience, seniority level, and domain expertise match the role requirements?
3. **Location/Remote (15% weight)**: Is the role remote-friendly? Does the candidate's location/timezone align with the job requirements?
4. **Salary range (15% weight)**: Based on the candidate's experience level and the role's seniority, does the compensation band seem appropriate? (Score 100 if aligned, lower if there's a significant mismatch)
5. **Culture fit (10% weight)**: Do the candidate's background signals (startup vs enterprise, company size, industry) align with the company's culture?

### Output Format

Return ONLY valid JSON with this exact structure (no markdown fences, no comments):

{{
  "overall_score": <0-100 integer, weighted average>,
  "breakdown": {{
    "skills": {{
      "score": <0-100>,
      "matched": ["skill1", "skill2"],
      "missing": ["skill3", "skill4"]
    }},
    "experience": {{
      "score": <0-100>,
      "notes": "<brief explanation>"
    }},
    "location": {{
      "score": <0-100>,
      "notes": "<brief explanation>"
    }},
    "salary": {{
      "score": <0-100>,
      "notes": "<brief explanation>"
    }},
    "culture": {{
      "score": <0-100>,
      "notes": "<brief explanation>"
    }}
  }},
  "red_flags": ["flag1", "flag2"],
  "recommendation": "proceed" | "caution" | "skip",
  "reasoning": "<2-3 sentence summary>"
}}

### Recommendation Logic
- "proceed": overall_score >= 70 and no critical red flags
- "caution": overall_score between 50-69 OR has 1-2 red flags
- "skip": overall_score < 50 OR has critical red flags (e.g., missing essential skill, location dealbreaker)

Return ONLY the JSON object."""


def _validate_result(result: dict) -> dict:
    """Validate and normalize the AI response."""
    required_keys = {"overall_score", "breakdown", "red_flags", "recommendation", "reasoning"}
    missing = required_keys - set(result.keys())
    if missing:
        raise ValueError(f"Missing required keys: {missing}")

    breakdown = result["breakdown"]
    required_breakdown = {"skills", "experience", "location", "salary", "culture"}
    missing_bd = required_breakdown - set(breakdown.keys())
    if missing_bd:
        raise ValueError(f"Missing breakdown keys: {missing_bd}")

    for key in required_breakdown:
        section = breakdown[key]
        if "score" not in section:
            raise ValueError(f"Missing score in breakdown.{key}")
        score = section["score"]
        if not isinstance(score, (int, float)) or score < 0 or score > 100:
            raise ValueError(f"Invalid score in breakdown.{key}: {score}")

    overall = result["overall_score"]
    if not isinstance(overall, (int, float)):
        raise ValueError(f"Invalid overall_score: {overall}")
    # Clamp to 0-100
    result["overall_score"] = max(0, min(100, int(overall)))

    if result["recommendation"] not in ("proceed", "caution", "skip"):
        raise ValueError(f"Invalid recommendation: {result['recommendation']}")

    if not isinstance(result["red_flags"], list):
        raise ValueError("red_flags must be a list")

    return result


def run_match(app_dir: str, cv_path: str, provider: str, api_key: str | None, model: str | None = None) -> dict:
    """Run the job match analysis. Returns the result dict."""
    job_txt = os.path.join(app_dir, "job.txt")
    if not os.path.exists(job_txt):
        log.error("No job.txt found in %s", app_dir)
        sys.exit(1)

    if not os.path.exists(cv_path):
        log.error("CV file not found: %s", cv_path)
        sys.exit(1)

    with open(cv_path, encoding="utf-8") as f:
        cv_yaml = f.read()

    with open(job_txt, encoding="utf-8") as f:
        job_text = f.read()

    prompt = _build_prompt(cv_yaml, job_text)

    model_label = f" ({model})" if model else ""
    print(f"🤖 Analyzing job match with {provider}{model_label}...", flush=True)

    result_text = call_ai(prompt, provider, api_key, model=model)
    json_text = _extract_json(result_text)

    try:
        result = json.loads(json_text)
    except json.JSONDecodeError as e:
        raw_path = os.path.join(app_dir, "job-match-raw.txt")
        _atomic_write(raw_path, result_text)
        log.error("AI returned invalid JSON: %s", e)
        log.error("Raw output saved to: %s", raw_path)
        sys.exit(1)

    try:
        result = _validate_result(result)
    except ValueError as e:
        log.error("Validation error: %s", e)
        sys.exit(1)

    return result


def _format_terminal(result: dict, threshold: int) -> None:
    """Print human-readable summary to terminal."""
    overall = result["overall_score"]
    rec = result["recommendation"]

    if overall >= 80:
        icon = "🟢"
    elif overall >= threshold:
        icon = "🟡"
    else:
        icon = "🔴"

    print(f"\n{icon} Job Match Score: {overall}/100", flush=True)
    print(f"   Recommendation: {rec.upper()}", flush=True)
    print()

    bd = result["breakdown"]
    weights = {"skills": 40, "experience": 20, "location": 15, "salary": 15, "culture": 10}

    for key, weight in weights.items():
        section = bd[key]
        score = section["score"]
        label = key.capitalize()
        bar = "█" * (score // 10) + "░" * (10 - score // 10)
        print(f"   {label:<12} [{bar}] {score:3d} ({weight}%)", flush=True)
        if "notes" in section:
            print(f"                {section['notes']}", flush=True)

    skills = bd["skills"]
    if skills.get("matched"):
        print(f"\n   ✅ Matched skills: {', '.join(skills['matched'][:10])}", flush=True)
        if len(skills["matched"]) > 10:
            print(f"      +{len(skills['matched']) - 10} more", flush=True)
    if skills.get("missing"):
        print(f"   ❌ Missing skills: {', '.join(skills['missing'][:10])}", flush=True)
        if len(skills["missing"]) > 10:
            print(f"      +{len(skills['missing']) - 10} more", flush=True)

    if result["red_flags"]:
        print(f"\n   🚩 Red flags:", flush=True)
        for flag in result["red_flags"]:
            print(f"      • {flag}", flush=True)

    print(f"\n   💬 {result['reasoning']}", flush=True)
    print()


def main():
    load_env()

    parser = argparse.ArgumentParser(description="Job Match AI — CV ↔ job compatibility scoring")
    parser.add_argument(
        "--name",
        required=True,
        help="Application name (reads from applications/{name}/)",
    )
    parser.add_argument(
        "--ai",
        default=os.environ.get("AI_PROVIDER", "gemini"),
        choices=sorted(VALID_PROVIDERS),
        help="AI provider (default: gemini, or set AI_PROVIDER env var)",
    )
    parser.add_argument(
        "--model",
        default=None,
        help="Override default model",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        dest="json_mode",
        help="Output as JSON (for CI integration)",
    )
    parser.add_argument(
        "--threshold",
        type=int,
        default=60,
        help="Minimum score threshold (default: 60)",
    )
    parser.add_argument(
        "--cv",
        default="data/cv.yml",
        help="Path to master CV YAML (default: data/cv.yml)",
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Enable debug logging",
    )
    args = parser.parse_args()

    log = setup_logging(args.verbose)

    provider = args.ai
    model = args.model or None
    threshold = args.threshold

    app_dir = os.path.join(str(REPO_ROOT), "applications", args.name)
    if not os.path.isdir(app_dir):
        log.error("Application directory not found: %s", app_dir)
        sys.exit(1)

    cv_path = os.path.join(str(REPO_ROOT), args.cv)
    if not os.path.exists(cv_path):
        log.error("CV file not found: %s", cv_path)
        sys.exit(1)

    key_var = KEY_ENV[provider]
    api_key = os.environ.get(key_var) if key_var else None
    if key_var and not api_key:
        log.error("Set %s environment variable", key_var)
        log.error("   export %s=your-key-here", key_var)
        sys.exit(1)

    print(f"📋 Application: {args.name}", flush=True)
    print(f"🤖 Provider: {provider}" + (f" · Model: {model}" if model else ""), flush=True)
    if provider == "ollama":
        host = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
        ollama_model = model or os.environ.get("OLLAMA_MODEL", "llama3")
        print(f"   Host: {host}  Model: {ollama_model}", flush=True)

    result = run_match(app_dir, cv_path, provider, api_key, model)

    output_path = os.path.join(app_dir, "job-match.json")
    _atomic_write(output_path, json.dumps(result, indent=2))

    if args.json_mode:
        print(json.dumps(result, indent=2))
    else:
        _format_terminal(result, threshold)
        print(f"   💾 Saved to: {output_path}", flush=True)

    overall = result["overall_score"]
    rec = result["recommendation"]

    if args.json_mode:
        sys.exit(0 if overall >= threshold else 1)
    else:
        if rec == "skip":
            print(f"⚠️  Recommendation: SKIP this application", flush=True)
            sys.exit(1)
        elif rec == "caution":
            print(f"⚠️  Recommendation: PROCEED WITH CAUTION", flush=True)
        else:
            print(f"✅ Recommendation: PROCEED — good match!", flush=True)


if __name__ == "__main__":
    main()
