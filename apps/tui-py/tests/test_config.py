"""Tests for the configuration loader."""

from __future__ import annotations

import copy
from pathlib import Path

import pytest

import cv_tui.config as _config_module
from cv_tui.config import _deep_merge, load_config

_PRISTINE_DEFAULTS = {
    "api": {"base_url": "http://localhost:3001", "api_key": "", "timeout": 30.0},
    "ui": {"theme": "catppuccin-mocha", "date_format": "%Y-%m-%d"},
}


@pytest.fixture(autouse=True)
def _reset_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(_config_module, "_DEFAULTS", copy.deepcopy(_PRISTINE_DEFAULTS))


def test_load_config_defaults() -> None:
    cfg = load_config()
    assert cfg["api"]["base_url"] == "http://localhost:3001"
    assert "ui" in cfg


def test_env_override(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CV_API_URL", "http://test:9999")
    cfg = load_config()
    assert cfg["api"]["base_url"] == "http://test:9999"


def test_env_api_key_override(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CV_API_KEY", "supersecret")
    cfg = load_config()
    assert cfg["api"]["api_key"] == "supersecret"


def test_env_timeout_override(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CV_TIMEOUT", "5.0")
    cfg = load_config()
    assert cfg["api"]["timeout"] == 5.0


def test_env_timeout_invalid_ignored(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("CV_TIMEOUT", raising=False)
    monkeypatch.setenv("CV_TIMEOUT", "bad")
    cfg = load_config()
    assert cfg["api"]["timeout"] == 30.0


def test_deep_merge_nested() -> None:
    base = {"api": {"base_url": "http://localhost", "timeout": 30.0}, "ui": {"theme": "dark"}}
    override = {"api": {"base_url": "http://prod"}}
    result = _deep_merge(base, override)
    assert result["api"]["base_url"] == "http://prod"
    assert result["api"]["timeout"] == 30.0
    assert result["ui"]["theme"] == "dark"


def test_deep_merge_override_wins() -> None:
    base = {"key": "original"}
    override = {"key": "replaced"}
    result = _deep_merge(base, override)
    assert result["key"] == "replaced"


def test_deep_merge_does_not_mutate_base() -> None:
    base = {"api": {"timeout": 10.0}}
    override = {"api": {"timeout": 60.0}}
    _deep_merge(base, override)
    assert base["api"]["timeout"] == 10.0


def test_deep_merge_adds_new_keys() -> None:
    base = {"api": {"base_url": "http://localhost"}}
    override = {"ui": {"theme": "nord"}}
    result = _deep_merge(base, override)
    assert "api" in result
    assert result["ui"]["theme"] == "nord"


def test_load_config_with_file(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("CV_API_URL", raising=False)
    monkeypatch.delenv("CV_API_KEY", raising=False)
    monkeypatch.delenv("CV_TIMEOUT", raising=False)
    config_file = tmp_path / "config.toml"
    config_file.write_text(
        '[api]\nbase_url = "http://custom:8080"\napi_key = "filekey"\n\n[ui]\ntheme = "nord"\n'
    )
    cfg = load_config(str(config_file))
    assert cfg["api"]["base_url"] == "http://custom:8080"
    assert cfg["api"]["api_key"] == "filekey"
    assert cfg["ui"]["theme"] == "nord"
    assert cfg["api"]["timeout"] == 30.0


def test_load_config_file_partial_overrides_defaults(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("CV_API_URL", raising=False)
    monkeypatch.delenv("CV_API_KEY", raising=False)
    monkeypatch.delenv("CV_TIMEOUT", raising=False)
    config_file = tmp_path / "config.toml"
    config_file.write_text("[api]\ntimeout = 10.0\n")
    cfg = load_config(str(config_file))
    assert cfg["api"]["timeout"] == 10.0
    assert cfg["api"]["base_url"] == "http://localhost:3001"
    assert "ui" in cfg


def test_load_config_env_overrides_file(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("CV_TIMEOUT", raising=False)
    config_file = tmp_path / "config.toml"
    config_file.write_text('[api]\nbase_url = "http://from-file:1234"\n')
    monkeypatch.setenv("CV_API_URL", "http://from-env:5678")
    cfg = load_config(str(config_file))
    assert cfg["api"]["base_url"] == "http://from-env:5678"


def test_load_config_missing_file_uses_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("CV_API_URL", raising=False)
    monkeypatch.delenv("CV_API_KEY", raising=False)
    monkeypatch.delenv("CV_TIMEOUT", raising=False)
    cfg = load_config("/nonexistent/path/config.toml")
    assert cfg["api"]["base_url"] == "http://localhost:3001"
    assert cfg["api"]["timeout"] == 30.0
