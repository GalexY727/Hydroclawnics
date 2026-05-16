from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path

from . import message_bus

BASE_DIR = Path(__file__).resolve().parent.parent
LOG_FILE = BASE_DIR / "logs" / "agent_actions.jsonl"
DECISIONS_FILE = BASE_DIR / "memory" / "decisions.jsonl"
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def log(
    agent_type: str,
    table_id: str | None,
    tool: str,
    params: dict,
    result: dict,
    reasoning: str | None = None,
) -> dict:
    entry = {
        "ts": _now(),
        "agent_type": agent_type,
        "table_id": table_id,
        "tool": tool,
        "params": params,
        "result": result,
        "reasoning": reasoning,
    }
    message_bus.log_action(agent_type, table_id, tool, params, result, reasoning)
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with LOG_FILE.open("a", encoding="utf-8") as fp:
        fp.write(json.dumps(entry) + "\n")

    decision = {
        "timestamp": entry["ts"],
        "pod_id": entry.get("table_id") or "supervisor",
        "sensor_state": entry.get("params") or {},
        "diagnosis": entry.get("reasoning") or "",
        "action": entry["tool"],
        "reasoning": entry.get("reasoning") or "",
    }
    DECISIONS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with DECISIONS_FILE.open("a", encoding="utf-8") as fp:
        fp.write(json.dumps(decision) + "\n")

    return entry


async def broadcast_action(entry: dict) -> None:
    try:
        import httpx
        async with httpx.AsyncClient(timeout=2.0) as client:
            await client.post(
                f"{BACKEND_URL}/api/action",
                json={
                    "timestamp": entry["ts"],
                    "pod_id": entry.get("table_id") or "supervisor",
                    "sensor_state": entry.get("params") or {},
                    "diagnosis": entry.get("reasoning") or "",
                    "action": entry["tool"],
                    "reasoning": entry.get("reasoning") or "",
                },
            )
    except Exception:
        pass


async def broadcast_thought(text: str, source: str = "supervisor") -> None:
    try:
        import httpx
        async with httpx.AsyncClient(timeout=2.0) as client:
            await client.post(
                f"{BACKEND_URL}/api/agent/thought",
                json={"source": source, "text": text, "ts": _now()},
            )
    except Exception:
        pass


def last_n(n: int = 50) -> list[dict]:
    return message_bus.get_recent_actions(n)
