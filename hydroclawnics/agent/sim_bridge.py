from __future__ import annotations

import asyncio
import random
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone

try:
    from hydroclawnics.sim_config import CROP_ORDER, POD_COUNT
except ModuleNotFoundError:
    from sim_config import CROP_ORDER, POD_COUNT

_state: dict[str, _ZoneState] = {}
_tick_task: asyncio.Task | None = None  # type: ignore[type-arg]

# zone_id → crop name (mirrors table_runner.CROP_MAP)
ZONE_CROP_MAP: dict[str, str] = {
    "T1": "lettuce",
    "T2": "basil",
    "T3": "tomato",
    "T4": "spinach",
}

# Per-crop target ranges: (lo, hi) or (min_val, None) for one-sided
CROP_TARGETS: dict[str, dict] = {
    "lettuce": {
        "water_temp_c": (18.0, 22.0),
        "air_temp_c":   (18.0, 24.0),
        "ph":           (6.0,  7.0),
        "ec_ppm":       (560.0, 840.0),
        "humidity_pct": (50.0, 70.0),
        "water_level":  (60.0, None),
    },
    "basil": {
        "water_temp_c": (20.0, 25.0),
        "air_temp_c":   (21.0, 26.0),
        "ph":           (5.5,  6.5),
        "ec_ppm":       (700.0, 1120.0),
        "humidity_pct": (40.0, 60.0),
        "water_level":  (60.0, None),
    },
    "tomato": {
        "water_temp_c": (18.0, 24.0),
        "air_temp_c":   (20.0, 26.0),
        "ph":           (5.5,  6.5),
        "ec_ppm":       (1400.0, 3500.0),
        "humidity_pct": (50.0, 70.0),
        "water_level":  (65.0, None),
    },
    "spinach": {
        "water_temp_c": (15.0, 20.0),
        "air_temp_c":   (15.0, 21.0),
        "ph":           (6.0,  7.0),
        "ec_ppm":       (1260.0, 1610.0),
        "humidity_pct": (50.0, 70.0),
        "water_level":  (60.0, None),
    },
}

# Readable param → fault_type suffix used in "param_high" / "param_low"
_FAULT_PARAM_NAMES: dict[str, str] = {
    "water_temp_c": "water_temp",
    "air_temp_c":   "temp",
    "ph":           "ph",
    "ec_ppm":       "ec",
    "humidity_pct": "humidity",
    "water_level":  "water_level",
}


def _drift_severity(value: float, lo: float, hi: float | None) -> tuple[str | None, str | None]:
    """Return (severity, direction) or (None, None) if within range.

    For one-sided constraints (hi is None) the span is treated as lo * 0.4
    so that 10 % / 25 % thresholds scale naturally with the minimum value.
    """
    if hi is None:
        # One-sided: value must be >= lo
        if value >= lo:
            return None, None
        span = lo * 0.4 if lo > 0 else 10.0
        deficit = (lo - value) / span
        direction = "low"
    else:
        span = hi - lo if hi != lo else 1.0
        if lo <= value <= hi:
            return None, None
        if value < lo:
            deficit = (lo - value) / span
            direction = "low"
        else:
            deficit = (value - hi) / span
            direction = "high"

    if deficit > 0.25:
        return "critical", direction
    if deficit > 0.10:
        return "warning", direction
    return None, None


def _evaluate_zone(zone: "_ZoneState") -> tuple[str, str]:
    """Return (plant_status, fault_type) based on CROP_TARGETS."""
    targets = CROP_TARGETS.get(zone.crop, CROP_TARGETS["lettuce"])
    param_values = {
        "water_temp_c": zone.water_temp_c,
        "air_temp_c":   zone.temp_c,
        "ph":           zone.ph,
        "ec_ppm":       zone.ec_ppm,
        "humidity_pct": zone.humidity_pct,
        "water_level":  zone.water_level,
    }
    worst_severity: str | None = None
    worst_fault: str | None = None
    _order = {"critical": 2, "warning": 1}

    for param, (lo, hi) in targets.items():
        severity, direction = _drift_severity(param_values[param], lo, hi)
        if severity and _order.get(severity, 0) > _order.get(worst_severity or "", 0):
            worst_severity = severity
            fault_label = _FAULT_PARAM_NAMES.get(param, param)
            worst_fault = f"{fault_label}_{direction}"

    return (worst_severity or "healthy", worst_fault or "none")


@dataclass
class _ZoneState:
    zone_id: str
    crop: str = "lettuce"
    temp_c: float = 22.0
    water_temp_c: float = 20.0
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
    ec_ppm: float = 1000.0
    plant_status: str = "healthy"
    fault_type: str = "none"
    target_temp_c: float = 22.0
    target_humidity_percent: float = 65.0
    last_updated: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


def _init_state() -> dict[str, _ZoneState]:
    return {
        f"pod_{i:03d}": _ZoneState(
            zone_id=f"pod_{i:03d}",
            crop=CROP_ORDER[(i - 1) % len(CROP_ORDER)],
        )
        for i in range(1, POD_COUNT + 1)
    }


_state.update(_init_state())


def _get_zone(zone_id: str) -> _ZoneState:
    if zone_id not in _state:
        crop = ZONE_CROP_MAP.get(zone_id, "lettuce")
        targets = CROP_TARGETS[crop]
        # Initialize at midpoint of each range so status starts healthy
        def _mid(lo: float, hi: float | None) -> float:
            return (lo + hi) / 2.0 if hi is not None else lo + 10.0
        zone = _ZoneState(
            zone_id=zone_id,
            crop=crop,
            temp_c=_mid(*targets["air_temp_c"]),
            water_temp_c=_mid(*targets["water_temp_c"]),
            humidity_pct=_mid(*targets["humidity_pct"]),
            ph=_mid(*targets["ph"]),
            ec_ppm=_mid(*targets["ec_ppm"]),
            water_level=_mid(*targets["water_level"]),
            target_temp_c=_mid(*targets["air_temp_c"]),
            target_humidity_percent=_mid(*targets["humidity_pct"]),
        )
        zone.plant_status, zone.fault_type = _evaluate_zone(zone)
        _state[zone_id] = zone
    return _state[zone_id]


def get_all_zone_ids() -> list[str]:
    return list(_state.keys())


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
        case "dose_acid":
            amount_ml = float(params.get("amount_ml", 10))
            zone.ph = max(4.0, zone.ph - amount_ml * 0.02)
        case "dose_base":
            amount_ml = float(params.get("amount_ml", 10))
            zone.ph = min(9.0, zone.ph + amount_ml * 0.02)
        case "dose_nutrients":
            amount_ml = float(params.get("amount_ml", 50))
            zone.ec_ppm = min(3000.0, zone.ec_ppm + amount_ml * 1.0)
        case "flush_reservoir":
            flush_pct = float(params.get("flush_percent", 20)) / 100.0
            zone.ec_ppm = max(100.0, zone.ec_ppm * (1.0 - flush_pct))
        case _:
            return {"ok": False, "error": f"Unknown command: {tool_name}"}

    return {"ok": True, "zone_id": zone_id, "command": tool_name, "state": asdict(zone)}


def get_sensor_state(zone_id: str) -> dict:
    zone = _get_zone(zone_id)
    return {
        "zone_id": zone_id,
        "crop": zone.crop,
        "temp_c": round(zone.temp_c, 2),
        "air_temp_c": round(zone.temp_c, 2),
        "water_temp_c": round(zone.water_temp_c, 2),
        "humidity_pct": round(zone.humidity_pct, 2),
        "water_level": round(zone.water_level, 1),
        "ph": round(zone.ph, 2),
        "ec_ppm": round(zone.ec_ppm, 1),
        "plant_status": zone.plant_status,
        "fault_type": zone.fault_type,
        "status": zone.plant_status,
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

            # Water temp tracks air temp with slight lag
            zone.water_temp_c = max(
                10.0, min(35.0, zone.water_temp_c + (zone.temp_c - zone.water_temp_c) * 0.05 + random.gauss(0, 0.1))
            )

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
            zone.ec_ppm = max(100.0, min(5000.0, zone.ec_ppm + random.gauss(0, 5.0)))
            zone.last_updated = datetime.now(timezone.utc).isoformat()

            # Recompute plant_status and fault_type from CROP_TARGETS
            zone.plant_status, zone.fault_type = _evaluate_zone(zone)

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
            # Re-evaluate after injected fault
            zone.plant_status, zone.fault_type = _evaluate_zone(zone)


def start_background_tick() -> None:
    global _tick_task
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        return
    if _tick_task is None or _tick_task.done():
        _tick_task = loop.create_task(_tick())
