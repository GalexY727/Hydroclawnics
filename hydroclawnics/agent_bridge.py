from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Awaitable, Callable

BASE_DIR = Path(__file__).resolve().parent
DECISIONS_FILE = BASE_DIR / "memory" / "decisions.jsonl"


async def tail_decisions(broadcast_fn: Callable[[dict], Awaitable[None]]) -> None:
    offset = 0
    while True:
        try:
            if DECISIONS_FILE.exists():
                with DECISIONS_FILE.open("r", encoding="utf-8") as fp:
                    fp.seek(offset)
                    for line in fp:
                        stripped = line.strip()
                        if not stripped:
                            continue
                        try:
                            entry = json.loads(stripped)
                        except json.JSONDecodeError:
                            continue
                        await broadcast_fn(entry)
                    offset = fp.tell()
        except FileNotFoundError:
            pass
        await asyncio.sleep(1)
