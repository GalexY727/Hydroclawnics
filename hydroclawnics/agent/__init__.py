"""Hydroclawnics agent package.

Loads .env files (repo-root and package-local) for convenience when running agents directly.
"""

from __future__ import annotations

try:
    from hydroclawnics.env import load_env_files
except ModuleNotFoundError:
    from env import load_env_files  # type: ignore[import-not-found]

load_env_files()
