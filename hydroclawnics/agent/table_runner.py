from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
from datetime import datetime, timezone

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

    lines = [
        f"## Zone {table_id} ({crop.upper()}) Sensor Report",
        f"Status: **{reading.status.upper()}**",
        f"Pods: {', '.join(reading.pod_ids)}",
        f"air_temp_c: {reading.avg_temp_c}°C | ph: {reading.avg_ph} | "
        f"ec_ppm: {reading.avg_ec_ppm} | light_lux: {reading.avg_light_lux}",
        f"humidity_%: {humidity} | water_level_%: {water_level}",
        f"Health: {reading.healthy_count} healthy, "
        f"{reading.warning_count} warning, {reading.critical_count} critical",
    ]
    if reading.fault_types:
        lines.append(f"Active faults: {', '.join(reading.fault_types)}")

    if directives:
        lines.append("\n## PENDING SUPERVISOR DIRECTIVES — YOU MUST ACT ON THESE")
        for d in directives:
            lines.append(
                f"- [{d.get('priority', 'normal').upper()}] "
                f"{d.get('action', '')}: {d.get('reasoning', '')}"
            )
        lines.append(
            "\nThe supervisor has issued the above directive(s). "
            "Call the appropriate tool(s) to carry them out, then confirm completion."
        )
    else:
        lines.append(
            "\nCheck all parameters against the target ranges for "
            f"{crop.upper()}. Call tools to correct any issues, or report no_op if healthy."
        )
    return "\n".join(lines)


async def _run_cycle(table_id: str, client: AsyncOpenAI) -> None:
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

    for _ in range(5):  # max 5 agentic rounds
        response = await client.chat.completions.create(
            model=_TABLE_AGENT_MODEL,
            messages=messages,
            tools=tools,
            tool_choice="auto",
            temperature=0.3,
            max_tokens=1024,
        )
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
            entry = alog.log(
                agent_type="table",
                table_id=table_id,
                tool=tc.function.name,
                params=params,
                result=result,
                reasoning=reasoning_text or None,
            )
            asyncio.create_task(alog.broadcast_action(entry))
            actions_taken.append({"tool": tc.function.name, "params": params, "result": result})
            tool_results.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": json.dumps(result),
            })

        messages.extend(tool_results)

    if not actions_taken:
        entry = alog.log(
            "table", table_id, "no_op", {}, {"status": reading.status}, reasoning_text or None
        )
        asyncio.create_task(alog.broadcast_action(entry))

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

    logger.info("[%s] Cycle complete — %d action(s)", table_id, len(actions_taken))


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
