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
    zone_id: str
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

    # Group pods by zone — pod IDs are prefixed with zone_id (e.g. "T1_pod001")
    pods_by_zone: dict[str, list[dict]] = {}
    for pod in pods:
        pod_id = pod.get("id", "")
        zone = pod.get("zone_id") or pod.get("table_id") or pod_id.split("_")[0]
        pods_by_zone.setdefault(zone, []).append(pod)

    readings: dict[str, SensorReading] = {}
    for zone_id in sim_bridge.get_all_zone_ids():
        zone_pods = pods_by_zone.get(zone_id, [])
        if not zone_pods:
            continue

        critical = sum(1 for p in zone_pods if p.get("status") == "critical")
        warning  = sum(1 for p in zone_pods if p.get("status") == "warning")
        healthy  = sum(1 for p in zone_pods if p.get("status") == "healthy")
        faults   = list({p["fault_type"] for p in zone_pods if p.get("fault_type", "none") != "none"})
        status   = "critical" if critical > 0 else ("warning" if warning > 0 else "healthy")

        def _avg(key: str, z: list[dict] = zone_pods) -> float:
            vals = [p[key] for p in z if key in p]
            return round(sum(vals) / len(vals), 3) if vals else 0.0

        readings[zone_id] = SensorReading(
            zone_id=zone_id,
            pod_ids=[p["id"] for p in zone_pods],
            avg_ph=_avg("ph"),
            avg_ec_ppm=round(_avg("ec_ppm"), 1),
            avg_temp_c=round(_avg("temp_c"), 2),
            avg_light_lux=round(_avg("light_lux"), 1),
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
