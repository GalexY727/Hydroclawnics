from __future__ import annotations

import os

HARDWARE_MODE: bool = os.getenv("HARDWARE_MODE", "false").lower() == "true"


def execute_command(tool_name: str, params: dict) -> dict:
    if HARDWARE_MODE:
        from . import hardware_bridge
        return hardware_bridge.execute_command(tool_name, params)
    from . import sim_bridge
    return sim_bridge.execute_command(tool_name, params)


def get_sensor_state(zone_id: str) -> dict:
    if HARDWARE_MODE:
        from . import hardware_bridge
        return hardware_bridge.get_sensor_state(zone_id)
    from . import sim_bridge
    return sim_bridge.get_sensor_state(zone_id)
