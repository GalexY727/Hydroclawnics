from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import re
import time
from datetime import datetime, timezone
from uuid import uuid4

from openai import AsyncOpenAI

from . import action_log as alog
from . import message_bus, sensor_poller, sim_bridge
from .tool_registry import as_openai_tools, execute_tool

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [table/%(name)s] %(levelname)s %(message)s",
)
logger = logging.getLogger("table_runner")

CROP_MAP: dict[str, str] = {
    "T1": "lettuce",
    "T2": "basil",
    "T3": "tomato",
    "T4": "spinach",
}

_TABLE_SYSTEM_PROMPT = """\
You are an autonomous hydroponics farm controller managing a single DWC grow zone.
You receive sensor readings and must make confident, decisive corrective actions.
Do not hedge. Do not say "I need more information." Act immediately on out-of-range readings.

Available tools — Climate: turn_fan_on, turn_fan_off, set_fan_speed, open_vent, close_vent,
  turn_heater_on, turn_heater_off, turn_cooler_on, turn_cooler_off, set_climate_target,
  enter_heat_stress_mode
Humidity: turn_humidifier_on, turn_humidifier_off, turn_dehumidifier_on,
  turn_dehumidifier_off, enter_high_humidity_mode
Nutrients: dose_acid(zone_id, amount_ml), dose_base(zone_id, amount_ml),
  dose_nutrients(zone_id, amount_ml), flush_reservoir(zone_id, flush_percent)

## CROP ASSIGNMENTS
T1=LETTUCE | T2=BASIL | T3=TOMATO | T4=SPINACH

## CROP TARGET RANGES (use exactly — do not infer or guess)

LETTUCE:
  air_temp_c: 18–24°C  |  ph: 5.5–6.2  |  ec_ppm: 560–1260
  humidity_%: 50–70    |  light_lux: 15000–25000  |  water_level_%: min 60%

BASIL:
  air_temp_c: 21–26°C  |  ph: 5.5–6.5  |  ec_ppm: 700–1120
  humidity_%: 40–60    |  light_lux: 20000–40000  |  water_level_%: min 60%

TOMATO:
  air_temp_c: 20–26°C  |  ph: 5.5–6.5  |  ec_ppm: 1400–3500
  humidity_%: 50–70    |  light_lux: 25000–50000  |  water_level_%: min 65%

SPINACH:
  air_temp_c: 15–21°C  |  ph: 6.0–7.0  |  ec_ppm: 1260–1610
  humidity_%: 50–70    |  light_lux: 10000–20000  |  water_level_%: min 60%

## DECISION RULES (apply in this exact priority order)

1. CRITICAL pods first — if plant_status is "critical", act before anything else.
2. Check each parameter against crop target range; if outside range, call the tool now.
3. Parameter → tool mapping:
   air_temp_c > target_max + 2°C          → turn_cooler_on(zone_id)
   air_temp_c < target_min - 2°C          → turn_heater_on(zone_id)
   air_temp_c slightly high (>target_max) → turn_fan_on + set_fan_speed(zone_id, 60)
   humidity > 80%                          → enter_high_humidity_mode(zone_id)
   humidity 70–80%                         → turn_fan_on + set_fan_speed(zone_id, 40)
   humidity < 45%                          → turn_humidifier_on(zone_id)
   ph > target_max                         → dose_acid(zone_id, amount_ml=10)
   ph < target_min                         → dose_base(zone_id, amount_ml=10)
   ec_ppm > target_max                     → flush_reservoir(zone_id, flush_percent=20)
   ec_ppm < target_min                     → dose_nutrients(zone_id, amount_ml=50)
   water_level < 40%                       → flag critical; log "refill reservoir"
   water_level < 60% (or 65% for tomato)  → log "top up reservoir soon"
4. If ALL parameters are within range and no supervisor directives: do NOT call tools.
5. NEVER run heater and cooler simultaneously in the same zone.
6. NEVER spend more than 3 sentences reasoning. Format: OBSERVATION → DECISION → ACTION.
7. When a supervisor directive arrives, act on it immediately even if readings appear healthy.
   The only exception: an active emergency response is already in progress.

## OUTPUT FORMAT (strict — every response must follow this)

ZONE: [zone_id]  CROP: [crop_name]
STATUS: [healthy / warning / critical]
OBSERVATIONS:
  - [parameter]: [value] → [in range / HIGH / LOW]
  - (one line per out-of-range parameter only; omit in-range parameters)
ACTIONS:
  - [tool_name]([params]) — [one-line reason]
  - (or "no_op — all parameters within range" if nothing to do)

No paragraphs. No hypotheticals. No "I need to check". Just the format above.\
"""

_TABLE_AGENT_MODEL = os.getenv("TABLE_AGENT_MODEL", "nvidia/nemotron-3-super-120b-a12b")
_TABLE_INTERVAL_S = int(os.getenv("TABLE_INTERVAL_S", "20"))
_NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1"


def _build_prompt(
    table_id: str,
    reading: sensor_poller.SensorReading,
    directives: list[dict],
) -> str:
    crop = CROP_MAP.get(table_id, "unknown")
    zone_state = sim_bridge.get_sensor_state(table_id)
    humidity = zone_state.get("humidity_pct", "N/A")
    water_level = zone_state.get("water_level", "N/A")
    water_temp_c = zone_state.get("water_temp_c", zone_state.get("temp_c", "N/A"))
    pump_status = "on" if zone_state.get("fan_on") else "off"
    zone_ts = zone_state.get("timestamp", datetime.now(timezone.utc).isoformat())

    lines = [
        f"## Zone {table_id} ({crop.upper()}) — Status: {reading.status.upper()}",
        (
            f"Zone: air_temp_c={reading.avg_temp_c}°C | water_temp_c={water_temp_c}°C | "
            f"relative_humidity_percent={humidity} | water_level_percent={water_level} | "
            f"pump_status={pump_status} | flow_rate_l_min=N/A"
        ),
        f"Avg: ph={reading.avg_ph} | ec_ppm={reading.avg_ec_ppm} | light_lux={reading.avg_light_lux}",
        f"Health: {reading.healthy_count} ok / {reading.warning_count} warn / {reading.critical_count} crit",
    ]

    if reading.fault_types:
        lines.append(f"Faults: {', '.join(reading.fault_types)}")

    if reading.pods:
        lines.append(
            "\nPod data (id | crop | plant_status | fault_type | ph | ec_ppm | "
            "air_temp_c | light_lux | age_hours | plant_height_cm | timestamp):"
        )
        for pod in reading.pods:
            age_h = round(pod.get("age_hours", 0.0), 1)
            plant_h_cm = round(age_h * 0.05, 1)
            lines.append(
                f"  {pod.get('id','?')} | {pod.get('crop', crop)} | "
                f"{pod.get('status','?')} | {pod.get('fault_type','none')} | "
                f"ph={pod.get('ph','?')} | ec={pod.get('ec_ppm','?')} | "
                f"air_temp={pod.get('temp_c','?')}°C | lux={pod.get('light_lux','?')} | "
                f"age={age_h}h | height={plant_h_cm}cm | {zone_ts}"
            )

    if directives:
        lines.append("\n## PENDING SUPERVISOR DIRECTIVES — ACT ON THESE NOW")
        for d in directives:
            lines.append(
                f"- [{d.get('priority', 'normal').upper()}] "
                f"{d.get('action', '')}: {d.get('reasoning', '')}"
            )
        lines.append(
            "\nCall the appropriate tool(s) to carry out the directive(s), then confirm."
        )
    else:
        lines.append(
            f"\nCheck all parameters vs {crop.upper()} targets. "
            "Call tools to fix issues, or no_op if all in range."
        )

    return "\n".join(lines)


def parse_agent_response(response_text: str) -> dict:
    """Parse the structured text output from the table agent.

    Expected format:
        ZONE: [zone_id]  CROP: [crop_name]
        STATUS: [healthy/warning/critical]
        OBSERVATIONS:
          - [param]: [value] → [in range / HIGH / LOW]
        ACTIONS:
          - [tool_name]([params]) — [reason]

    Returns a structured dict, or a safe default on parse failure.
    """
    default: dict = {"zone_id": "unknown", "status": "unknown", "observations": [], "actions": []}
    if not response_text:
        return default
    try:
        result: dict = {"zone_id": "unknown", "status": "unknown", "observations": [], "actions": []}

        m = re.search(r"ZONE:\s*(\S+)", response_text, re.IGNORECASE)
        if m:
            result["zone_id"] = m.group(1).rstrip(",").strip()

        m = re.search(r"STATUS:\s*(\w+)", response_text, re.IGNORECASE)
        if m:
            result["status"] = m.group(1).lower()

        obs_m = re.search(r"OBSERVATIONS:(.*?)(?:ACTIONS:|$)", response_text, re.DOTALL | re.IGNORECASE)
        if obs_m:
            for line in obs_m.group(1).splitlines():
                line = line.strip().lstrip("-").strip()
                if not line:
                    continue
                # param: value → flag
                parts = re.match(r"([^:]+):\s*([^→\-]+)[→\-]+\s*(.+)", line)
                if parts:
                    result["observations"].append({
                        "param": parts.group(1).strip(),
                        "value": parts.group(2).strip(),
                        "flag": parts.group(3).strip(),
                    })

        act_m = re.search(r"ACTIONS:(.*?)$", response_text, re.DOTALL | re.IGNORECASE)
        if act_m:
            for line in act_m.group(1).splitlines():
                line = line.strip().lstrip("-").strip()
                if not line or line.lower().startswith("no_op"):
                    continue
                # tool_name(params) — reason
                parts = re.match(r"(\w+)\(([^)]*)\)\s*[—\-]+\s*(.+)", line)
                if parts:
                    tool_name = parts.group(1).strip()
                    params_str = parts.group(2).strip()
                    reason = parts.group(3).strip()
                    params: dict = {}
                    for segment in params_str.split(","):
                        segment = segment.strip()
                        if "=" in segment:
                            k, v = segment.split("=", 1)
                            k, v = k.strip(), v.strip()
                            try:
                                params[k] = int(v)
                            except ValueError:
                                try:
                                    params[k] = float(v)
                                except ValueError:
                                    params[k] = v
                    result["actions"].append({"tool": tool_name, "params": params, "reason": reason})

        return result
    except Exception as exc:
        logger.warning("parse_agent_response failed (%s) | raw: %.200s", exc, response_text)
        return default


async def _run_cycle(table_id: str, client: AsyncOpenAI) -> None:
    cycle_start = time.monotonic()
    reading = sensor_poller.read_table(table_id)
    if reading is None:
        logger.warning("No sensor data available for %s — skipping cycle", table_id)
        return

    directives = message_bus.fetch_unread_directives(table_id)
    prompt = _build_prompt(table_id, reading, directives)
    logger.info("[%s] Cycle start — status=%s", table_id, reading.status)

    messages: list[dict] = [
        {"role": "system", "content": _TABLE_SYSTEM_PROMPT},
        {"role": "user", "content": prompt},
    ]
    tools = as_openai_tools()
    actions_taken: list[dict] = []
    reasoning_text = ""
    cycle_id = str(uuid4())

    for _ in range(5):  # max 5 agentic rounds
        response = await client.chat.completions.create(
            model=_TABLE_AGENT_MODEL,
            messages=messages,
            tools=tools,
            tool_choice="auto",
            temperature=0.3,
            max_tokens=1024,
        )
        if response.choices[0].finish_reason == "length":
            logger.warning("[%s] API truncated response (finish_reason=length)", table_id)
            reasoning_text = ""
            break
        msg = response.choices[0].message
        assistant_msg: dict = {"role": "assistant"}
        if msg.content is not None:
            assistant_msg["content"] = msg.content
        if msg.tool_calls:
            assistant_msg["tool_calls"] = [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {"name": tc.function.name, "arguments": tc.function.arguments},
                }
                for tc in msg.tool_calls
            ]
        messages.append(assistant_msg)

        if msg.content:
            reasoning_text = msg.content

        if not msg.tool_calls:
            break

        tool_results = []
        for tc in msg.tool_calls:
            params = json.loads(tc.function.arguments)
            params.setdefault("zone_id", table_id)

            result = execute_tool(tc.function.name, params)
            action = alog.sanitize_action({
                "zone_id": table_id,
                "pod_id": params.get("pod_id") or table_id,
                "tool": tc.function.name,
                "params": params,
                "result": result,
                "reason": reasoning_text or "",
                "status": reading.status,
                "cycle_id": cycle_id,
            })
            # Log each tool call for detailed audit trail
            alog.log(
                agent_type="table",
                table_id=table_id,
                tool=action["tool"],
                params=action["params"],
                result=result,
                reasoning=action["reason"] or None,
            )
            actions_taken.append(action)
            tool_results.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": json.dumps(result),
            })

        messages.extend(tool_results)

    if actions_taken:
        # Tools were called — text summary is for logging only; actions are already recorded.
        if not (reasoning_text and alog.validate_agent_response(reasoning_text)):
            reasoning_text = reasoning_text or f"Executed {len(actions_taken)} corrective action(s)"
            parsed = {
                "zone_id": table_id,
                "status": reading.status,
                "observations": [
                    {"param": ft, "value": "", "flag": "out of range"}
                    for ft in reading.fault_types
                ],
                "actions": [],
            }
        else:
            parsed = parse_agent_response(reasoning_text)
    else:
        # No tools called — the text response IS the decision (no_op path).
        if reasoning_text and not alog.validate_agent_response(reasoning_text):
            logger.warning("[%s] Agent response looked truncated; treating cycle as no_op", table_id)
            reasoning_text = "all parameters within range"
            parsed = {"zone_id": table_id, "status": reading.status, "observations": [], "actions": []}
        else:
            parsed = parse_agent_response(reasoning_text)
    cycle_ms = int((time.monotonic() - cycle_start) * 1000)
    effective_status = parsed.get("status") or reading.status
    observation_summary = "all parameters within range"
    if parsed.get("observations"):
        observation_summary = "; ".join(
            f"{obs.get('param', '')} {obs.get('flag', '')}".strip()
            for obs in parsed.get("observations", [])
        )
    if not actions_taken:
        actions_taken = [
            alog.sanitize_action({
                "zone_id": table_id,
                "pod_id": pod.get("id", table_id),
                "tool": "no_op",
                "params": {},
                "reason": observation_summary,
                "status": pod.get("status") or effective_status,
                "cycle_id": cycle_id,
            })
            for pod in (reading.pods or [{"id": table_id, "status": effective_status}])
        ]

    # One structured cycle entry — this is what gets broadcast to the frontend
    cycle_entry = alog.log_cycle(
        zone_id=table_id,
        status=effective_status,
        observations=parsed.get("observations", []),
        actions_taken=actions_taken,
        raw_reasoning=reasoning_text,
        cycle_duration_ms=cycle_ms,
        cycle_id=cycle_id,
        crop=CROP_MAP.get(table_id),
    )
    asyncio.create_task(alog.broadcast_action(cycle_entry))

    for d in directives:
        message_bus.mark_directive_consumed(d["id"])

    message_bus.write_table_report(table_id, {
        "zone_id": table_id,
        "status": reading.status,
        "avg_temp_c": reading.avg_temp_c,
        "avg_ph": reading.avg_ph,
        "avg_ec_ppm": reading.avg_ec_ppm,
        "avg_light_lux": reading.avg_light_lux,
        "critical_count": reading.critical_count,
        "warning_count": reading.warning_count,
        "healthy_count": reading.healthy_count,
        "fault_types": reading.fault_types,
        "actions_taken": actions_taken,
        "ts": datetime.now(timezone.utc).isoformat(),
    })

    logger.info("[%s] Cycle complete — %d action(s) in %dms", table_id, len(actions_taken), cycle_ms)


async def main(table_id: str) -> None:
    api_key = os.getenv("NVIDIA_API_KEY")
    if not api_key:
        raise EnvironmentError(
            "NVIDIA_API_KEY is required. Set it in your environment or .env file."
        )

    message_bus.init_db()
    sim_bridge.start_background_tick()

    client = AsyncOpenAI(base_url=_NVIDIA_BASE_URL, api_key=api_key)
    logger.info(
        "Table agent %s ready (model=%s, interval=%ds)",
        table_id,
        _TABLE_AGENT_MODEL,
        _TABLE_INTERVAL_S,
    )

    while True:
        try:
            await _run_cycle(table_id, client)
        except Exception:
            logger.exception("[%s] Cycle error", table_id)
        await asyncio.sleep(_TABLE_INTERVAL_S)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Hydroclawnics table agent")
    parser.add_argument("--table-id", required=True, help="Grow table ID (e.g. T1)")
    args = parser.parse_args()
    asyncio.run(main(args.table_id))
