"""Configuration loader for cv-tui.

Reads ~/.config/cv/config.toml (shared with cv-tui-go and cv-tui-rs),
then applies environment variable overrides.
"""

from __future__ import annotations

import contextlib
import os
import tomllib
from pathlib import Path
from typing import Any

from platformdirs import user_config_dir

_DEFAULTS: dict[str, Any] = {
    "api": {
        "base_url": "http://localhost:3001",
        "api_key": "",
        "timeout": 30.0,
    },
    "ui": {
        "theme": "catppuccin-mocha",
        "date_format": "%Y-%m-%d",
    },
}


def load_config(path: str | None = None) -> dict[str, Any]:
    """Load configuration from a TOML file with env-var overrides.

    Lookup order:
    1. File at *path* (if given).
    2. ~/.config/cv/config.toml
    3. Built-in defaults.

    Environment overrides (applied after file):
    - ``CV_API_URL``  overrides ``api.base_url``
    - ``CV_API_KEY``  overrides ``api.api_key``
    - ``CV_TIMEOUT``  overrides ``api.timeout``

    Args:
        path: Explicit path to a TOML config file, or None.

    Returns:
        Merged configuration dict with at least ``api`` and ``ui`` sections.
    """
    cfg: dict[str, Any] = _deep_merge({}, _DEFAULTS)

    resolved = Path(path) if path else Path(user_config_dir("cv")) / "config.toml"
    if resolved.is_file():
        with resolved.open("rb") as fh:
            file_cfg = tomllib.load(fh)
        cfg = _deep_merge(cfg, file_cfg)

    # Environment overrides
    if url := os.environ.get("CV_API_URL"):
        cfg.setdefault("api", {})["base_url"] = url
    if key := os.environ.get("CV_API_KEY"):
        cfg.setdefault("api", {})["api_key"] = key
    if raw_timeout := os.environ.get("CV_TIMEOUT"):
        with contextlib.suppress(ValueError):
            cfg.setdefault("api", {})["timeout"] = float(raw_timeout)

    return cfg


def _deep_merge(base: dict[str, Any], override: dict[str, Any]) -> dict[str, Any]:
    """Recursively merge *override* into a copy of *base*.

    Args:
        base: The base dictionary.
        override: Values that take precedence.

    Returns:
        A new merged dictionary.
    """
    result = dict(base)
    for key, value in override.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = _deep_merge(result[key], value)
        else:
            result[key] = value
    return result
