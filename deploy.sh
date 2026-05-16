#!/bin/bash
set -e

echo "Pulling latest code..."
cd /home/ubuntu/Hydroclawnics-Simulation
git pull origin main

echo "Installing dependencies..."
pip install -r hydroclawnics/requirements.txt --quiet

echo "Writing .env..."
cat > hydroclawnics/.env << EOF
NVIDIA_API_KEY=${NVIDIA_API_KEY}
ZONE_A_TYPE=real
ZONE_B_TYPE=simulated
ZONE_C_TYPE=simulated
POLL_INTERVAL_SECONDS=60
DB_PATH=/home/ubuntu/Hydroclawnics-Simulation/hydroclawnics/hydro_log.db
DASHBOARD_PORT=8080
EOF

echo "Stopping existing processes..."
pkill -f "supervisor.py" 2>/dev/null || true
pkill -f "zone_agent.py" 2>/dev/null || true
pkill -f "dashboard/app.py" 2>/dev/null || true

sleep 2

echo "Starting agents..."
mkdir -p hydroclawnics/logs
nohup python hydroclawnics/agent/supervisor.py >> hydroclawnics/logs/supervisor.log 2>&1 &
nohup python hydroclawnics/agent/zone_agent.py --zone a >> hydroclawnics/logs/zone_a.log 2>&1 &
nohup python hydroclawnics/agent/zone_agent.py --zone b >> hydroclawnics/logs/zone_b.log 2>&1 &
nohup python hydroclawnics/agent/zone_agent.py --zone c >> hydroclawnics/logs/zone_c.log 2>&1 &
nohup streamlit run hydroclawnics/dashboard/app.py --server.port 8080 >> hydroclawnics/logs/dashboard.log 2>&1 &

echo "Deploy complete."
pgrep -a -f "zone_agent\|supervisor\|dashboard"