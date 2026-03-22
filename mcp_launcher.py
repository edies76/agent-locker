"""
Stable launcher for Claude Desktop MCP.

Why this exists:
- Some MCP hosts start Python without honoring cwd/module resolution consistently.
- `python -m mcp_server` can fail with "No module named mcp_server" in that case.

This launcher ensures the repository root is on sys.path and then starts
Agent-Lock's MCP gateway entrypoint.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent

# Force deterministic import resolution regardless of host working directory.
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# Keep runtime artifacts (like relative logs paths) anchored at project root.
os.chdir(ROOT)

from mcp_server.server import main  # noqa: E402


if __name__ == "__main__":
    main()
