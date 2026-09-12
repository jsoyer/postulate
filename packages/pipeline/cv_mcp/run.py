#!/usr/bin/env python3
"""Stdio (default) or HTTP (`--http`) entrypoint. Independent of cwd/PYTHONPATH."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

if __name__ == "__main__":
    if "--http" in sys.argv:
        from cv_mcp.http_server import main
    else:
        from cv_mcp.server import main
    main()
