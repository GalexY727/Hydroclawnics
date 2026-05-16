from __future__ import annotations

import json
import os
import time

try:
    import serial
except ImportError as exc:
    raise ImportError(
        "pyserial is required for hardware mode. Install it with: pip install pyserial"
    ) from exc

ARDUINO_PORT = os.getenv("ARDUINO_PORT", "/dev/ttyUSB0")
BAUD_RATE = 115200
TIMEOUT_S = 2.0


class HardwareError(RuntimeError):
    pass


def _send_command(cmd: dict, retries: int = 1) -> dict:
    for attempt in range(retries + 1):
        try:
            with serial.Serial(ARDUINO_PORT, BAUD_RATE, timeout=TIMEOUT_S) as ser:
                ser.write((json.dumps(cmd) + "\n").encode())
                raw = ser.readline().decode().strip()
                if not raw:
                    raise HardwareError("No response from Arduino")
                return json.loads(raw)
        except (serial.SerialException, json.JSONDecodeError, HardwareError) as exc:
            if attempt == retries:
                raise HardwareError(
                    f"Arduino command failed after {retries + 1} attempt(s): {exc}"
                ) from exc
            time.sleep(0.1)
    return {}


def execute_command(tool_name: str, params: dict) -> dict:
    zone_id = params.get("zone_id", "")
    cmd = {
        "cmd": tool_name,
        "zone": zone_id,
        **{k: v for k, v in params.items() if k != "zone_id"},
    }
    try:
        result = _send_command(cmd)
        return {"ok": result.get("ok", False), "zone_id": zone_id, "command": tool_name, **result}
    except HardwareError as exc:
        return {"ok": False, "zone_id": zone_id, "command": tool_name, "error": str(exc)}


def get_sensor_state(zone_id: str) -> dict:
    try:
        return _send_command({"cmd": "read_sensors", "zone": zone_id})
    except HardwareError as exc:
        return {"zone_id": zone_id, "error": str(exc), "status": "error"}
