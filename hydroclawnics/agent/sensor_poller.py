from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
SENSORS_FILE = BASE_DIR / "sensors" / "pod_states.json"
PODS_PER_TABLE = int(os.getenv("PODS_PER_TABLE", "5"))


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
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


def _table_id_for_index(pod_index: int) -> str:
    return f"T{pod_index // PODS_PER_TABLE + 1}"


def read_all() -> dict[str, SensorReading]:
    if not SENSORS_FILE.exists():
        return {}
    try:
        pods: list[dict] = json.loads(SENSORS_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}

    tables: dict[str, list[dict]] = {}
    for i, pod in enumerate(pods):
        tid = _table_id_for_index(i)
        tables.setdefault(tid, []).append(pod)

    readings: dict[str, SensorReading] = {}
    for tid, table_pods in tables.items():
        ph_vals = [p["ph"] for p in table_pods]
        ec_vals = [p["ec_ppm"] for p in table_pods]
        temp_vals = [p["temp_c"] for p in table_pods]
        lux_vals = [p["light_lux"] for p in table_pods]

        critical = sum(1 for p in table_pods if p.get("status") == "critical")
        warning = sum(1 for p in table_pods if p.get("status") == "warning")
        healthy = sum(1 for p in table_pods if p.get("status") == "healthy")
        faults = [p["fault_type"] for p in table_pods if p.get("fault_type", "none") != "none"]

        status = "critical" if critical > 0 else ("warning" if warning > 0 else "healthy")

        readings[tid] = SensorReading(
            zone_id=tid,
            pod_ids=[p["id"] for p in table_pods],
            avg_ph=round(sum(ph_vals) / len(ph_vals), 3),
            avg_ec_ppm=round(sum(ec_vals) / len(ec_vals), 1),
            avg_temp_c=round(sum(temp_vals) / len(temp_vals), 2),
            avg_light_lux=round(sum(lux_vals) / len(lux_vals), 1),
            critical_count=critical,
            warning_count=warning,
            healthy_count=healthy,
            status=status,
            fault_types=faults,
        )

    return readings


def read_table(table_id: str) -> SensorReading | None:
    return read_all().get(table_id)
