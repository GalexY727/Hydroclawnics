from __future__ import annotations

from collections import deque
from threading import Lock, RLock
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from simulator import Pod

TRACKED_HISTORY_FIELDS = (
    "timestamp",
    "ph",
    "ec_ppm",
    "water_temp_c",
    "air_temp_c",
    "relative_humidity_percent",
    "light_lux",
    "water_level_percent",
    "flow_rate_l_min",
)
TREND_METRICS = TRACKED_HISTORY_FIELDS[1:]

pods: list[Pod] = []
decision_log: list[dict[str, Any]] = []
_decision_lock = Lock()
_history_lock = Lock()
pod_state_lock = RLock()
_pod_history: dict[str, deque[dict[str, Any]]] = {}


def append_decision(entry: dict[str, Any]) -> None:
    with _decision_lock:
        decision_log.append(entry)


def reset_pod_history() -> None:
    with _history_lock:
        _pod_history.clear()


def append_pod_reading(pod: Pod) -> None:
    reading = _reading_from_pod(pod)
    pod_id = str(reading.get("id", ""))
    if not pod_id:
        return

    entry = {field: reading[field] for field in TRACKED_HISTORY_FIELDS}
    with _history_lock:
        history = _pod_history.setdefault(pod_id, deque(maxlen=60))
        history.append(entry)


def get_pod_trends(pod_id: str) -> dict[str, dict[str, float | str]]:
    with _history_lock:
        history = list(_pod_history.get(pod_id, ()))

    if not history:
        return {}

    trends: dict[str, dict[str, float | str]] = {}
    for metric in TREND_METRICS:
        values = [
            float(entry[metric])
            for entry in history[-10:]
            if isinstance(entry.get(metric), (int, float))
        ]
        if not values:
            continue

        current = values[-1]
        baseline_entry = history[-11] if len(history) > 10 else history[0]
        baseline = float(baseline_entry.get(metric, current) or 0.0)
        delta = current - baseline
        threshold = abs(baseline) * 0.02
        if threshold == 0:
            threshold = abs(current) * 0.02

        if delta > threshold:
            label = "rising"
        elif delta < -threshold:
            label = "falling"
        else:
            label = "stable"

        trends[metric] = {
            "current": current,
            "mean10": sum(values) / len(values),
            "delta": delta,
            "trend": label,
        }
    return trends


def _reading_from_pod(pod: Pod) -> dict[str, Any]:
    from datetime import datetime, timezone

    timestamp = getattr(pod, "timestamp", "") or datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    temp_c = float(getattr(pod, "temp_c", 0.0) or 0.0)
    return {
        "id": getattr(pod, "id", ""),
        "timestamp": timestamp,
        "ph": float(getattr(pod, "ph", 0.0) or 0.0),
        "ec_ppm": float(getattr(pod, "ec_ppm", 0.0) or 0.0),
        "water_temp_c": float(getattr(pod, "water_temp_c", temp_c) or 0.0),
        "air_temp_c": float(getattr(pod, "air_temp_c", temp_c) or 0.0),
        "relative_humidity_percent": float(getattr(pod, "relative_humidity_percent", 65.0) or 0.0),
        "light_lux": float(getattr(pod, "light_lux", 0.0) or 0.0),
        "water_level_percent": float(getattr(pod, "water_level_percent", 75.0) or 0.0),
        "flow_rate_l_min": float(getattr(pod, "flow_rate_l_min", 2.4) or 0.0),
    }
