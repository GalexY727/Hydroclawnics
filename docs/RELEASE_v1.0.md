# Hydroclawnics v1.0 Release Notes

Hydroclawnics v1.0 is the Hack-A-Claw release of a real-time hydroponics farm simulator and AI agent dashboard, built for Hack-A-Claw powered by NVIDIA at UCSC, winning Best Hack for UCSC.

- Devpost: https://nemoclaw.devpost.com | https://shortesthack.com
- Submission: https://devpost.com/software/hydroclawnics 

## What Is Included

- FastAPI backend with live pod simulation, REST endpoints, and WebSocket updates.
- React/Vite dashboard with pod overview, 3D farm view, settings, pod detail modal, agent log, and automation feed.
- 20 simulated hydroponics pods across lettuce, tomato, basil, and spinach.
- Fault injection for pH crash, nutrient spike, and low nutrients.
- NVIDIA-powered table agents and supervisor agent using the OpenAI-compatible NVIDIA API.
- Simulation and optional Arduino hardware routing through `HARDWARE_MODE`.
- SQLite message bus plus sensor snapshots in `hydroclawnics/sensors/pod_states.json` and JSONL action and decision logs.

## Tech Stack

Backend dependencies from `hydroclawnics/requirements.txt`:

```text
fastapi
uvicorn[standard]
websockets
pydantic
openai
httpx
```

Frontend dependencies from `hydroclawnics/frontend/package.json`:

- React `^18.3.1`
- Vite `^8.0.12`
- Tailwind CSS `^3.4.17`
- React Three Fiber `^8.17.10`
- Drei `^9.122.0`
- Plotly/Recharts/Sparklines for charts
- Vitest and ESLint for testing/linting

## Main API Surface

Defined in `hydroclawnics/main.py`:

- `GET /api/pods`
- `GET /api/pods/{pod_id}`
- `POST /api/fault/{pod_id}`
- `POST /api/sensor_data/{pod_id}`
- `POST /api/action`
- `GET /agent/status`
- `GET /agent/logs`
- `GET /agent/pod/{pod_id}/reasoning`
- `POST /api/agent/thought`
- `WS /ws`

## Configuration

Important environment variables:

- `NVIDIA_API_KEY` - required for table and supervisor agents.
- `HARDWARE_MODE` - defaults to `false`; routes tools to Arduino hardware when `true`.
- `ARDUINO_PORT` - defaults to `/dev/ttyUSB0`.
- `BACKEND_URL` - defaults to `http://localhost:8000`, same as frontend on `/`.
- `AGENT_DB_PATH` - defaults to `hydroclawnics/db/nemoclaw.db`.
- `PODS_PER_TABLE` - defaults to `100`.
- `TABLE_AGENT_MODEL` - defaults to `nvidia/nemotron-3-nano-30b-a3b`.
- `SUPERVISOR_MODEL` - defaults to `nvidia/nemotron-3-super-120b-a12b`.
- `TABLE_INTERVAL_S` - defaults to `20`.
- `SUPERVISOR_INTERVAL_S` - defaults to `60`.

## Run Locally

Backend:

```bash
cd hydroclawnics
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Windows activation:

```powershell
.venv\Scripts\Activate
```

Frontend:

```bash
cd hydroclawnics/frontend
npm install
npm run dev
```

Production build:

```bash
cd hydroclawnics/frontend
npm run build
```

After building, FastAPI serves `frontend/dist/` at `/`. See the FastAPI docs at `/docs` on the same host.

## Agent Commands

```bash
cd hydroclawnics
export NVIDIA_API_KEY=your_key_here
python -m agent.table_runner --table-id T1
python -m agent.supervisor_runner
```

Deployment helper:

```bash
./deploy.sh
```

## Known Limitations

- Python dependencies are unpinned.
- `pod_001` is skipped by the simulator because it is reserved for an actual sensor.
- Frontend alert thresholds are stored only in browser `localStorage`.
- CORS is open to all origins for demo convenience.

## Credits

- Created by: Lucas Peterson, Alexander Hamilton, Carmen Tan.
- Built for Hack-A-Claw powered by NVIDIA at UCSC.
- Award: Best Hack for UCSC.
- Lettuce, tomato, basil, spinach, and greens icons credited in `README.md` to Freepik on Flaticon.

## License

MIT License. Copyright (c) 2026 Alexander Hamilton.
