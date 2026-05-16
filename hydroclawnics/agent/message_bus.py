from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
_DB_DEFAULT = str(BASE_DIR / "db" / "nemoclaw.db")
DB_PATH = Path(os.getenv("AGENT_DB_PATH", _DB_DEFAULT))


def _connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), timeout=10, check_same_thread=False)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with _connect() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS directives (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                table_id     TEXT NOT NULL,
                directive    TEXT NOT NULL,
                created_at   TEXT NOT NULL,
                consumed_at  TEXT
            );
            CREATE TABLE IF NOT EXISTS table_reports (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                table_id     TEXT NOT NULL,
                report       TEXT NOT NULL,
                created_at   TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS agent_actions (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                ts           TEXT NOT NULL,
                agent_type   TEXT NOT NULL,
                table_id     TEXT,
                tool         TEXT NOT NULL,
                params       TEXT NOT NULL,
                result       TEXT NOT NULL,
                reasoning    TEXT
            );
        """)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def write_directive(table_id: str, directive: dict) -> int:
    with _connect() as conn:
        cur = conn.execute(
            "INSERT INTO directives (table_id, directive, created_at) VALUES (?, ?, ?)",
            (table_id, json.dumps(directive), _now()),
        )
        return cur.lastrowid  # type: ignore[return-value]


def fetch_unread_directives(table_id: str) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT id, directive FROM directives WHERE table_id=? AND consumed_at IS NULL ORDER BY id",
            (table_id,),
        ).fetchall()
    return [{"id": r["id"], **json.loads(r["directive"])} for r in rows]


def mark_directive_consumed(directive_id: int) -> None:
    with _connect() as conn:
        conn.execute(
            "UPDATE directives SET consumed_at=? WHERE id=?",
            (_now(), directive_id),
        )


def write_table_report(table_id: str, report: dict) -> None:
    with _connect() as conn:
        conn.execute(
            "INSERT INTO table_reports (table_id, report, created_at) VALUES (?, ?, ?)",
            (table_id, json.dumps(report), _now()),
        )


def get_latest_reports() -> dict[str, dict]:
    with _connect() as conn:
        rows = conn.execute("""
            SELECT t1.table_id, t1.report, t1.created_at
            FROM table_reports t1
            INNER JOIN (
                SELECT table_id, MAX(id) AS max_id FROM table_reports GROUP BY table_id
            ) t2 ON t1.table_id = t2.table_id AND t1.id = t2.max_id
        """).fetchall()
    return {
        r["table_id"]: {**json.loads(r["report"]), "created_at": r["created_at"]}
        for r in rows
    }


def log_action(
    agent_type: str,
    table_id: str | None,
    tool: str,
    params: dict,
    result: dict,
    reasoning: str | None = None,
) -> None:
    with _connect() as conn:
        conn.execute(
            "INSERT INTO agent_actions (ts, agent_type, table_id, tool, params, result, reasoning) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (_now(), agent_type, table_id, tool, json.dumps(params), json.dumps(result), reasoning),
        )


def get_recent_actions(n: int = 50) -> list[dict]:
    with _connect() as conn:
        rows = conn.execute(
            "SELECT * FROM agent_actions ORDER BY id DESC LIMIT ?", (n,)
        ).fetchall()
    return [dict(r) for r in reversed(rows)]


def get_supervisor_last_cycle() -> str | None:
    with _connect() as conn:
        row = conn.execute(
            "SELECT ts FROM agent_actions WHERE agent_type='supervisor' ORDER BY id DESC LIMIT 1"
        ).fetchone()
    return row["ts"] if row else None


def get_table_last_cycles() -> dict[str, str]:
    with _connect() as conn:
        rows = conn.execute("""
            SELECT t1.table_id, t1.ts
            FROM agent_actions t1
            INNER JOIN (
                SELECT table_id, MAX(id) AS max_id
                FROM agent_actions
                WHERE agent_type = 'table'
                GROUP BY table_id
            ) t2 ON t1.table_id = t2.table_id AND t1.id = t2.max_id
        """).fetchall()
    return {r["table_id"]: r["ts"] for r in rows}
