from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import agent_bridge
import state
from simulator import SimulatorEngine, inject_fault

BASE_DIR = Path(__file__).resolve().parent
FRONTEND_DIST = BASE_DIR / "frontend" / "dist"
logger = logging.getLogger("hydroclawnics.websocket")


class FaultRequest(BaseModel):
    fault: str


class ActionRequest(BaseModel):
    timestamp: str
    pod_id: str
    sensor_state: dict
    diagnosis: str
    action: str
    reasoning: str


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


def remove_client(client: WebSocket) -> None:
    clients.discard(client)
    client_locks.pop(client, None)


async def broadcast(message: dict) -> None:
    if not clients:
        return
    stale: list[WebSocket] = []
    payload = json.dumps(message)
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
            return {"ok": True, "pod": pod_id, "fault": body.fault}
    raise HTTPException(status_code=404, detail="Pod not found")


@app.post("/api/action")
async def post_action(body: ActionRequest) -> dict:
    entry = body.model_dump()
    state.append_decision(entry)
    agent_bridge.DECISIONS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with agent_bridge.DECISIONS_FILE.open("a", encoding="utf-8") as fp:
        fp.write(json.dumps(entry) + "\n")
    await broadcast({"type": "agent_decision", "entry": entry})
    return {"ok": True}


if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")


@app.get("/{full_path:path}")
async def spa_fallback(full_path: str) -> FileResponse:
    index_path = FRONTEND_DIST / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    raise HTTPException(status_code=404, detail="Frontend build not found")
