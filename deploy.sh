#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="${REPO_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
APP_DIR="$REPO_DIR/hydroclawnics"
VENV="$APP_DIR/.venv"
PYTHON="$VENV/bin/python3"
LOG_DIR="$APP_DIR/logs"
PODS_PER_TABLE="${PODS_PER_TABLE:-100}"
TOTAL_PODS="${TOTAL_PODS:-20}"
LLM_PROVIDER="${LLM_PROVIDER:-none}"
DEMO_MODE="${DEMO_MODE:-true}"
DEMO_AUTOSTART_AGENTS="${DEMO_AUTOSTART_AGENTS:-true}"

case "$LLM_PROVIDER" in
  nvidia)
    DEFAULT_TABLE_MODEL="nvidia/nemotron-3-nano-30b-a3b"
    DEFAULT_SUPERVISOR_MODEL="nvidia/nemotron-3-super-120b-a12b"
    ;;
  ollama)
    DEFAULT_TABLE_MODEL="qwen3:8b"
    DEFAULT_SUPERVISOR_MODEL="qwen3:8b"
    ;;
  *)
    DEFAULT_TABLE_MODEL="deterministic-table-agent"
    DEFAULT_SUPERVISOR_MODEL="deterministic-supervisor"
    ;;
esac

echo "=== Hydroclawnics deploy ==="

mkdir -p "$LOG_DIR"

# Write .env from current environment, defaulting to deterministic demo mode.
cat > "$APP_DIR/.env" <<EOF
LLM_PROVIDER=${LLM_PROVIDER}
LLM_BASE_URL=${LLM_BASE_URL:-}
LLM_API_KEY=${LLM_API_KEY:-${NVIDIA_API_KEY:-}}
NVIDIA_API_KEY=${NVIDIA_API_KEY:-}
DEMO_MODE=${DEMO_MODE}
DEMO_AUTOSTART_AGENTS=${DEMO_AUTOSTART_AGENTS}
HARDWARE_MODE=${HARDWARE_MODE:-false}
ARDUINO_PORT=${ARDUINO_PORT:-/dev/ttyUSB0}
PODS_PER_TABLE=${PODS_PER_TABLE}
TABLE_AGENT_MODEL=${TABLE_AGENT_MODEL:-$DEFAULT_TABLE_MODEL}
SUPERVISOR_MODEL=${SUPERVISOR_MODEL:-$DEFAULT_SUPERVISOR_MODEL}
TABLE_INTERVAL_S=${TABLE_INTERVAL_S:-20}
SUPERVISOR_INTERVAL_S=${SUPERVISOR_INTERVAL_S:-60}
BACKEND_URL=http://localhost:8000
EOF
echo ".env written"

# Load .env into environment
if [[ -f "$APP_DIR/.env" ]]; then
  set -o allexport
  source "$APP_DIR/.env"
  set +o allexport
fi

# Create venv if it doesn't exist (fresh instance)
if [[ ! -d "$VENV" ]]; then
  echo "Creating Python venv..."
  python3 -m venv "$VENV"
fi

echo "Installing Python dependencies..."
"$PYTHON" -m pip install -r "$APP_DIR/requirements.txt" --quiet

echo "Building frontend..."
cd "$APP_DIR/frontend"
npm ci --silent
npm run build
cd "$REPO_DIR"

echo "Stopping existing processes..."
pkill -f "uvicorn main:app"        2>/dev/null || true
pkill -f "agent.table_runner"      2>/dev/null || true
pkill -f "agent.supervisor_runner" 2>/dev/null || true
sleep 1

echo "Starting FastAPI backend..."
nohup "$VENV/bin/uvicorn" hydroclawnics.main:app --host 0.0.0.0 --port 8000 \
  > "$LOG_DIR/backend.log" 2>&1 &
echo "  backend PID $!"
sleep 2  # give backend time to init DB

if [[ "${DEMO_AUTOSTART_AGENTS}" != "true" ]]; then
  TABLE_COUNT=4
  echo "Starting $TABLE_COUNT table agents (PODS_PER_TABLE=$PODS_PER_TABLE)..."
  for i in $(seq 1 "$TABLE_COUNT"); do
    TABLE_ID="T$i"
    nohup "$PYTHON" -m hydroclawnics.agent.table_runner --table-id "$TABLE_ID" \
      > "$LOG_DIR/table_${TABLE_ID}.log" 2>&1 &
    echo "  $TABLE_ID PID $!"
  done

  echo "Starting supervisor..."
  nohup "$PYTHON" -m hydroclawnics.agent.supervisor_runner \
    > "$LOG_DIR/supervisor.log" 2>&1 &
  echo "  supervisor PID $!"
else
  echo "Agent loops autostart inside FastAPI (DEMO_AUTOSTART_AGENTS=true)"
fi

echo ""
echo "=== Deploy complete. Logs in $LOG_DIR/ ==="
pgrep -a -f "uvicorn main:app|agent.table_runner|agent.supervisor_runner" || true
