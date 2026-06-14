from __future__ import annotations

import asyncio
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Awaitable, Callable

BASE_DIR = Path(__file__).resolve().parent
DECISIONS_FILE = BASE_DIR / "memory" / "decisions.jsonl"

SYSTEM_PROMPT = """\
You are Hydroclawnics, an autonomous hydroponics crop-care agent.
Reason about TRENDS first, then current sensor values. A rising/falling trend near a crop limit is early warning; a current value outside target range is an act-now condition.
Separate decisions clearly:
- ACT NOW when pH, EC, or water temperature is outside the crop target range, or severity is critical.
- MONITOR when values are still in range but trends are moving toward an upper/lower limit.
When a trend has stayed consistent for more than 10 history readings, reference time context in plain language, e.g. "pH has been rising for ~20 minutes."
Use crop targets exactly:
- lettuce: pH 5.5-6.5, EC 1000-1500 ppm, water temp 18-24 C
- tomato: pH 5.8-6.8, EC 1800-2800 ppm, water temp 20-24 C
- basil: pH 5.8-6.6, EC 1000-1400 ppm, water temp 20-24 C
- spinach: pH 6.0-7.0, EC 900-1300 ppm, water temp 16-20 C
Prefer the least disruptive corrective action that returns the metric toward the middle of its target range. Do not treat stable in-range readings as faults.
"""
AGENT_SYSTEM_PROMPT = SYSTEM_PROMPT

CROP_TARGETS: dict[str, dict[str, tuple[float, float]]] = {
    "lettuce": {"ph": (5.5, 6.5), "ec_ppm": (1000.0, 1500.0), "water_temp_c": (18.0, 24.0)},
    "tomato": {"ph": (5.8, 6.8), "ec_ppm": (1800.0, 2800.0), "water_temp_c": (20.0, 24.0)},
    "basil": {"ph": (5.8, 6.6), "ec_ppm": (1000.0, 1400.0), "water_temp_c": (20.0, 24.0)},
    "spinach": {"ph": (6.0, 7.0), "ec_ppm": (900.0, 1300.0), "water_temp_c": (16.0, 20.0)},
}

_TREND_METRICS = (("ph", "ph"), ("ec_ppm", "ec"), ("water_temp_c", "water_temp"))


async def tail_decisions(broadcast_fn: Callable[[dict], Awaitable[None]]) -> None:
    offset = 0
    while True:
        try:
            if DECISIONS_FILE.exists():
                with DECISIONS_FILE.open("r", encoding="utf-8") as fp:
                    fp.seek(offset)
                    for line in fp:
                        stripped = line.strip()
                        if not stripped:
                            continue
                        try:
                            entry = json.loads(stripped)
                        except json.JSONDecodeError:
                            continue
                        await broadcast_fn(entry)
                    offset = fp.tell()
        except FileNotFoundError:
            pass
        await asyncio.sleep(1)


def format_pod_context(pod: dict[str, Any], trends: dict[str, Any] | None, history: list[dict[str, Any]] | None) -> str:
    crop = str(pod.get("crop", "lettuce")).lower()
    targets = CROP_TARGETS.get(crop, CROP_TARGETS["lettuce"])
    severity = pod.get("severity") or pod.get("plant_status") or pod.get("status") or "unknown"
    history_rows = list(history or [])

    return "\n".join(
        [
            f"POD {pod.get('id', '?')} | crop: {crop} | severity: {severity}",
            (
                f"CURRENT: ph={_fmt_value(_metric_value(pod, 'ph'))}, "
                f"ec={_fmt_value(_metric_value(pod, 'ec_ppm'))}ppm, "
                f"water_temp={_fmt_value(_metric_value(pod, 'water_temp_c'))}°C, "
                f"humidity={_fmt_value(_metric_value(pod, 'relative_humidity_percent'))}%, "
                f"level={_fmt_value(_metric_value(pod, 'water_level_percent'))}%"
            ),
            f"TRENDS:  {_format_trend_line(trends or {}, history_rows)}",
            (
                f"TARGET:  ph[{_fmt_range(targets['ph'])}], "
                f"ec[{_fmt_range(targets['ec_ppm'])}ppm], "
                f"water_temp[{_fmt_range(targets['water_temp_c'])}°C]"
            ),
            f"STATUS:  {_format_status(pod, trends or {}, targets)}",
        ]
    )


def _metric_value(pod: dict[str, Any], metric: str) -> Any:
    if metric == "ec_ppm":
        return pod.get("ec_ppm", pod.get("ec"))
    if metric == "water_temp_c":
        return pod.get("water_temp_c", pod.get("temp_c", pod.get("air_temp_c")))
    if metric == "relative_humidity_percent":
        return pod.get("relative_humidity_percent", pod.get("humidity_pct"))
    if metric == "water_level_percent":
        return pod.get("water_level_percent", pod.get("water_level"))
    return pod.get(metric)


def _fmt_value(value: Any) -> str:
    if value is None:
        return "N/A"
    try:
        number = float(value)
    except (TypeError, ValueError):
        return str(value)
    return f"{number:.2f}".rstrip("0").rstrip(".")


def _fmt_delta(value: Any) -> str:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return "+0"
    if abs(number) < 0.005:
        number = 0.0
    return f"{number:+.2f}".rstrip("0").rstrip(".")


def _fmt_range(target: tuple[float, float]) -> str:
    return f"{_fmt_value(target[0])}-{_fmt_value(target[1])}"


def _format_trend_line(trends: dict[str, Any], history: list[dict[str, Any]]) -> str:
    parts: list[str] = []
    for metric, label in _TREND_METRICS:
        trend = trends.get(metric, {})
        direction = trend.get("trend", "stable") if isinstance(trend, dict) else "stable"
        if direction == "rising":
            symbol = f"↑{_fmt_delta(trend.get('delta'))}"
        elif direction == "falling":
            symbol = f"↓{_fmt_delta(trend.get('delta'))}"
        else:
            symbol = "↔"
        duration = _consistent_trend_duration(metric, direction, history)
        suffix = f" {duration}" if duration else ""
        parts.append(f"{label} {symbol} ({direction}{suffix})")
    return ", ".join(parts)


def _consistent_trend_duration(metric: str, direction: str, history: list[dict[str, Any]]) -> str:
    if direction not in {"rising", "falling"} or len(history) <= 10:
        return ""

    expected_sign = 1 if direction == "rising" else -1
    run = [history[-1]]
    for previous, current in zip(reversed(history[:-1]), reversed(history[1:])):
        try:
            delta = float(current.get(metric, 0.0)) - float(previous.get(metric, 0.0))
        except (TypeError, ValueError):
            break
        if delta == 0 or (1 if delta > 0 else -1) != expected_sign:
            break
        run.append(previous)

    if len(run) <= 10:
        return ""

    newer = _parse_timestamp(run[0].get("timestamp"))
    older = _parse_timestamp(run[-1].get("timestamp"))
    if newer is None or older is None:
        return ""

    minutes = max(1, round(abs((newer - older).total_seconds()) / 60))
    return f"{minutes}min"


def _parse_timestamp(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def _format_status(
    pod: dict[str, Any],
    trends: dict[str, Any],
    targets: dict[str, tuple[float, float]],
) -> str:
    messages: list[str] = []
    for metric, label in _TREND_METRICS:
        value = _metric_value(pod, metric)
        try:
            number = float(value)
        except (TypeError, ValueError):
            continue
        lo, hi = targets[metric]
        trend = trends.get(metric, {})
        direction = trend.get("trend", "stable") if isinstance(trend, dict) else "stable"
        span = hi - lo
        margin = span * 0.15
        if number < lo:
            messages.append(f"{label} below target")
        elif number > hi:
            messages.append(f"{label} elevated")
        elif direction == "rising" and number >= hi - margin:
            messages.append(f"{label} approaching upper limit")
        elif direction == "falling" and number <= lo + margin:
            messages.append(f"{label} approaching lower limit")

    return ", ".join(messages) if messages else "within target range; monitor trends"
