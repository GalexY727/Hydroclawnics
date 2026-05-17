"""Fire all 16 tools against the sim bridge and verify results."""
from __future__ import annotations

import asyncio
import sys

from . import sim_bridge
from .tool_registry import TOOLS, execute_tool

_TEST_CASES = [
    ("turn_fan_on",              {"pod_id": "pod_001"}),
    ("set_fan_speed",            {"pod_id": "pod_001", "speed_percent": 75}),
    ("turn_fan_off",             {"pod_id": "pod_001"}),
    ("open_vent",                {"pod_id": "pod_002"}),
    ("close_vent",               {"pod_id": "pod_002"}),
    ("turn_heater_on",           {"pod_id": "pod_002"}),
    ("turn_heater_off",          {"pod_id": "pod_002"}),
    ("turn_cooler_on",           {"pod_id": "pod_003"}),
    ("turn_cooler_off",          {"pod_id": "pod_003"}),
    ("turn_humidifier_on",       {"pod_id": "pod_003"}),
    ("turn_humidifier_off",      {"pod_id": "pod_003"}),
    ("turn_dehumidifier_on",     {"pod_id": "pod_004"}),
    ("turn_dehumidifier_off",    {"pod_id": "pod_004"}),
    ("set_climate_target",       {"pod_id": "pod_001", "target_temp_c": 23.0, "target_humidity_percent": 60.0}),
    ("enter_heat_stress_mode",   {"pod_id": "pod_002"}),
    ("enter_high_humidity_mode", {"pod_id": "pod_003"}),
    ("set_light_level",          {"pod_id": "pod_004", "target_lux": 15000.0}),
    ("dose_acid",                {"pod_id": "pod_001", "amount_ml": 10.0}),
    ("dose_base",                {"pod_id": "pod_002", "amount_ml": 20.0}),
    ("dose_nutrients",           {"pod_id": "pod_003", "amount_ml": 50.0}),
    ("flush_reservoir",          {"pod_id": "pod_004", "flush_percent": 30.0}),
]


async def main() -> int:
    sim_bridge.start_background_tick()
    await asyncio.sleep(0)  # yield to let the tick task register

    assert len(_TEST_CASES) == len(TOOLS), (
        f"Test case count ({len(_TEST_CASES)}) doesn't match tool count ({len(TOOLS)})"
    )

    passed = 0
    failed = 0

    print(f"\nRunning {len(_TEST_CASES)} tool tests against sim bridge...\n")
    for tool_name, params in _TEST_CASES:
        result = execute_tool(tool_name, params)
        ok = result.get("ok", False)
        if ok:
            passed += 1
            print(f"  [PASS] {tool_name}({params})")
        else:
            failed += 1
            print(f"  [FAIL] {tool_name}({params}) → {result}")

    # Safety interlock: heater must cut off when cooler activates
    print("\n--- Safety interlock checks ---")
    sim_bridge.execute_command("turn_heater_on", {"pod_id": "pod_001"})
    sim_bridge.execute_command("turn_cooler_on", {"pod_id": "pod_001"})
    if not sim_bridge._state["pod_001"].heater_on:
        print("  [PASS] Heater auto-disabled when cooler activated")
        passed += 1
    else:
        print("  [FAIL] Heater should be off after cooler activation")
        failed += 1

    # Safety interlock: cooler must cut off when heater activates
    sim_bridge.execute_command("turn_cooler_on", {"pod_id": "pod_001"})
    sim_bridge.execute_command("turn_heater_on", {"pod_id": "pod_001"})
    if not sim_bridge._state["pod_001"].cooler_on:
        print("  [PASS] Cooler auto-disabled when heater activated")
        passed += 1
    else:
        print("  [FAIL] Cooler should be off after heater activation")
        failed += 1

    # Verify heat stress mode compound action
    sim_bridge.execute_command("enter_heat_stress_mode", {"pod_id": "pod_001"})
    z = sim_bridge._state["pod_001"]
    if z.fan_on and z.fan_speed == 100 and z.cooler_on and not z.heater_on and z.vent_open:
        print("  [PASS] enter_heat_stress_mode sets correct compound state")
        passed += 1
    else:
        print(f"  [FAIL] enter_heat_stress_mode compound state wrong: fan={z.fan_on} speed={z.fan_speed} cooler={z.cooler_on} heater={z.heater_on} vent={z.vent_open}")
        failed += 1

    print(f"\nResults: {passed} passed, {failed} failed")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
