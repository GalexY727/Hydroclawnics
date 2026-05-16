# /home/ubuntu/Hydroclawnics-Simulation/deploy.sh
#!/bin/bash
set -e

echo "Pulling latest code..."
cd /home/ubuntu/Hydroclawnics-Simulation
git pull origin main

echo "Installing dependencies..."
pip install -r requirements.txt --quiet

echo "Writing .env..."
cat > .env << EOF
NVIDIA_API_KEY=${NVIDIA_API_KEY}
ZONE_A_TYPE=real
ZONE_B_TYPE=simulated
ZONE_C_TYPE=simulated
POLL_INTERVAL_SECONDS=60
DB_PATH=/home/ubuntu/Hydroclawnics-Simulation/hydro_log.db
DASHBOARD_PORT=8080
EOF

echo "Restarting agents..."
screen -S supervisor -X quit 2>/dev/null || true
screen -S zone_a     -X quit 2>/dev/null || true
screen -S zone_b     -X quit 2>/dev/null || true
screen -S zone_c     -X quit 2>/dev/null || true
screen -S dashboard  -X quit 2>/dev/null || true

sleep 2

screen -dmS supervisor python agent/supervisor.py
screen -dmS zone_a    python agent/zone_agent.py --zone a
screen -dmS zone_b    python agent/zone_agent.py --zone b
screen -dmS zone_c    python agent/zone_agent.py --zone c
screen -dmS dashboard streamlit run dashboard/app.py --server.port 8080

echo "Deploy complete. Running sessions:"
screen -ls