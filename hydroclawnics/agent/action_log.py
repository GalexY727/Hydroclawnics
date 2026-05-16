from __future__ import annotations

import json
import logging
import os
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

from . import message_bus

BASE_DIR = Path(__file__).resolve().parent.parent
LOG_FILE = BASE_DIR / "logs" / "agent_actions.jsonl"
DECISIONS_FILE = BASE_DIR / "memory" / "decisions.jsonl"
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
logger = logging.getLogger(__name__)

VALID_STATUSES = {"healthy", "warning", "critical"}
RESPONSE_SCHEMAS = {
    "agent_cycle_summary": [
        "type", "ts", "cycle_id", "duration_ms", "zones_evaluated",
        "actions_taken", "no_ops", "critical_zones", "warning_zones",
        "summary_text", "actions",
    ],
    "pod_agent_update": [
        "type", "pod_id", "zone_id", "tool", "params",
        "reason", "status", "ts", "cycle_id",
    ],
    "agent_action": [
        "type", "ts", "zone_id", "tool", "params", "result", "reasoning", "cycle_id",
    ],
}

pod_reasoning_history: dict[str, list[dict]] = {}
_history_lock = None


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get_history_lock():
    global _history_lock
    if _history_lock is None:
        import asyncio
        _history_lock = asyncio.Lock()
    return _history_lock


def valid_iso_ts(value: Any) -> str:
    text = value.isoformat() if isinstance(value, datetime) else str(value or "")
    try:
        datetime.fromisoformat(text.replace("Z", "+00:00"))
        return text
    except ValueError:
        return _now()


def truncate_words(value: Any, limit: int) -> str:
    text = " ".join(str(value or "").split())
    if len(text) <= limit:
        return text
    trimmed = text[:limit].rstrip()
    if " " in trimmed:
        trimmed = trimmed.rsplit(" ", 1)[0]
    return trimmed or text[:limit]


def flatten_params(params: Any) -> dict:
    if not isinstance(params, dict):
        return {}
    flat: dict = {}
    for key, value in params.items():
        if value is None:
            continue
        key_text = truncate_words(key, 40)
        if isinstance(value, (str, int, float, bool)):
            flat[key_text] = truncate_words(value, 120) if isinstance(value, str) else value
        else:
            flat[key_text] = truncate_words(value, 120)
    return flat


def sanitize_action(action: dict) -> dict:
    safe = dict(action or {})
    safe["ts"] = valid_iso_ts(safe.get("ts"))
    safe["zone_id"] = truncate_words(safe.get("zone_id") or safe.get("table_id"), 20)
    safe["pod_id"] = truncate_words(safe.get("pod_id") or safe["zone_id"], 20)
    safe["tool"] = truncate_words(safe.get("tool") or "no_op", 40)
    safe["params"] = flatten_params(safe.get("params"))
    safe["reason"] = truncate_words(
        safe.get("reason") or safe.get("reasoning") or safe.get("raw_reasoning") or "",
        120,
    )
    safe["reasoning"] = safe["reason"]
    safe["status"] = str(safe.get("status") or "warning").lower()
    if safe["status"] not in VALID_STATUSES:
        safe["status"] = "warning"
    safe["cycle_id"] = truncate_words(safe.get("cycle_id") or str(uuid4()), 40)
    result = safe.get("result")
    safe["result"] = flatten_params(result) if isinstance(result, dict) else {}
    return safe


def safe_json_serialize(obj: Any) -> dict:
    def default(value: Any) -> str:
        if isinstance(value, datetime):
            return value.isoformat()
        return str(value)

    fallback = {"type": "error", "message": "serialization_failed", "ts": _now()}
    try:
        text = json.dumps(obj, default=default)
        return json.loads(text)
    except Exception:
        logger.warning("Failed to serialize websocket payload", exc_info=True)
        return fallback


def _zero_value(key: str):
    if key in {"actions", "critical_zones", "warning_zones"}:
        return []
    if key in {"params", "result"}:
        return {}
    if key in {"duration_ms", "zones_evaluated", "actions_taken", "no_ops"}:
        return 0
    return ""


def validate_event(event: dict) -> dict:
    safe = safe_json_serialize(event)
    event_type = safe.get("type", "")
    for key in RESPONSE_SCHEMAS.get(event_type, []):
        if key not in safe or safe[key] is None:
            logger.warning("Filling missing websocket field %s on %s", key, event_type)
            safe[key] = _zero_value(key)
    if "ts" in safe:
        safe["ts"] = valid_iso_ts(safe["ts"])
    return safe


def validate_agent_response(raw: str) -> bool:
    text = str(raw or "").strip()
    if len(text) < 20:
        return False
    upper = text.upper()
    if not all(marker in upper for marker in ("ZONE:", "STATUS:", "ACTIONS:")):
        return False
    actions_pos = upper.rfind("ACTIONS:")
    if actions_pos < 0 or not text[actions_pos + len("ACTIONS:"):].strip():
        return False
    if re.search(r"[A-Za-z]{16,}$", text):
        return False
    return True


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

    # Only write supervisor entries to decisions.jsonl; table cycles write their own
    # entry via log_cycle() so per-tool-call writes would cause duplicates/noise.
    if agent_type == "supervisor":
        farm_summary = (entry.get("params") or {}).get("farm_health_summary") or ""
        directive_count = (entry.get("params") or {}).get("directive_count", 0)
        decision = {
            "timestamp": entry["ts"],
            "pod_id": "supervisor",
            "sensor_state": {},
            "diagnosis": truncate_words(farm_summary or "Farm status assessed", 200),
            "action": f"issue_directives ({directive_count})" if directive_count else entry["tool"],
            "reasoning": truncate_words(entry.get("reasoning") or "", 600),
        }
        DECISIONS_FILE.parent.mkdir(parents=True, exist_ok=True)
        with DECISIONS_FILE.open("a", encoding="utf-8") as fp:
            fp.write(json.dumps(decision) + "\n")

    return entry


def _build_decision_entry(
    zone_id: str,
    status: str,
    observations: list[dict],
    actions: list[dict],
    raw_reasoning: str,
    ts: str,
    cycle_id: str = "",
    crop: str | None = None,
) -> dict:
    out_of_range = [
        f"{o.get('param', '')}: {o.get('value', '')} ({o.get('flag', '')})"
        for o in (observations or [])
        if o.get("flag", "").upper() not in ("IN RANGE", "")
    ]
    diagnosis = "; ".join(out_of_range) if out_of_range else "All parameters within range"

    real_actions = [a for a in (actions or []) if a.get("tool") != "no_op"]
    action_str = ", ".join(a.get("tool", "") for a in real_actions) if real_actions else "no_op"

    raw = (raw_reasoning or "").strip()
    if raw and raw not in ("all parameters within range",) and len(raw) > 20:
        reasoning = raw
    elif real_actions:
        reasons = [a.get("reason", "") for a in real_actions if (a.get("reason") or "").strip()]
        reasoning = "; ".join(reasons) if reasons else f"Applied {action_str}."
    else:
        reasoning = "All parameters within range. No intervention needed."

    return {
        "timestamp": ts,
        "pod_id": zone_id,
        "sensor_state": {},
        "diagnosis": truncate_words(diagnosis, 200),
        "action": action_str,
        "reasoning": truncate_words(reasoning, 600),
        "status": status,
        "crop": crop or "",
        "cycle_id": cycle_id,
    }


def _summary_text(actions: list[dict], zones_evaluated: int) -> str:
    count = len([a for a in actions if a.get("tool") != "no_op"])
    if count == 0:
        return f"All {zones_evaluated} zones within range. No intervention needed."
    if count <= 3:
        parts = [
            f"{a.get('tool', '')} on {a.get('zone_id', '')}: {a.get('reason', '')}"
            for a in actions if a.get("tool") != "no_op"
        ]
        return truncate_words("; ".join(parts), 280)
    grouped = Counter(a.get("tool", "action") for a in actions if a.get("tool") != "no_op")
    phrases = [f"{n} {tool.replace('_', ' ')}" for tool, n in grouped.items()]
    zone_count = len({a.get("zone_id", "") for a in actions if a.get("tool") != "no_op"})
    return truncate_words(f"{count} actions across {zone_count} zones: {', '.join(phrases)}.", 280)


async def _remember_pod_action(action: dict) -> None:
    pod_id = action.get("pod_id", "")
    if not pod_id:
        return
    entry = {
        "ts": valid_iso_ts(action.get("ts")),
        "cycle_id": action.get("cycle_id", ""),
        "tool": action.get("tool", ""),
        "params": flatten_params(action.get("params")),
        "reason": action.get("reason", ""),
        "status_at_time": action.get("status", "warning"),
    }
    async with _get_history_lock():
        history = pod_reasoning_history.setdefault(pod_id, [])
        history.append(entry)
        del history[:-20]


async def remember_pod_action(action: dict) -> None:
    await _remember_pod_action(sanitize_action(action))


async def get_pod_reasoning(pod_id: str) -> dict:
    safe_pod_id = truncate_words(pod_id, 20)
    async with _get_history_lock():
        history = list(pod_reasoning_history.get(safe_pod_id, []))[-20:]
    interventions = [entry for entry in history if entry.get("tool") != "no_op"]
    last = history[-1] if history else {}
    return {
        "pod_id": safe_pod_id,
        "history": history,
        "last_action_ts": last.get("ts") if last else None,
        "last_tool": last.get("tool", "") if last else "",
        "total_interventions": len(interventions),
    }


def log_cycle(
    zone_id: str,
    status: str,
    observations: list[dict],
    actions_taken: list[dict],
    raw_reasoning: str,
    cycle_duration_ms: int,
    cycle_id: str | None = None,
    crop: str | None = None,
) -> dict:
    safe_cycle_id = cycle_id or str(uuid4())
    safe_actions = [
        sanitize_action({
            **action,
            "zone_id": zone_id,
            "pod_id": action.get("pod_id") or action.get("params", {}).get("pod_id") or zone_id,
            "status": status,
            "cycle_id": safe_cycle_id,
            "ts": action.get("ts") or _now(),
            "reason": action.get("reason") or raw_reasoning,
        })
        for action in actions_taken
    ]
    if not safe_actions:
        safe_actions = [sanitize_action({
            "zone_id": zone_id,
            "pod_id": zone_id,
            "status": status,
            "cycle_id": safe_cycle_id,
            "tool": "no_op",
            "params": {},
            "reason": raw_reasoning or "all parameters within range",
        })]
    entry = {
        "ts": _now(),
        "cycle_id": safe_cycle_id,
        "zone_id": zone_id,
        "status": sanitize_action({"status": status})["status"],
        "observations": observations,
        "actions_taken": safe_actions,
        "raw_reasoning": raw_reasoning[:500],
        "cycle_duration_ms": cycle_duration_ms,
    }
    LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
    with LOG_FILE.open("a", encoding="utf-8") as fp:
        fp.write(json.dumps(entry) + "\n")
    DECISIONS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with DECISIONS_FILE.open("a", encoding="utf-8") as fp:
        decision = _build_decision_entry(
            zone_id=zone_id,
            status=entry["status"],
            observations=observations,
            actions=safe_actions,
            raw_reasoning=raw_reasoning,
            ts=entry["ts"],
            cycle_id=safe_cycle_id,
            crop=crop,
        )
        fp.write(json.dumps(decision) + "\n")
    return entry


def build_cycle_summary(entry: dict, zones_evaluated: int = 1) -> dict:
    actions = [sanitize_action(action) for action in entry.get("actions_taken", [])]
    real_actions = [action for action in actions if action.get("tool") != "no_op"]
    status = entry.get("status", "warning")
    critical_zones = [entry.get("zone_id", "")] if status == "critical" else []
    warning_zones = [entry.get("zone_id", "")] if status == "warning" else []
    return validate_event({
        "type": "agent_cycle_summary",
        "ts": valid_iso_ts(entry.get("ts")),
        "cycle_id": entry.get("cycle_id", ""),
        "duration_ms": int(entry.get("cycle_duration_ms") or 0),
        "zones_evaluated": zones_evaluated,
        "actions_taken": len(real_actions),
        "no_ops": len(actions) - len(real_actions),
        "critical_zones": [truncate_words(z, 20) for z in critical_zones],
        "warning_zones": [truncate_words(z, 20) for z in warning_zones],
        "summary_text": truncate_words(_summary_text(actions, zones_evaluated), 280),
        "actions": [
            {
                "zone_id": action.get("zone_id", ""),
                "pod_id": action.get("pod_id", ""),
                "tool": action.get("tool", ""),
                "params": action.get("params", {}),
                "reason": action.get("reason", ""),
                "ts": action.get("ts", _now()),
            }
            for action in actions
        ],
    })


def build_agent_action(action: dict) -> dict:
    safe = sanitize_action(action)
    return validate_event({
        "type": "agent_action",
        "ts": safe["ts"],
        "zone_id": safe["zone_id"],
        "tool": safe["tool"],
        "params": safe["params"],
        "result": safe["result"],
        "reasoning": safe["reason"],
        "cycle_id": safe["cycle_id"],
    })


def build_pod_update(action: dict) -> dict:
    safe = sanitize_action(action)
    return validate_event({
        "type": "pod_agent_update",
        "pod_id": safe["pod_id"],
        "zone_id": safe["zone_id"],
        "tool": safe["tool"],
        "params": safe["params"],
        "reason": safe["reason"],
        "status": safe["status"],
        "ts": safe["ts"],
        "cycle_id": safe["cycle_id"],
    })


async def broadcast_action(entry: dict) -> None:
    try:
        import httpx
        async with httpx.AsyncClient(timeout=2.0) as client:
            if entry.get("actions_taken") is not None:
                for action in entry.get("actions_taken", []):
                    safe_action = sanitize_action(action)
                    await _remember_pod_action(safe_action)
                    await client.post(f"{BACKEND_URL}/api/action", json=build_agent_action(safe_action))
                    await client.post(f"{BACKEND_URL}/api/action", json=build_pod_update(safe_action))
                await client.post(f"{BACKEND_URL}/api/action", json=build_cycle_summary(entry))
            else:
                safe_action = sanitize_action(entry)
                await _remember_pod_action(safe_action)
                await client.post(f"{BACKEND_URL}/api/action", json=build_agent_action(safe_action))
    except Exception:
        logger.exception("Failed to broadcast agent action")


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
