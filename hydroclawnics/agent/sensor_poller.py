from __future__ import annotations

import json
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

    pods_by_id = {pod.get("id"): pod for pod in pods}

    readings: dict[str, SensorReading] = {}
    for zone_id in sim_bridge.get_all_zone_ids():
        pod = pods_by_id.get(zone_id)
        if pod is None:
            continue

        critical = 1 if pod.get("status") == "critical" else 0
        warning = 1 if pod.get("status") == "warning" else 0
        healthy = 1 if pod.get("status") == "healthy" else 0
        faults = [pod["fault_type"]] if pod.get("fault_type", "none") != "none" else []

        status = "critical" if critical > 0 else ("warning" if warning > 0 else "healthy")

        readings[zone_id] = SensorReading(
            zone_id=zone_id,
            pod_ids=[pod["id"]],
            avg_ph=round(pod["ph"], 3),
            avg_ec_ppm=round(pod["ec_ppm"], 1),
            avg_temp_c=round(pod["temp_c"], 2),
            avg_light_lux=round(pod["light_lux"], 1),
            critical_count=critical,
            warning_count=warning,
            healthy_count=healthy,
            status=status,
            fault_types=faults,
            pods=table_pods,
        )

    return readings


def read_table(table_id: str) -> SensorReading | None:
    return read_all().get(table_id)
