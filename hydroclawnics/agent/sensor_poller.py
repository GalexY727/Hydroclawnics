from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

from . import sim_bridge

BASE_DIR = Path(__file__).resolve().parent.parent
SENSORS_FILE = BASE_DIR / "sensors" / "pod_states.json"
PODS_PER_TABLE = max(1, int(os.getenv("PODS_PER_TABLE", "100")))


@dataclass
class SensorReading:
    pod_id: str
    pod_ids: list[str]
    avg_ph: float
    avg_ec_ppm: float
    avg_temp_c: float
    avg_light_lux: float
    critical_count: int
    warning_count: int
    healthy_count: int
    status: str
    fault_types: list[str]
    pods: list[dict] = field(default_factory=list)
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


def read_all() -> dict[str, SensorReading]:
    if not SENSORS_FILE.exists():
        return {}
    try:
        pods: list[dict] = json.loads(SENSORS_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}

    # Reverse ZONE_CROP_MAP: crop → pod_id  (e.g. "lettuce" → "T1")
    crop_to_zone = {crop: zone for zone, crop in sim_bridge.ZONE_CROP_MAP.items()}

    # Group pods by zone using their crop field
    pods_by_zone: dict[str, list[dict]] = {}
    for pod in pods:
        zone = crop_to_zone.get(pod.get("crop", ""))
        if zone:
            pods_by_zone.setdefault(zone, []).append(pod)

    def _avg(key: str, z: list[dict]) -> float:
        vals = [p[key] for p in z if key in p]
        return round(sum(vals) / len(vals), 3) if vals else 0.0

    readings: dict[str, SensorReading] = {}
    for pod_id, zone_pods in pods_by_zone.items():
        critical = sum(1 for p in zone_pods if p.get("status") == "critical")
        warning  = sum(1 for p in zone_pods if p.get("status") == "warning")
        healthy  = sum(1 for p in zone_pods if p.get("status") == "healthy")
        faults   = list({p["fault_type"] for p in zone_pods if p.get("fault_type", "none") != "none"})
        status   = "critical" if critical > 0 else ("warning" if warning > 0 else "healthy")

        readings[pod_id] = SensorReading(
            pod_id=pod_id,
            pod_ids=[p["id"] for p in zone_pods],
            avg_ph=_avg("ph", zone_pods),
            avg_ec_ppm=round(_avg("ec_ppm", zone_pods), 1),
            avg_temp_c=round(_avg("temp_c", zone_pods), 2),
            avg_light_lux=round(_avg("light_lux", zone_pods), 1),
            critical_count=critical,
            warning_count=warning,
            healthy_count=healthy,
            status=status,
            fault_types=faults,
            pods=zone_pods[:PODS_PER_TABLE],
        )

    return readings


def read_table(table_id: str) -> SensorReading | None:
    return read_all().get(table_id)
