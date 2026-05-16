from __future__ import annotations

import contextlib

import asyncio
import json
import random
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Awaitable, Callable

import state

try:
    from hydroclawnics.sim_config import CROP_ORDER, POD_COUNT
except ModuleNotFoundError:
    from sim_config import CROP_ORDER, POD_COUNT

BASE_DIR = Path(__file__).resolve().parent
SENSORS_FILE = BASE_DIR / "sensors" / "pod_states.json"


@dataclass
class Pod:
    id: str
    crop: str
    ph: float
    ec_ppm: float
    temp_c: float
    light_lux: float
    status: str = "healthy"
    fault_type: str = "none"
    last_action: str = ""
    age_hours: float = 0.0


CROPS: dict[str, dict[str, tuple[float, float]]] = {
    "lettuce": {
        "ph": (5.5, 6.5),
        "ec_ppm": (800.0, 1200.0),
        "temp_c": (18.0, 24.0),
        "light_lux": (14000.0, 18000.0),
    },
    "tomato": {
        "ph": (5.5, 6.5),
        "ec_ppm": (1400.0, 3500.0),
        "temp_c": (20.0, 26.0),
        "light_lux": (20000.0, 40000.0),
    },
    "basil": {
        "ph": (5.8, 6.6),
        "ec_ppm": (1000.0, 1400.0),
        "temp_c": (20.0, 27.0),
        "light_lux": (18000.0, 24000.0),
    },
    "spinach": {
        "ph": (6.0, 7.0),
        "ec_ppm": (900.0, 1300.0),
        "temp_c": (16.0, 22.0),
        "light_lux": (12000.0, 17000.0),
    },
    "tomato": {
        "ph": (5.8, 6.8),
        "ec_ppm": (1800.0, 2800.0),
        "temp_c": (20.0, 26.0),
        "light_lux": (22000.0, 30000.0),
    },
}


def _gaussian(value: float, sigma: float, minimum: float = 0.0) -> float:
    return max(minimum, value + random.gauss(0.0, sigma))


def tick(pod: Pod, dt: float = 5.0) -> None:
    pod.ph = _gaussian(pod.ph, 0.03)
    pod.ec_ppm = _gaussian(pod.ec_ppm, 8.0)
    pod.temp_c = _gaussian(pod.temp_c, 0.15)
    pod.light_lux = _gaussian(pod.light_lux, 75.0)
    pod.age_hours += dt / 3600.0
    pod.status = compute_status(pod)


def inject_fault(pod: Pod, fault_type: str) -> None:
    pod.fault_type = fault_type
    if fault_type == "ph_crash":
        pod.ph = max(3.2, pod.ph - 1.8)
    elif fault_type == "nutrient_spike":
        pod.ec_ppm += 500.0
    elif fault_type == "heat_stress":
        pod.temp_c += 8.0
    elif fault_type == "nutrient_low":
        pod.ec_ppm = max(250.0, pod.ec_ppm - 450.0)
    pod.status = compute_status(pod)


def compute_status(pod: Pod) -> str:
    ranges = CROPS.get(pod.crop, CROPS["lettuce"])
    warnings = 0
    critical = 0
    for metric in ("ph", "ec_ppm", "temp_c", "light_lux"):
        value = getattr(pod, metric)
        lo, hi = ranges[metric]
        span = hi - lo
        warn_margin = 0.15 * span
        crit_margin = 0.35 * span

        if value < lo - crit_margin or value > hi + crit_margin:
            critical += 1
        elif value < lo - warn_margin or value > hi + warn_margin:
            warnings += 1

    if critical > 0:
        return "critical"
    if warnings > 0:
        return "warning"
    return "healthy"


class SimulatorEngine:
    def __init__(self) -> None:
        self._task: asyncio.Task[None] | None = None
        self._running = False
        self._listeners: list[Callable[[list[dict]], Awaitable[None] | None]] = []
        self.pods = self._init_pods()
        state.pods = self.pods

    def _init_pods(self) -> list[Pod]:
        crops = ["lettuce", "basil", "spinach", "tomato"]
        pods: list[Pod] = []
        for i in range(POD_COUNT):
            crop = CROP_ORDER[i % len(CROP_ORDER)]
            ranges = CROPS[crop]
            pods.append(
                Pod(
                    id=f"pod_{i + 1:03d}",
                    crop=crop,
                    ph=random.uniform(*ranges["ph"]),
                    ec_ppm=random.uniform(*ranges["ec_ppm"]),
                    temp_c=random.uniform(*ranges["temp_c"]),
                    light_lux=random.uniform(*ranges["light_lux"]),
                    age_hours=random.uniform(1.0, 240.0),
                )
            )
        for pod in pods:
            pod.status = compute_status(pod)
        return pods

    def add_listener(self, listener: Callable[[list[dict]], Awaitable[None] | None]) -> None:
        self._listeners.append(listener)

    async def start(self) -> None:
        if self._task and not self._task.done():
            return
        self._running = True
        self._task = asyncio.create_task(self._run(), name="simulator-loop")

    async def stop(self) -> None:
        self._running = False
        if self._task:
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._task

    def snapshot(self) -> list[dict]:
        return [asdict(pod) for pod in self.pods]

    async def _run(self) -> None:
        SENSORS_FILE.parent.mkdir(parents=True, exist_ok=True)
        while self._running:
            for pod in self.pods:
                tick(pod, dt=5.0)
            payload = self.snapshot()
            SENSORS_FILE.write_text(json.dumps(payload, indent=2), encoding="utf-8")

            for listener in self._listeners:
                result = listener(payload)
                if asyncio.iscoroutine(result):
                    await result

            await asyncio.sleep(5)
