from __future__ import annotations

import asyncio
import json
import logging
import math
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import agent_bridge
import state
from simulator import SENSORS_FILE, SimulatorEngine, inject_fault

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIST = BASE_DIR / "frontend" / "dist"
logger = logging.getLogger("hydroclawnics.websocket")


class FaultRequest(BaseModel):
    fault: str


class ActionRequest(BaseModel):
    """Legacy typed model kept for supervisor compat — /api/action also accepts raw JSON."""
    timestamp: str = ""
    pod_id: str = ""
    sensor_state: dict = {}
    diagnosis: str = ""
    action: str = ""
    reasoning: str = ""


class ThoughtRequest(BaseModel):
    source: str
    text: str
    ts: str


class SensorDataRequest(BaseModel):
    ph: float
    ec_ppm: float
    temp_c: float
    light_lux: float


app = FastAPI(title="Hydroclawnics")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

engine = SimulatorEngine()
clients: set[WebSocket] = set()
client_locks: dict[WebSocket, asyncio.Lock] = {}
bridge_task: asyncio.Task | None = None


def _apply_agent_tool_to_pod(tool: str, params: dict) -> bool:
    pod_id = params.get("pod_id", "")
    pod = next((candidate for candidate in engine.pods if candidate.id == pod_id), None)
    if pod is None:
        return False

    if tool == "dose_acid":
        amount_ml = float(params.get("amount_ml", 10))
        pod.ph = max(4.0, pod.ph - amount_ml * 0.02)
        pod.last_action = tool
    elif tool == "dose_base":
        amount_ml = float(params.get("amount_ml", 10))
        pod.ph = min(9.0, pod.ph + amount_ml * 0.02)
        pod.last_action = tool
    elif tool == "dose_nutrients":
        amount_ml = float(params.get("amount_ml", 50))
        pod.ec_ppm = min(5000.0, pod.ec_ppm + amount_ml * 1.0)
        pod.last_action = tool
    elif tool == "flush_reservoir":
        flush_pct = float(params.get("flush_percent", 20)) / 100.0
        pod.ec_ppm = max(100.0, pod.ec_ppm * (1.0 - flush_pct))
        pod.last_action = tool
    elif tool in {"turn_fan_on", "set_fan_speed", "turn_cooler_on", "enter_heat_stress_mode"}:
        pod.temp_c = max(12.0, pod.temp_c - 4.0)
        pod.last_action = tool
    elif tool in {"turn_heater_on"}:
        pod.temp_c = min(40.0, pod.temp_c + 4.0)
        pod.last_action = tool
    elif tool == "set_light_level":
        pod.light_lux = max(1000.0, min(60000.0, float(params.get("target_lux", pod.light_lux))))
        pod.last_action = tool
    else:
        return False

    from simulator import compute_status
    pod.status = compute_status(pod)
    if pod.status == "healthy":
        pod.fault_type = "none"
    return True


async def _publish_engine_snapshot() -> None:
    payload = engine.snapshot()
    SENSORS_FILE.parent.mkdir(parents=True, exist_ok=True)
    SENSORS_FILE.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    await broadcast({"type": "pod_update", "pods": payload})


def remove_client(client: WebSocket) -> None:
    clients.discard(client)
    client_locks.pop(client, None)


async def broadcast(message: dict) -> None:
    if not clients:
        return
    from agent.action_log import safe_json_serialize, validate_event
    stale: list[WebSocket] = []
    payload_obj = validate_event(message) if message.get("type") in {
        "agent_cycle_summary", "pod_agent_update", "agent_action",
    } else safe_json_serialize(message)
    payload = json.dumps(payload_obj)
    for client in list(clients):
        try:
            # FIX: Serialize per-client sends so heartbeat and simulator broadcasts cannot race each other.
            async with client_locks.setdefault(client, asyncio.Lock()):
                await client.send_text(payload)
        except Exception:
            stale.append(client)
    for client in stale:
        remove_client(client)


async def on_tick(pods_payload: list[dict]) -> None:
    await broadcast({"type": "pod_update", "pods": pods_payload})


@app.on_event("startup")
async def startup_event() -> None:
    global bridge_task
    engine.add_listener(on_tick)
    await engine.start()
    from agent import message_bus as _mb
    _mb.init_db()

    async def bridge_broadcast(entry: dict) -> None:
        state.append_decision(entry)
        await broadcast({"type": "agent_decision", "entry": entry})

    bridge_task = asyncio.create_task(agent_bridge.tail_decisions(bridge_broadcast), name="decision-tail")


@app.on_event("shutdown")
async def shutdown_event() -> None:
    if bridge_task:
        bridge_task.cancel()
    await engine.stop()


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    await ws.accept()
    clients.add(ws)
    send_lock = asyncio.Lock()
    client_locks[ws] = send_lock

    async def heartbeat_loop() -> None:
        while True:
            await asyncio.sleep(3)
            # FIX: Send a periodic heartbeat so idle clients and proxies keep the socket open.
            async with send_lock:
                await ws.send_json({"type": "heartbeat"})

    async def receive_loop() -> None:
        while True:
            raw_message = await ws.receive_text()
            try:
                json.loads(raw_message)
            except json.JSONDecodeError:
                logger.info("Ignoring non-JSON WebSocket message: %s", raw_message)

    heartbeat_task: asyncio.Task | None = None
    receive_task: asyncio.Task | None = None
    try:
        # FIX: Send initial data immediately, then keep independent heartbeat/receive loops alive.
        async with send_lock:
            await ws.send_json({"type": "pod_update", "pods": engine.snapshot()})
        heartbeat_task = asyncio.create_task(heartbeat_loop(), name="websocket-heartbeat")
        receive_task = asyncio.create_task(receive_loop(), name="websocket-receive")
        done, pending = await asyncio.wait(
            {heartbeat_task, receive_task},
            return_when=asyncio.FIRST_EXCEPTION,
        )
        for task in pending:
            task.cancel()
        for task in done:
            task.result()
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
        remove_client(ws)
    except Exception:
        # FIX: Log unexpected handler failures instead of silently killing the WebSocket.
        logger.exception("Unexpected WebSocket handler failure")
        remove_client(ws)
        raise
    finally:
        remove_client(ws)
        for task in (heartbeat_task, receive_task):
            if task and not task.done():
                task.cancel()


@app.get("/api/pods")
async def get_pods() -> list[dict]:
    return engine.snapshot()


@app.get("/api/pods/{pod_id}")
async def get_pod(pod_id: str) -> dict:
    for pod in engine.snapshot():
        if pod["id"] == pod_id:
            return pod
    raise HTTPException(status_code=404, detail="Pod not found")


@app.post("/api/fault/{pod_id}")
async def post_fault(pod_id: str, body: FaultRequest) -> dict:
    for pod in engine.pods:
        if pod.id == pod_id:
            inject_fault(pod, body.fault)
            await _publish_engine_snapshot()
            return {"ok": True, "pod": pod_id, "fault": body.fault}
    raise HTTPException(status_code=404, detail="Pod not found")


@app.post("/api/sensor_data/{pod_id}")
async def post_sensor_data(pod_id: str, body: SensorDataRequest) -> dict:
    from simulator import compute_status
    for pod in engine.pods:
        if pod.id == pod_id:
            pod.ph = body.ph
            pod.ec_ppm = body.ec_ppm
            pod.temp_c = body.temp_c
            pod.light_lux = body.light_lux
            pod.status = compute_status(pod)
            
            payload = engine.snapshot()
            SENSORS_FILE.parent.mkdir(parents=True, exist_ok=True)
            SENSORS_FILE.write_text(json.dumps(payload, indent=2), encoding="utf-8")
            await broadcast({"type": "pod_update", "pods": payload})
            return {"ok": True, "pod": pod_id}
    raise HTTPException(status_code=404, detail="Pod not found")


@app.post("/api/action")
async def post_action(request: Request) -> dict:
    try:
        entry = await request.json()
    except Exception:
        return {"ok": False, "error": "invalid JSON"}
    state.append_decision(entry)
    if entry.get("type") in {"agent_cycle_summary", "pod_agent_update", "agent_action"}:
        if entry.get("type") == "agent_action":
            tool = entry.get("tool", "")
            params = entry.get("params") or {}
            if tool != "no_op" and isinstance(params, dict) and _apply_agent_tool_to_pod(tool, params):
                await _publish_engine_snapshot()
        if entry.get("type") == "pod_agent_update":
            from agent import action_log as _alog
            await _alog.remember_pod_action(entry)
        await broadcast(entry)
    else:
        await broadcast({"type": "agent_decision", "entry": entry})
    return {"ok": True}


@app.get("/agent/status")
async def agent_status() -> dict:
    import os as _os
    from agent import message_bus as _mb
    pods_per_table = max(1, int(_os.getenv("PODS_PER_TABLE", "100")))
    total_pods = len(engine.pods)
    table_count = max(1, math.ceil(total_pods / pods_per_table))
    table_ids = [f"T{i + 1}" for i in range(table_count)]
    last_cycles = _mb.get_table_last_cycles()
    return {
        "supervisor_last_cycle": _mb.get_supervisor_last_cycle(),
        "table_agents": [
            {
                "table_id": tid,
                "last_cycle": last_cycles.get(tid),
                "pod_count": pods_per_table,
            }
            for tid in table_ids
        ],
        "hardware_mode": _os.getenv("HARDWARE_MODE", "false").lower() == "true",
        "db_path": str(_mb.DB_PATH),
        "total_tables": table_count,
    }


@app.get("/agent/logs")
async def agent_logs() -> list[dict]:
    from agent import message_bus as _mb
    return _mb.get_recent_actions(50)


@app.get("/agent/pod/{pod_id}/reasoning")
async def pod_reasoning(pod_id: str) -> dict:
    from agent import action_log as _alog
    return await _alog.get_pod_reasoning(pod_id)


@app.post("/api/agent/thought")
async def post_agent_thought(body: ThoughtRequest) -> dict:
    await broadcast({"type": "agent_thought", "source": body.source, "text": body.text, "ts": body.ts})
    return {"ok": True}


if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")


@app.get("/{full_path:path}")
async def spa_fallback(full_path: str) -> FileResponse:
    index_path = FRONTEND_DIST / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    raise HTTPException(status_code=404, detail="Frontend build not found")
