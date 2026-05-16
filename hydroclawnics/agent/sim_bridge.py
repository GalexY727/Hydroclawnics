from __future__ import annotations

import asyncio
import random
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone

_state: dict[str, _ZoneState] = {}
_tick_task: asyncio.Task | None = None  # type: ignore[type-arg]


@dataclass
class _ZoneState:
    zone_id: str
    temp_c: float = 22.0
    humidity_pct: float = 65.0
    fan_on: bool = False
    fan_speed: int = 0
    vent_open: bool = False
    heater_on: bool = False
    cooler_on: bool = False
    humidifier_on: bool = False
    dehumidifier_on: bool = False
    water_level: float = 75.0
    ph: float = 6.2
    target_temp_c: float = 22.0
    target_humidity_percent: float = 65.0
    last_updated: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


def _get_zone(zone_id: str) -> _ZoneState:
    if zone_id not in _state:
        _state[zone_id] = _ZoneState(zone_id=zone_id)
    return _state[zone_id]


def execute_command(tool_name: str, params: dict) -> dict:
    zone_id = params.get("zone_id", "")
    zone = _get_zone(zone_id)
    zone.last_updated = datetime.now(timezone.utc).isoformat()

    match tool_name:
        case "turn_fan_on":
            zone.fan_on = True
            if zone.fan_speed == 0:
                zone.fan_speed = 50
        case "turn_fan_off":
            zone.fan_on = False
            zone.fan_speed = 0
        case "set_fan_speed":
            zone.fan_speed = max(0, min(100, int(params.get("speed_percent", 50))))
            zone.fan_on = zone.fan_speed > 0
        case "open_vent":
            zone.vent_open = True
        case "close_vent":
            zone.vent_open = False
        case "turn_heater_on":
            zone.heater_on = True
            zone.cooler_on = False
        case "turn_heater_off":
            zone.heater_on = False
        case "turn_cooler_on":
            zone.cooler_on = True
            zone.heater_on = False
        case "turn_cooler_off":
            zone.cooler_on = False
        case "turn_humidifier_on":
            zone.humidifier_on = True
            zone.dehumidifier_on = False
        case "turn_humidifier_off":
            zone.humidifier_on = False
        case "turn_dehumidifier_on":
            zone.dehumidifier_on = True
            zone.humidifier_on = False
        case "turn_dehumidifier_off":
            zone.dehumidifier_on = False
        case "set_climate_target":
            zone.target_temp_c = float(params.get("target_temp_c", zone.target_temp_c))
            zone.target_humidity_percent = float(
                params.get("target_humidity_percent", zone.target_humidity_percent)
            )
        case "enter_heat_stress_mode":
            zone.fan_on = True
            zone.fan_speed = 100
            zone.vent_open = True
            zone.cooler_on = True
            zone.heater_on = False
        case "enter_high_humidity_mode":
            zone.dehumidifier_on = True
            zone.fan_on = True
            zone.fan_speed = 75
            zone.humidifier_on = False
        case _:
            return {"ok": False, "error": f"Unknown command: {tool_name}"}

    return {"ok": True, "zone_id": zone_id, "command": tool_name, "state": asdict(zone)}


def get_sensor_state(zone_id: str) -> dict:
    zone = _get_zone(zone_id)
    temp_delta = abs(zone.temp_c - zone.target_temp_c)
    hum_delta = abs(zone.humidity_pct - zone.target_humidity_percent)
    health = max(0.0, 1.0 - 0.08 * temp_delta - 0.04 * hum_delta)

    if health < 0.4 or zone.temp_c > 35 or zone.ph < 5.5 or zone.ph > 7.5:
        status = "critical"
    elif health < 0.7 or zone.temp_c > 30 or zone.ph < 6.0 or zone.ph > 7.0:
        status = "warning"
    else:
        status = "healthy"

    return {
        "zone_id": zone_id,
        "temp_c": round(zone.temp_c, 2),
        "humidity_pct": round(zone.humidity_pct, 2),
        "water_level": round(zone.water_level, 1),
        "ph": round(zone.ph, 2),
        "health_score": round(health, 3),
        "status": status,
        "fan_on": zone.fan_on,
        "fan_speed": zone.fan_speed,
        "vent_open": zone.vent_open,
        "heater_on": zone.heater_on,
        "cooler_on": zone.cooler_on,
        "humidifier_on": zone.humidifier_on,
        "dehumidifier_on": zone.dehumidifier_on,
        "target_temp_c": zone.target_temp_c,
        "target_humidity_percent": zone.target_humidity_percent,
        "timestamp": zone.last_updated,
    }


def all_zone_states() -> dict[str, dict]:
    return {zid: get_sensor_state(zid) for zid in _state}


async def _tick() -> None:
    while True:
        await asyncio.sleep(5)
        for zone in _state.values():
            if zone.cooler_on:
                zone.temp_c = max(15.0, zone.temp_c - random.uniform(0.3, 0.7))
            elif zone.heater_on:
                zone.temp_c = min(40.0, zone.temp_c + random.uniform(0.3, 0.7))
            else:
                zone.temp_c += random.gauss(0, 0.15)

            if zone.fan_on:
                fan_factor = zone.fan_speed / 100.0
                zone.humidity_pct = max(20.0, zone.humidity_pct - random.uniform(0.1, 0.3) * fan_factor)
                zone.temp_c = max(15.0, zone.temp_c - random.uniform(0.05, 0.1) * fan_factor)

            if zone.humidifier_on:
                zone.humidity_pct = min(95.0, zone.humidity_pct + random.uniform(0.2, 0.5))
            elif zone.dehumidifier_on:
                zone.humidity_pct = max(20.0, zone.humidity_pct - random.uniform(0.2, 0.5))
            else:
                zone.humidity_pct = max(20.0, min(95.0, zone.humidity_pct + random.gauss(0, 0.5)))

            zone.ph = max(4.0, min(9.0, zone.ph + random.gauss(0, 0.03)))
            zone.last_updated = datetime.now(timezone.utc).isoformat()

        # Randomly introduce faults ~10% of ticks to simulate real conditions
        if _state and random.random() < 0.1:
            zone = random.choice(list(_state.values()))
            fault = random.choice(["high_temp", "low_humidity", "ph_drift"])
            if fault == "high_temp":
                zone.temp_c += random.uniform(3, 6)
            elif fault == "low_humidity":
                zone.humidity_pct = max(20.0, zone.humidity_pct - random.uniform(10, 20))
            elif fault == "ph_drift":
                zone.ph += random.choice([-1, 1]) * random.uniform(0.3, 0.8)


def start_background_tick() -> None:
    global _tick_task
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        return
    if _tick_task is None or _tick_task.done():
        _tick_task = loop.create_task(_tick())
