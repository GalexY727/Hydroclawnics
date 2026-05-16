#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="/home/ubuntu/Hydroclawnics-Simulation"
APP_DIR="$REPO_DIR/hydroclawnics"
VENV="$APP_DIR/.venv"
LOG_DIR="$APP_DIR/logs"
PODS_PER_TABLE="${PODS_PER_TABLE:-5}"
TOTAL_PODS=20

echo "=== Hydroclawnics deploy ==="

cd "$REPO_DIR"
echo "Pulling latest code..."
git pull origin main

mkdir -p "$LOG_DIR"

# Write .env if NVIDIA_API_KEY is set in the environment
if [[ -n "${NVIDIA_API_KEY:-}" ]]; then
  cat > "$APP_DIR/.env" <<EOF
NVIDIA_API_KEY=${NVIDIA_API_KEY}
HARDWARE_MODE=${HARDWARE_MODE:-false}
ARDUINO_PORT=${ARDUINO_PORT:-/dev/ttyUSB0}
PODS_PER_TABLE=${PODS_PER_TABLE}
TABLE_AGENT_MODEL=${TABLE_AGENT_MODEL:-nvidia/nemotron-nano-4b-v1.1}
SUPERVISOR_MODEL=${SUPERVISOR_MODEL:-nvidia/nemotron-3-super-120b-a12b}
TABLE_INTERVAL_S=${TABLE_INTERVAL_S:-20}
SUPERVISOR_INTERVAL_S=${SUPERVISOR_INTERVAL_S:-60}
BACKEND_URL=http://localhost:8000
EOF
  echo ".env written"
fi

# Load .env into environment
if [[ -f "$APP_DIR/.env" ]]; then
  set -o allexport
  source "$APP_DIR/.env"
  set +o allexport
fi

echo "Installing Python dependencies..."
source "$VENV/bin/activate"
pip install -r "$APP_DIR/requirements.txt" --quiet

echo "Building frontend..."
cd "$APP_DIR/frontend"
npm ci --silent
npm run build
cd "$APP_DIR"

echo "Stopping existing processes..."
pkill -f "uvicorn main:app"        2>/dev/null || true
pkill -f "agent.table_runner"      2>/dev/null || true
pkill -f "agent.supervisor_runner" 2>/dev/null || true
sleep 1

echo "Starting FastAPI backend..."
nohup uvicorn main:app --host 0.0.0.0 --port 8000 \
  > "$LOG_DIR/backend.log" 2>&1 &
echo "  backend PID $!"
sleep 2  # give backend time to init DB

TABLE_COUNT=$(( TOTAL_PODS / PODS_PER_TABLE ))
echo "Starting $TABLE_COUNT table agents (PODS_PER_TABLE=$PODS_PER_TABLE)..."
for i in $(seq 1 "$TABLE_COUNT"); do
  TABLE_ID="T$i"
  nohup python -m agent.table_runner --table-id "$TABLE_ID" \
    > "$LOG_DIR/table_${TABLE_ID}.log" 2>&1 &
  echo "  $TABLE_ID PID $!"
done

echo "Starting supervisor..."
nohup python -m agent.supervisor_runner \
  > "$LOG_DIR/supervisor.log" 2>&1 &
echo "  supervisor PID $!"

echo ""
echo "=== Deploy complete. Logs in $LOG_DIR/ ==="
pgrep -a -f "uvicorn main:app|agent.table_runner|agent.supervisor_runner" || true
