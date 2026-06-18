# Hydroclawnics

Hydroclawnics is a real-time hydroponics farm simulation and agent dashboard. It demonstrates simulated grow pods, WebSocket updates, table-level agents, supervisor logic, corrective tool calls, action logs, and a frontend feed that explains what the system is doing.

The default demo is local-first and free-hostable: it does not require NVIDIA Brev, NVIDIA hosted inference, GPUs, Ollama, or paid cloud inference.

## Architecture Overview

```text
FastAPI backend
  ├─ SimulatorEngine writes pod sensor snapshots
  ├─ WebSocket endpoint streams pod and agent updates
  ├─ Table agents evaluate crop-specific pod ranges
  ├─ Supervisor synthesizes farm-wide status and directives
  └─ SQLite/message bus/action logs preserve agent activity

React frontend
  ├─ 3D farm view and pod detail UI
  ├─ WebSocket-fed pod updates
  └─ Agent reasoning/action feed
```

LLM behavior is selected with `LLM_PROVIDER`:

- `none`: deterministic offline demo, safest for public hosting.
- `ollama`: local OpenAI-compatible Ollama endpoint.
- `nvidia`: optional NVIDIA-hosted compatibility mode.
- `openai`: generic OpenAI-compatible hosted mode.

## Run Locally: Deterministic Demo

From the repository root:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r hydroclawnics/requirements.txt
cp .env.example .env
LLM_PROVIDER=none DEMO_MODE=true DEMO_AUTOSTART_AGENTS=true uvicorn hydroclawnics.main:app --reload
```

On Windows PowerShell:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r hydroclawnics\requirements.txt
Copy-Item .env.example .env
$env:LLM_PROVIDER="none"; $env:DEMO_MODE="true"; $env:DEMO_AUTOSTART_AGENTS="true"
uvicorn hydroclawnics.main:app --reload
```

The backend will serve the built frontend from `hydroclawnics/frontend/dist` when it exists. For frontend development:

```bash
cd hydroclawnics/frontend
npm install
npm run dev
```

## Run Locally With Ollama

Ollama is for local developer demos, not the recommended public free-hosted path.

```bash
ollama serve
ollama pull qwen3:8b
LLM_PROVIDER=ollama \
LLM_BASE_URL=http://localhost:11434/v1 \
LLM_API_KEY=ollama \
TABLE_AGENT_MODEL=qwen3:8b \
SUPERVISOR_MODEL=qwen3:8b \
LLM_ENABLE_THINKING=false \
DEMO_AUTOSTART_AGENTS=true \
uvicorn hydroclawnics.main:app --reload
```

You can also run a single table agent manually:

```bash
LLM_PROVIDER=ollama \
LLM_BASE_URL=http://localhost:11434/v1 \
LLM_API_KEY=ollama \
TABLE_AGENT_MODEL=qwen3:8b \
python -m hydroclawnics.agent.table_runner --table-id T1
```

Recommended starting point: `qwen3:8b` for table agents on a modern laptop with roughly 8-12 GB free RAM. If your machine has more memory, try a larger supervisor model such as `qwen3:14b`. Keep `LLM_ENABLE_THINKING=false` for the UI demo so the feed shows concise operational explanations rather than hidden reasoning traces.

## Optional NVIDIA Mode

NVIDIA hosted inference still works when explicitly configured:

```bash
LLM_PROVIDER=nvidia \
LLM_BASE_URL=https://integrate.api.nvidia.com/v1 \
LLM_API_KEY="$NVIDIA_API_KEY" \
TABLE_AGENT_MODEL=nvidia/nemotron-3-nano-30b-a3b \
SUPERVISOR_MODEL=nvidia/nemotron-3-super-120b-a12b \
uvicorn hydroclawnics.main:app --reload
```

For backward compatibility, `NVIDIA_API_KEY` is used when `LLM_API_KEY` is not set.

## Public Free-Hosted Demo Strategy

Use deterministic mode for public demos:

```bash
LLM_PROVIDER=none
DEMO_MODE=true
DEMO_AUTOSTART_AGENTS=true
```

This lets a single small web process run the simulator, table agents, supervisor summaries, WebSocket updates, and UI feed without paid inference. Build the frontend once (`npm run build`) and serve it from FastAPI, or use the included Dockerfile:

```bash
docker compose up --build
```

Free-tier-friendly hosts should use a normal Python web service command like:

```bash
uvicorn hydroclawnics.main:app --host 0.0.0.0 --port $PORT
```

Do not rely on Ollama for public free hosting unless the host explicitly supports a local model service with enough memory.

## Environment Variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `LLM_PROVIDER` | `none` | `none`, `ollama`, `nvidia`, or `openai`. |
| `LLM_BASE_URL` | provider default | OpenAI-compatible endpoint. |
| `LLM_API_KEY` | provider default | API key; `ollama` can use `ollama`. |
| `NVIDIA_API_KEY` | empty | Backward-compatible NVIDIA key fallback. |
| `TABLE_AGENT_MODEL` | provider default | Model used by table agents. |
| `SUPERVISOR_MODEL` | provider default | Model used by supervisor. |
| `TABLE_INTERVAL_S` | `20` | Seconds between table-agent cycles. |
| `SUPERVISOR_INTERVAL_S` | `60` | Seconds between supervisor cycles. |
| `LLM_ENABLE_THINKING` | `false` | Enables provider-specific reasoning options only where supported. |
| `DEMO_MODE` | `true` when provider is `none` | Marks public/local demo behavior. |
| `DEMO_AUTOSTART_AGENTS` | `DEMO_MODE` | Starts table/supervisor loops inside FastAPI. |
| `BACKEND_URL` | `http://localhost:8000` | URL agents use to post UI updates. |
| `HARDWARE_MODE` | `false` | Uses hardware bridge instead of simulator when true. |

## Tests

```bash
python -m unittest discover hydroclawnics/tests
```

The smoke tests cover provider config without NVIDIA env vars, OpenAI-style tool schemas, deterministic corrective actions, one mock table cycle, and importing/starting the app without `NVIDIA_API_KEY`.

## Troubleshooting

- No agent feed: set `DEMO_AUTOSTART_AGENTS=true`, or run table/supervisor agents manually.
- Ollama connection errors: make sure `ollama serve` is running and `LLM_BASE_URL=http://localhost:11434/v1`.
- NVIDIA auth errors: set `LLM_PROVIDER=nvidia` and either `LLM_API_KEY` or `NVIDIA_API_KEY`.
- Frontend 404 from FastAPI: build the frontend with `cd hydroclawnics/frontend && npm run build`, or use the Vite dev server separately.
- Public host memory limits: use `LLM_PROVIDER=none`; this is the intended free demo path.

## Credits

Lettuce, tomato, basil, spinach, and greens icons by Freepik via Flaticon.
