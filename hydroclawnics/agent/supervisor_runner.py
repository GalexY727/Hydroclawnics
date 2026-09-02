from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import TYPE_CHECKING

from . import action_log as alog
from . import message_bus, sensor_poller
from .llm_client import LLMConfig, build_async_client, load_llm_config
from .table_runner import CROP_MAP

if TYPE_CHECKING:
    from openai import AsyncOpenAI

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [supervisor] %(levelname)s %(message)s",
)
logger = logging.getLogger("supervisor_runner")

_SUPERVISOR_SYSTEM_PROMPT = (
    "You are the farm supervisor for a DWC hydroponics operation managing 4 crops: "
    "T1=Lettuce, T2=Basil, T3=Tomato, T4=Spinach. "
    "You oversee multiple grow tables, each managed by a table agent that knows its crop's "
    "target ranges (pH, EC, temp, humidity, light) and calls corrective tools autonomously. "
    "Your job is to synthesize farm-wide health, identify cross-table patterns (shared HVAC, "
    "nutrient batch issues, light spectrum problems), and issue high-level directives when "
    "local table agents cannot resolve an issue or when farm-wide coordination is needed. "
    "Directives must be crop-aware — name the crop and the target range when relevant. "
    "Prioritize critical zones. Keep reasoning concise and operational. "
    "Never contradict a table agent's active emergency response without justification."
)

_RESPONSE_SCHEMA_DOC = """\
Respond ONLY with a JSON object in this exact shape:
{
  "reasoning": "<concise operational explanation>",
  "farm_health_summary": "<one-sentence summary>",
  "directives": [
    {
      "table_id": "T1",
      "action": "<what the table agent should do>",
      "reasoning": "<why>",
      "priority": "low|normal|high|critical"
    }
  ]
}
If no intervention is needed, set directives to [] and explain why in reasoning.\
"""


def _build_prompt(
    readings: dict[str, sensor_poller.SensorReading],
    reports: dict[str, dict],
) -> str:
    lines = ["## Farm-Wide Sensor State\n"]
    for tid in sorted(readings):
        r = readings[tid]
        crop = CROP_MAP.get(tid, "unknown")
        condition_str = f", out_of_range=[{', '.join(r.fault_types)}]" if r.fault_types else ""
        lines.append(
            f"**{tid} ({crop})** [{r.status.upper()}] — "
            f"temp={r.avg_temp_c}°C, pH={r.avg_ph}, EC={r.avg_ec_ppm} ppm, "
            f"crit={r.critical_count}, warn={r.warning_count}, ok={r.healthy_count}"
            + condition_str
        )

    if reports:
        lines.append("\n## Latest Table Agent Reports\n")
        for tid in sorted(reports):
            rep = reports[tid]
            n_actions = len(rep.get("actions_taken", []))
            lines.append(
                f"**{tid}** (at {rep.get('created_at', '?')[:19]}): "
                f"{n_actions} action(s) — status={rep.get('status', '?')}"
            )

    lines.append(f"\n## Instructions\n{_RESPONSE_SCHEMA_DOC}")
    return "\n".join(lines)


def _extract_json(raw: str) -> str:
    if "```json" in raw:
        return raw.split("```json")[1].split("```")[0].strip()
    if "```" in raw:
        return raw.split("```")[1].split("```")[0].strip()
    m = re.search(r"\{[\s\S]*\}", raw)
    if m:
        return m.group(0).strip()
    return raw.strip()


def _deterministic_supervisor_decision(
    readings: dict[str, sensor_poller.SensorReading],
    reports: dict[str, dict],
) -> dict:
    critical_tables = [tid for tid, reading in readings.items() if reading.critical_count > 0]
    warning_tables = [tid for tid, reading in readings.items() if reading.warning_count > 0]
    total_critical = sum(reading.critical_count for reading in readings.values())
    total_warning = sum(reading.warning_count for reading in readings.values())

    if total_critical:
        farm_summary = (
            f"{total_critical} critical pod(s) and {total_warning} warning pod(s) require attention "
            f"across {len(readings)} table(s)."
        )
    elif total_warning:
        farm_summary = (
            f"{total_warning} warning pod(s) are drifting outside crop targets; table agents are correcting locally."
        )
    else:
        farm_summary = f"All {len(readings)} table(s) are within operating range."

    directives: list[dict] = []
    for tid in sorted(critical_tables):
        reading = readings[tid]
        crop = CROP_MAP.get(tid, "unknown")
        fault_text = ", ".join(reading.fault_types) or "critical sensor drift"
        previous_actions = len((reports.get(tid) or {}).get("actions_taken", []))
        action = (
            f"Prioritize {crop} table {tid}: verify corrective actions for {fault_text} "
            "and keep responding until pods return to target range."
        )
        if previous_actions:
            action += f" Last table report recorded {previous_actions} action(s)."
        directives.append({
            "table_id": tid,
            "action": action,
            "reasoning": f"{reading.critical_count} critical {crop} pod(s) need coordinated follow-up.",
            "priority": "critical",
        })

    if not directives and len(warning_tables) >= 2:
        tables = ", ".join(sorted(warning_tables))
        directives.append({
            "table_id": sorted(warning_tables)[0],
            "action": f"Monitor shared environment across warning tables {tables}; check HVAC and nutrient batch consistency.",
            "reasoning": "Multiple tables are warning at once, which may indicate a farm-wide drift.",
            "priority": "normal",
        })

    return {
        "reasoning": farm_summary,
        "farm_health_summary": farm_summary,
        "directives": directives,
    }


async def _run_cycle(
    client: AsyncOpenAI | None = None,
    config: LLMConfig | None = None,
) -> None:
    config = config or load_llm_config()
    readings = sensor_poller.read_all()
    if not readings:
        logger.warning("No sensor readings — skipping supervisor cycle")
        return

    reports = message_bus.get_latest_reports()
    prompt = _build_prompt(readings, reports)
    logger.info("Supervisor cycle: %d table(s) visible", len(readings))

    if client is None:
        logger.info("Using deterministic supervisor policy (LLM_PROVIDER=%s)", config.provider)
        parsed = _deterministic_supervisor_decision(readings, reports)
    else:
        try:
            response = await client.chat.completions.create(
                model=config.model_for("supervisor"),
                messages=[
                    {"role": "system", "content": _SUPERVISOR_SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.7,
                top_p=0.95,
                max_tokens=2048,
                **config.request_options(),
            )
            raw = response.choices[0].message.content or ""
            parsed = json.loads(_extract_json(raw))
        except json.JSONDecodeError:
            logger.warning("Supervisor non-JSON on first attempt, retrying with JSON-only instruction")
            retry = await client.chat.completions.create(
                model=config.model_for("supervisor"),
                messages=[
                    {"role": "system", "content": _SUPERVISOR_SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                    {"role": "assistant", "content": raw},
                    {
                        "role": "user",
                        "content": (
                            "Your response above was not valid JSON. "
                            "Reply ONLY with the JSON object — no prose, no markdown fences."
                        ),
                    },
                ],
                temperature=0.3,
                max_tokens=1024,
                **config.request_options(),
            )
            raw = retry.choices[0].message.content or ""
            try:
                parsed = json.loads(_extract_json(raw))
            except json.JSONDecodeError:
                logger.error("Supervisor returned non-JSON twice; using deterministic fallback: %s", raw[:200])
                parsed = _deterministic_supervisor_decision(readings, reports)
        except Exception:
            logger.exception("Supervisor LLM call failed; using deterministic fallback")
            parsed = _deterministic_supervisor_decision(readings, reports)

    reasoning = parsed.get("reasoning", "")
    directives = parsed.get("directives", [])
    if not isinstance(directives, list):
        directives = []
    farm_summary = parsed.get("farm_health_summary", "")

    thought_text = reasoning
    if thought_text:
        asyncio.create_task(alog.broadcast_thought(thought_text, source="supervisor"))

    for directive in directives:
        tid = directive.get("table_id")
        if not tid:
            continue
        message_bus.write_directive(tid, directive)
        logger.info(
            "→ Directive for %s [%s]: %s",
            tid,
            directive.get("priority", "normal"),
            directive.get("action", ""),
        )

    entry = alog.log(
        agent_type="supervisor",
        table_id=None,
        tool="issue_directives",
        params={"directive_count": len(directives), "farm_health_summary": farm_summary},
        result={"directives": directives},
        reasoning=reasoning,
    )
    asyncio.create_task(alog.broadcast_action(entry))
    logger.info("Supervisor cycle done — %d directive(s) issued", len(directives))


async def main() -> None:
    config = load_llm_config()
    message_bus.init_db()
    client = build_async_client(config)
    logger.info(
        "Supervisor ready (provider=%s, model=%s, interval=%ds, demo_mode=%s)",
        config.provider,
        config.model_for("supervisor"),
        config.supervisor_interval_s,
        config.demo_mode,
    )

    while True:
        try:
            await _run_cycle(client, config)
        except Exception:
            logger.exception("Supervisor cycle error — will retry")
        await asyncio.sleep(config.supervisor_interval_s)


if __name__ == "__main__":
    asyncio.run(main())
