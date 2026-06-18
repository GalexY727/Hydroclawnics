#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$ROOT_DIR/hydroclawnics"
VENV="$ROOT_DIR/.venv"

python -m venv "$VENV"
"$VENV/bin/python" -m pip install --upgrade pip
"$VENV/bin/python" -m pip install -r "$APP_DIR/requirements.txt"

if command -v npm >/dev/null 2>&1; then
  (cd "$APP_DIR/frontend" && npm ci && npm run build)
else
  echo "npm not found; skipping frontend build"
fi

export LLM_PROVIDER="${LLM_PROVIDER:-none}"
export DEMO_MODE="${DEMO_MODE:-true}"
export DEMO_AUTOSTART_AGENTS="${DEMO_AUTOSTART_AGENTS:-true}"
export BACKEND_URL="${BACKEND_URL:-http://localhost:8000}"

exec "$VENV/bin/uvicorn" hydroclawnics.main:app --host 0.0.0.0 --port "${PORT:-8000}"
