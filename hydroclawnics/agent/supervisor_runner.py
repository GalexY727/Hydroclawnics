from __future__ import annotations

import asyncio
import json
import logging
import os

from openai import AsyncOpenAI

from . import action_log as alog
from . import message_bus, sensor_poller

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [supervisor] %(levelname)s %(message)s",
)
logger = logging.getLogger("supervisor_runner")

_SUPERVISOR_SYSTEM_PROMPT = (
    "You are the farm supervisor for a hydroponics operation. "
    "You oversee multiple grow tables, each managed by a table agent. "
    "Your job is to synthesize farm-wide health, identify cross-table patterns, "
    "and issue high-level directives to table agents. "
    "Always reason step by step. Prioritize critical zones. "
    "Never contradict a table agent's active emergency response without justification."
)

_SUPERVISOR_MODEL = os.getenv("SUPERVISOR_MODEL", "nvidia/nemotron-3-super-120b-a12b")
_SUPERVISOR_INTERVAL_S = int(os.getenv("SUPERVISOR_INTERVAL_S", "60"))
_NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1"

_RESPONSE_SCHEMA_DOC = """\
Respond ONLY with a JSON object in this exact shape:
{
  "reasoning": "<step-by-step analysis>",
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
        fault_str = f", faults=[{', '.join(r.fault_types)}]" if r.fault_types else ""
        lines.append(
            f"**{tid}** [{r.status.upper()}] — "
            f"temp={r.avg_temp_c}°C, pH={r.avg_ph}, EC={r.avg_ec_ppm} ppm, "
            f"crit={r.critical_count}, warn={r.warning_count}, ok={r.healthy_count}"
            + fault_str
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
    return raw.strip()


def _get_reasoning_content(message) -> str:  # type: ignore[no-untyped-def]
    rc = getattr(message, "reasoning_content", None)
    if rc is None:
        try:
            rc = message.model_extra.get("reasoning_content")
        except AttributeError:
            pass
    return rc or ""


async def _run_cycle(client: AsyncOpenAI) -> None:
    readings = sensor_poller.read_all()
    if not readings:
        logger.warning("No sensor readings — skipping supervisor cycle")
        return

    reports = message_bus.get_latest_reports()
    prompt = _build_prompt(readings, reports)
    logger.info("Supervisor cycle: %d table(s) visible", len(readings))

    response = await client.chat.completions.create(
        model=_SUPERVISOR_MODEL,
        messages=[
            {"role": "system", "content": _SUPERVISOR_SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        temperature=1.0,
        top_p=0.95,
        max_tokens=4096,
        extra_body={
            "chat_template_kwargs": {"enable_thinking": True},
            "reasoning_budget": 4096,
        },
    )

    msg = response.choices[0].message
    raw = msg.content or ""
    reasoning_content = _get_reasoning_content(msg)

    try:
        parsed = json.loads(_extract_json(raw))
    except json.JSONDecodeError:
        logger.error("Supervisor returned non-JSON response: %s", raw[:200])
        alog.log("supervisor", None, "parse_error", {}, {"raw": raw[:500]}, reasoning_content)
        return

    reasoning = parsed.get("reasoning", "")
    directives = parsed.get("directives", [])
    farm_summary = parsed.get("farm_health_summary", "")

    thought_text = reasoning_content or reasoning
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
    api_key = os.getenv("NVIDIA_API_KEY")
    if not api_key:
        raise EnvironmentError(
            "NVIDIA_API_KEY is required. Set it in your environment or .env file."
        )

    message_bus.init_db()
    client = AsyncOpenAI(base_url=_NVIDIA_BASE_URL, api_key=api_key)
    logger.info(
        "Supervisor ready (model=%s, interval=%ds)",
        _SUPERVISOR_MODEL,
        _SUPERVISOR_INTERVAL_S,
    )

    while True:
        try:
            await _run_cycle(client)
        except Exception:
            logger.exception("Supervisor cycle error — will retry")
        await asyncio.sleep(_SUPERVISOR_INTERVAL_S)


if __name__ == "__main__":
    asyncio.run(main())
