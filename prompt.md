You are working in the GitHub repository `GalexY727/Hydroclawnics`.

Your task is to migrate Hydroclawnics away from expensive NVIDIA Brev / NVIDIA hosted inference toward a local-first, free-hostable public demo architecture.

## End goal

Hydroclawnics should be easy to run locally and easy to host as a public demo at little or no cost. The public demo should let visitors understand the full system: simulated hydroponics pods, WebSocket updates, table agents, supervisor logic, action logs, reasoning/action feed, and UI.

The demo must not require Brev, NVIDIA hosted inference, or paid cloud inference to be useful.

## Current repo context

The project is a FastAPI + WebSocket backend with a frontend and simulator.

Important files to inspect first:

* `hydroclawnics/main.py`
* `hydroclawnics/agent/supervisor_runner.py`
* `hydroclawnics/agent/table_runner.py`
* `hydroclawnics/agent/tool_registry.py`
* `hydroclawnics/agent/sim_bridge.py`
* `hydroclawnics/agent/bridge_router.py`
* `hydroclawnics/agent/message_bus.py`
* `hydroclawnics/agent/action_log.py`
* `.env.example`
* any README, deploy, Docker, or frontend config files

Known issues / migration targets:

1. `supervisor_runner.py` and `table_runner.py` currently hard-code NVIDIA’s OpenAI-compatible endpoint:
   `https://integrate.api.nvidia.com/v1`

2. They currently require `NVIDIA_API_KEY`.

3. Default models are NVIDIA Nemotron models:

   * supervisor: `nvidia/nemotron-3-super-120b-a12b`
   * table agent: `nvidia/nemotron-3-nano-30b-a3b`

4. `tool_registry.py` already exposes OpenAI-style function tools via `as_openai_tools()`, but verify whether `table_runner.py` actually passes `tools=tools` into `client.chat.completions.create()`. If it does not, fix that.

5. The app already has deterministic fallback repair logic in `table_runner.py`. Preserve and strengthen this because it is important for a no-cost demo where local models may be small or unavailable.

## Implementation objective

Create a clean provider abstraction so Hydroclawnics can run in at least these modes:

### Mode A — fully offline deterministic demo

No LLM required.

The simulator runs, pods drift, faults appear, table/supervisor-like logic produces understandable actions, and the frontend shows the reasoning/action feed.

This must be the safest default for public hosted demos.

Suggested env:

```env
LLM_PROVIDER=none
```

### Mode B — local Ollama demo

Runs locally using Ollama’s OpenAI-compatible API.

Suggested env:

```env
LLM_PROVIDER=ollama
LLM_BASE_URL=http://localhost:11434/v1
LLM_API_KEY=ollama
TABLE_AGENT_MODEL=qwen3:8b
SUPERVISOR_MODEL=qwen3:14b
```

The exact default model names may be adjusted if better local defaults are available, but keep them realistic for consumer hardware.

### Mode C — optional NVIDIA hosted mode

Keep NVIDIA support as an optional compatibility mode, but it must no longer be required.

Suggested env:

```env
LLM_PROVIDER=nvidia
LLM_BASE_URL=https://integrate.api.nvidia.com/v1
LLM_API_KEY=$NVIDIA_API_KEY
TABLE_AGENT_MODEL=nvidia/nemotron-3-nano-30b-a3b
SUPERVISOR_MODEL=nvidia/nemotron-3-super-120b-a12b
```

## Specific tasks

### 1. Add an LLM provider configuration module

Create something like:

```text
hydroclawnics/agent/llm_client.py
```

It should centralize:

* provider selection
* base URL
* API key
* model names
* provider-specific extra request options
* mock/deterministic behavior
* Ollama compatibility settings

Avoid duplicated environment parsing in `table_runner.py` and `supervisor_runner.py`.

Recommended env vars:

```env
LLM_PROVIDER=none|ollama|nvidia|openai
LLM_BASE_URL=
LLM_API_KEY=
TABLE_AGENT_MODEL=
SUPERVISOR_MODEL=
TABLE_INTERVAL_S=20
SUPERVISOR_INTERVAL_S=60
LLM_ENABLE_THINKING=false
DEMO_MODE=true
```

Use backwards compatibility:

* If `NVIDIA_API_KEY` exists and no `LLM_API_KEY` is set, allow it as fallback.
* Do not break existing NVIDIA users.

### 2. Refactor `table_runner.py`

Replace hard-coded NVIDIA base URL and `NVIDIA_API_KEY` checks with the provider abstraction.

Make the table agent work in three paths:

1. Real LLM with native tool calls.
2. Real LLM that returns structured text instead of tool calls.
3. No LLM / mock mode using deterministic fallback repairs.

Requirements:

* Ensure `tools=as_openai_tools()` is actually passed when supported.
* Keep existing parsed-text action fallback.
* Keep `_fallback_range_actions`.
* If the LLM call fails, log the error and use deterministic fallback rather than skipping the cycle.
* Do not expose private chain-of-thought as “reasoning.” Use concise operational explanations such as:
  `pH above target; dosing acid to move toward crop midpoint`.
* For Ollama reasoning models, default to reasoning disabled if possible. Avoid depending on provider-specific hidden reasoning fields.

### 3. Refactor `supervisor_runner.py`

Replace hard-coded NVIDIA setup with the provider abstraction.

The supervisor should work even without an LLM:

* In mock/demo mode, synthesize farm health from table reports and sensor summaries.
* Issue simple high-level directives only when useful.
* Always emit valid JSON-compatible internal structures.
* If the LLM returns malformed JSON, retry once if using a real LLM; if still invalid, fall back to deterministic summary/directives.

Remove or gate NVIDIA-specific request body fields:

```python
extra_body={
    "chat_template_kwargs": {"enable_thinking": True},
    "reasoning_budget": 4096,
}
```

Only send those when `LLM_PROVIDER=nvidia` and `LLM_ENABLE_THINKING=true`.

### 4. Add local hosting / free demo support

Add or update deployment artifacts for low/no-cost hosting.

Preferred approach:

* Backend can run locally with FastAPI.
* Frontend can be statically hosted if possible.
* Public demo can run in deterministic/mock mode without paid inference.

Add one or more of:

* `Dockerfile`
* `docker-compose.yml`
* `deploy.local.sh`
* updated `README.md`
* updated `.env.example`
* optional `render.yaml`, `fly.toml`, or other free-tier-friendly config only if appropriate

Do not assume paid GPUs. Don't make the project be *forced* to use/switch to docker.

The public hosted demo should not require Ollama, because most free web hosts will not run a local LLM. Ollama should be documented primarily for local developer demos.

### 5. Update documentation

Update the README with clear sections:

* What Hydroclawnics demonstrates
* Architecture overview
* Run locally in deterministic demo mode
* Run locally with Ollama
* Optional NVIDIA mode
* Public free-hosted demo strategy
* Environment variables
* Troubleshooting

Include commands similar to:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r hydroclawnics/requirements.txt
cp .env.example .env
LLM_PROVIDER=none DEMO_MODE=true uvicorn hydroclawnics.main:app --reload
```

For Ollama:

```bash
ollama serve
ollama pull qwen3:8b
LLM_PROVIDER=ollama \
LLM_BASE_URL=http://localhost:11434/v1 \
LLM_API_KEY=ollama \
TABLE_AGENT_MODEL=qwen3:8b \
python -m hydroclawnics.agent.table_runner --table-id T1
```

Adjust commands after inspecting the actual package layout.

### 6. Add tests or smoke checks in a new hydroclawnics/tests folder.

Add lightweight checks where practical:

* Provider config loads without NVIDIA env vars.
* Mock provider can produce a table decision.
* `table_runner` can complete a cycle in mock mode.
* Tool registry still returns valid OpenAI-style tools.
* Deterministic fallback produces corrective actions for warning/critical pods.
* App starts without `NVIDIA_API_KEY`.

Do **not** overbuild. Prefer practical smoke tests.

## Engineering standards

* Preserve existing app behavior unless a change is required for the migration.
* Do not remove NVIDIA support; make it optional.
* Do not require paid services for the default demo path.
* Avoid broad rewrites. 
* Make tests quick and to the point.
* Keep changes small, modular, and easy to review.
* Prefer explicit environment variables over hidden magic.
* Add clear logging so users know which provider/mode is active.
* Make failure modes graceful: if LLM is unavailable, demo mode should still work.
* Keep simulator and UI useful without any external network calls.

## Success criteria

The work is complete when:

1. The backend can start without `NVIDIA_API_KEY`.
2. A user can run a meaningful local demo with `LLM_PROVIDER=none`.
3. A user can run local Ollama inference by setting `LLM_BASE_URL=http://localhost:11434/v1`.
4. NVIDIA/Nemotron still works when explicitly configured.
5. Table agents no longer depend on Brev/NVIDIA.
6. Supervisor no longer depends on Brev/NVIDIA.
7. README and `.env.example` clearly document the new modes.
8. The public demo strategy is credible for free/small-project hosting.
9. Any tests/smoke checks added pass.
10. No secrets are committed.

## Suggested final response format

When finished, summarize:

* files changed
* new run modes
* exact commands for mock demo
* exact commands for Ollama demo
* recommended ollama models, context windows, system requirements, etc.
* remaining limitations
* recommended free hosting path
