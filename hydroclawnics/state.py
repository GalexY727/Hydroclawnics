from __future__ import annotations

from threading import Lock
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from simulator import Pod

pods: list[Pod] = []
decision_log: list[dict[str, Any]] = []
_decision_lock = Lock()


def append_decision(entry: dict[str, Any]) -> None:
    with _decision_lock:
        decision_log.append(entry)
