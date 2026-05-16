#!/usr/bin/env python3
"""Smoke test: one agent cycle across a 4-zone farm (one zone per crop).

Exit codes: 0 = pass, 1 = fail.

Run from the hydroclawnics/ directory:
    python -m agent.test_agent_cycle

Requirements:
    NVIDIA_API_KEY env var must be set.
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
import time
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
SENSORS_FILE = BASE_DIR / "sensors" / "pod_states.json"
PODS_PER_TABLE = 5


def _write_fake_pods() -> None:
    """Write deterministic pod data: T1=lettuce(healthy), T2=basil(healthy),
    T3=tomato(warning ph_high), T4=spinach(critical ec_high)."""
    pods: list[dict] = []

    specs = [
        # (crop, ph, ec_ppm, temp_c, light_lux, status, fault)
        ("lettuce", 6.5, 700.0, 21.0, 16000.0, "healthy", "none"),   # T1 ×5
        ("basil",   6.0, 900.0, 23.0, 20000.0, "healthy", "none"),   # T2 ×5
        ("tomato",  7.2, 2000.0, 23.0, 30000.0, "warning", "ph_high"),  # T3 ×5
        ("spinach", 6.5, 3500.0, 18.0, 15000.0, "critical", "ec_high"), # T4 ×5
    ]

    for table_idx, (crop, ph, ec, temp, lux, status, fault) in enumerate(specs):
        for pod_idx in range(PODS_PER_TABLE):
            pod_num = table_idx * PODS_PER_TABLE + pod_idx + 1
            pods.append({
                "id": f"pod_{pod_num:02d}",
                "crop": crop,
                "ph": ph,
                "ec_ppm": ec,
                "temp_c": temp,
                "light_lux": lux,
                "status": status,
                "fault_type": fault,
                "last_action": "",
                "age_hours": 48.0 + pod_idx * 12.0,
            })

    SENSORS_FILE.parent.mkdir(parents=True, exist_ok=True)
    SENSORS_FILE.write_text(json.dumps(pods, indent=2), encoding="utf-8")
    print(f"[setup] Wrote {len(pods)} pods to {SENSORS_FILE.name}")


async def _run() -> int:
    from openai import AsyncOpenAI

    from . import action_log as alog
    from . import message_bus, sim_bridge
    from .table_runner import _run_cycle

    api_key = os.getenv("NVIDIA_API_KEY")
    if not api_key:
        print("[FAIL] NVIDIA_API_KEY is not set")
        return 1

    _write_fake_pods()
    message_bus.init_db()

    # Set up 4 zones: T1–T4 with matching crops and forced states
    for pod_id, crop, ph, ec in [
        ("T1", "lettuce", 6.5,  700.0),
        ("T2", "basil",   6.0,  900.0),
        ("T3", "tomato",  7.2,  2000.0),  # warning: ph high (target 5.5–6.5)
        ("T4", "spinach", 6.5,  3500.0),  # critical: ec way above 1610
    ]:
        zone = sim_bridge._get_zone(pod_id)
        zone.crop = crop
        zone.ph = ph
        zone.ec_ppm = ec
        # Force status evaluation immediately
        zone.plant_status, zone.fault_type = sim_bridge._evaluate_zone(zone)
        print(f"[setup] {pod_id} ({crop}): plant_status={zone.plant_status}, fault_type={zone.fault_type}")

    client = AsyncOpenAI(base_url="https://integrate.api.nvidia.com/v1", api_key=api_key)

    # Run the critical zone's cycle and verify tool use
    print("\n[test] Running agent cycle for T4 (spinach — critical ec_high) …")
    t0 = time.monotonic()

    # Clear any previous log entries so we can isolate this run
    snapshot_len = 0
    if alog.LOG_FILE.exists():
        snapshot_len = sum(1 for _ in alog.LOG_FILE.open())

    try:
        await asyncio.wait_for(_run_cycle("T4", client), timeout=60.0)
    except asyncio.TimeoutError:
        print("[FAIL] Agent cycle timed out after 60 s")
        return 1

    elapsed = time.monotonic() - t0
    print(f"[test] Cycle completed in {elapsed:.1f}s")

    # Print the structured cycle entry from the decisions log
    cycle_entry: dict | None = None
    if alog.DECISIONS_FILE.exists():
        for line in alog.DECISIONS_FILE.open(encoding="utf-8"):
            try:
                e = json.loads(line)
                if e.get("pod_id") == "T4":
                    cycle_entry = e
            except json.JSONDecodeError:
                pass

    if cycle_entry:
        print("\n[result] Parsed structured response:")
        print(json.dumps(cycle_entry, indent=2))
    else:
        print("[warn] No cycle entry found for T4 in decisions log")

    # Check that at least one tool was called on the critical zone
    actions_taken = (cycle_entry or {}).get("actions_taken", [])

    # Also scan the per-tool audit log for tool calls on T4
    tool_entries: list[dict] = []
    if alog.LOG_FILE.exists():
        lines = list(alog.LOG_FILE.open(encoding="utf-8"))
        for line in lines[snapshot_len:]:
            try:
                e = json.loads(line)
                if e.get("table_id") == "T4" and e.get("tool") not in ("no_op", None):
                    tool_entries.append(e)
            except json.JSONDecodeError:
                pass

    total_actions = len(actions_taken) + len(tool_entries)
    if total_actions == 0:
        print("\n[FAIL] Agent called no tools on critical zone T4")
        print("       Expected at least flush_reservoir or dose_nutrients for ec_high")
        return 1

    tools_called = [a.get("tool") for a in actions_taken] or [e.get("tool") for e in tool_entries]
    print(f"\n[PASS] Agent called {total_actions} tool(s) on critical zone T4: {tools_called}")
    return 0


def main() -> None:
    sys.exit(asyncio.run(_run()))


if __name__ == "__main__":
    main()
