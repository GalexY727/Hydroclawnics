"""Fire all 16 tools against the sim bridge and verify results."""
from __future__ import annotations

import asyncio
import sys

from . import sim_bridge
from .tool_registry import TOOLS, execute_tool

_TEST_CASES = [
    ("turn_fan_on",              {"zone_id": "T1"}),
    ("set_fan_speed",            {"zone_id": "T1", "speed_percent": 75}),
    ("turn_fan_off",             {"zone_id": "T1"}),
    ("open_vent",                {"zone_id": "T2"}),
    ("close_vent",               {"zone_id": "T2"}),
    ("turn_heater_on",           {"zone_id": "T2"}),
    ("turn_heater_off",          {"zone_id": "T2"}),
    ("turn_cooler_on",           {"zone_id": "T3"}),
    ("turn_cooler_off",          {"zone_id": "T3"}),
    ("turn_humidifier_on",       {"zone_id": "T3"}),
    ("turn_humidifier_off",      {"zone_id": "T3"}),
    ("turn_dehumidifier_on",     {"zone_id": "T4"}),
    ("turn_dehumidifier_off",    {"zone_id": "T4"}),
    ("set_climate_target",       {"zone_id": "T1", "target_temp_c": 23.0, "target_humidity_percent": 60.0}),
    ("enter_heat_stress_mode",   {"zone_id": "T2"}),
    ("enter_high_humidity_mode", {"zone_id": "T3"}),
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
    sim_bridge.execute_command("turn_heater_on", {"zone_id": "T1"})
    sim_bridge.execute_command("turn_cooler_on", {"zone_id": "T1"})
    if not sim_bridge._state["T1"].heater_on:
        print("  [PASS] Heater auto-disabled when cooler activated")
        passed += 1
    else:
        print("  [FAIL] Heater should be off after cooler activation")
        failed += 1

    # Safety interlock: cooler must cut off when heater activates
    sim_bridge.execute_command("turn_cooler_on", {"zone_id": "T1"})
    sim_bridge.execute_command("turn_heater_on", {"zone_id": "T1"})
    if not sim_bridge._state["T1"].cooler_on:
        print("  [PASS] Cooler auto-disabled when heater activated")
        passed += 1
    else:
        print("  [FAIL] Cooler should be off after heater activation")
        failed += 1

    # Verify heat stress mode compound action
    sim_bridge.execute_command("enter_heat_stress_mode", {"zone_id": "T1"})
    z = sim_bridge._state["T1"]
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
