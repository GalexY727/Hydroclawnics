from __future__ import annotations

import os
from pathlib import Path


def _read_env_file(path: Path) -> None:
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def load_env_files() -> None:
    package_dir = Path(__file__).resolve().parent
    repo_dir = package_dir.parent
    _read_env_file(repo_dir / ".env")
    _read_env_file(package_dir / ".env")
