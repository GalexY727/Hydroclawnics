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

_TABLE_SYSTEM_PROMPT = """\
You are an autonomous grow-table manager for a hydroponics farm.
You monitor sensor readings for your assigned pods and take corrective \
actions to keep plants healthy. You have 16 tools to control climate \
in your zone.

Rules:
- Always explain your reasoning before calling a tool
- Never run heater and cooler simultaneously in the same zone
- Prefer conservative actions first (adjust fan speed before toggling on/off)
- When a directive arrives from the farm supervisor, acknowledge and comply \
unless an emergency response is already in progress
- If all readings are within range, report healthy status and do NOT call tools
- Critical faults (ph_crash, heat_stress) take absolute priority\
"""

_TABLE_AGENT_MODEL = os.getenv("TABLE_AGENT_MODEL", "nvidia/nemotron-3-nano-30b-a3b")
_TABLE_INTERVAL_S = int(os.getenv("TABLE_INTERVAL_S", "20"))
_NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1"


def _build_prompt(
    table_id: str,
    reading: sensor_poller.SensorReading,
    directives: list[dict],
) -> str:
    lines = [
        f"## Zone {table_id} Sensor Report",
        f"Status: **{reading.status.upper()}**",
        f"Pods: {', '.join(reading.pod_ids)}",
        f"Avg temp: {reading.avg_temp_c}°C | pH: {reading.avg_ph} | "
        f"EC: {reading.avg_ec_ppm} ppm | Light: {reading.avg_light_lux} lux",
        f"Health: {reading.healthy_count} healthy, "
        f"{reading.warning_count} warning, {reading.critical_count} critical",
    ]
    if reading.fault_types:
        lines.append(f"Active faults: {', '.join(reading.fault_types)}")

    if directives:
        lines.append("\n## Pending Supervisor Directives")
        for d in directives:
            lines.append(
                f"- [{d.get('priority', 'normal').upper()}] "
                f"{d.get('action', '')}: {d.get('reasoning', '')}"
            )

    lines.append(
        "\nAnalyze the sensor data and any directives. "
        "Call tools to correct issues, then confirm zone status."
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
