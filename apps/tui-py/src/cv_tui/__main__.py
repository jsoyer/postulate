"""Entry point: python -m cv_tui"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys
from pathlib import Path

from cv_tui import __version__
from cv_tui.api.client import CvApiClient
from cv_tui.config import load_config


def _resolve_config_path(path: str | None) -> Path:
    return Path(path) if path else Path.home() / ".config" / "cv" / "config.toml"


def _load_api_params(cfg_path: str | None) -> tuple[str, str, float]:
    cfg = load_config(cfg_path)
    api_cfg = cfg.get("api", {})
    base_url: str = api_cfg.get("base_url", "http://localhost:3001")
    api_key: str = api_cfg.get("api_key", "")
    timeout: float = float(api_cfg.get("timeout", 30.0))
    return base_url, api_key, timeout


async def _health_check(base_url: str, api_key: str, timeout: float) -> bool:
    async with CvApiClient(base_url=base_url, api_key=api_key, timeout=timeout) as client:
        return await client.health()


def _cmd_health(base_url: str, api_key: str, timeout: float, config_path: str) -> None:
    """Print a health report and exit with 0 (connected) or 1 (unreachable).

    Args:
        base_url: The cv-api base URL.
        api_key: The API key used for authentication.
        timeout: Request timeout in seconds.
        config_path: Resolved path string shown in the report.
    """
    connected = asyncio.run(_health_check(base_url, api_key, timeout))
    status = "connected" if connected else "unreachable"

    print("cv-tui health check")
    print("-------------------")
    print(f"Config : {config_path}")
    print(f"API    : {base_url}")
    print(f"Status : {status}")

    sys.exit(0 if connected else 1)


def _warn_if_plaintext_remote(base_url: str) -> None:
    """Warn when a non-local URL uses plaintext HTTP."""
    if not base_url.startswith("http://"):
        return
    from urllib.parse import urlparse

    host = urlparse(base_url).hostname or ""
    if host not in {"localhost", "127.0.0.1", "::1"}:
        print(
            f"Warning: connecting to {base_url} over plaintext HTTP."
            " Your API key will be sent unencrypted. Use HTTPS for remote hosts.",
            file=sys.stderr,
        )


def main() -> None:
    """Parse CLI arguments, load configuration, and dispatch to the requested command."""
    parser = argparse.ArgumentParser(
        prog="cv-tui",
        description="Terminal UI for CV management — powered by cv-api",
    )
    parser.add_argument("--config", default=None, help="Path to config.toml")
    parser.add_argument("--version", action="version", version=f"cv-tui {__version__}")
    parser.add_argument("-v", "--verbose", action="store_true", help="Enable debug logging")

    subparsers = parser.add_subparsers(dest="command")
    subparsers.add_parser("health", help="Print API health report and exit")

    args = parser.parse_args()

    if args.verbose:
        logging.basicConfig(
            level=logging.DEBUG,
            format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        )

    resolved = _resolve_config_path(args.config)
    base_url, api_key, timeout = _load_api_params(args.config)

    _warn_if_plaintext_remote(base_url)

    if args.command == "health":
        _cmd_health(base_url, api_key, timeout, str(resolved))
        return

    if not api_key:
        print(
            "Error: api_key is not set.\nSet it in ~/.config/cv/config.toml or via CV_API_KEY.",
            file=sys.stderr,
        )
        sys.exit(1)

    from cv_tui.app import CVApp

    client = CvApiClient(base_url=base_url, api_key=api_key, timeout=timeout)
    app = CVApp(client=client)
    app.run()


if __name__ == "__main__":
    main()
