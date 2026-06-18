from __future__ import annotations

import asyncio
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from hydroclawnics.agent import action_log, message_bus, sensor_poller, table_runner
from hydroclawnics.agent.llm_client import LLMConfig, load_llm_config
from hydroclawnics.agent.tool_registry import as_openai_tools


def _demo_config() -> LLMConfig:
    return LLMConfig(
        provider="none",
        base_url=None,
        api_key=None,
        table_model="deterministic-table-agent",
        supervisor_model="deterministic-supervisor",
        table_interval_s=1,
        supervisor_interval_s=1,
        enable_thinking=False,
        demo_mode=True,
    )


def _write_demo_pods(path: Path) -> None:
    pods = [
        {
            "id": "pod_001",
            "crop": "lettuce",
            "ph": 7.4,
            "ec_ppm": 1000.0,
            "temp_c": 21.0,
            "light_lux": 16000.0,
            "status": "warning",
            "fault_type": "ph_high",
            "age_hours": 24.0,
        },
        {
            "id": "pod_002",
            "crop": "lettuce",
            "ph": 6.1,
            "ec_ppm": 1000.0,
            "temp_c": 21.0,
            "light_lux": 16000.0,
            "status": "healthy",
            "fault_type": "none",
            "age_hours": 24.0,
        },
    ]
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(pods), encoding="utf-8")


class LocalDemoSmokeTests(unittest.TestCase):
    def test_provider_config_defaults_to_none_without_nvidia(self) -> None:
        with patch.dict(os.environ, {"LLM_PROVIDER": "none"}, clear=True):
            config = load_llm_config()
        self.assertEqual(config.provider, "none")
        self.assertTrue(config.is_mock)
        self.assertEqual(config.table_model, "deterministic-table-agent")

    def test_tool_registry_exports_openai_tools(self) -> None:
        tools = as_openai_tools()
        self.assertGreater(len(tools), 0)
        first = tools[0]
        self.assertEqual(first["type"], "function")
        self.assertIn("name", first["function"])
        self.assertEqual(first["function"]["parameters"]["type"], "object")

    def test_deterministic_fallback_corrects_warning_pods(self) -> None:
        reading = sensor_poller.SensorReading(
            pod_id="T1",
            pod_ids=["pod_001"],
            avg_ph=7.4,
            avg_ec_ppm=1000.0,
            avg_temp_c=21.0,
            avg_light_lux=16000.0,
            critical_count=0,
            warning_count=1,
            healthy_count=0,
            status="warning",
            fault_types=["ph_high"],
            pods=[
                {
                    "id": "pod_001",
                    "crop": "lettuce",
                    "ph": 7.4,
                    "ec_ppm": 1000.0,
                    "temp_c": 21.0,
                    "light_lux": 16000.0,
                    "status": "warning",
                    "fault_type": "ph_high",
                }
            ],
        )
        old_db = message_bus.DB_PATH
        old_log = action_log.LOG_FILE
        old_decisions = action_log.DECISIONS_FILE
        try:
            with tempfile.TemporaryDirectory() as tmp:
                message_bus.DB_PATH = Path(tmp) / "agents.db"
                action_log.LOG_FILE = Path(tmp) / "agent_actions.jsonl"
                action_log.DECISIONS_FILE = Path(tmp) / "decisions.jsonl"
                message_bus.init_db()
                actions = table_runner._fallback_range_actions(reading, "cycle-1")
        finally:
            message_bus.DB_PATH = old_db
            action_log.LOG_FILE = old_log
            action_log.DECISIONS_FILE = old_decisions
        self.assertEqual(actions[0]["tool"], "dose_acid")
        self.assertEqual(actions[0]["params"]["pod_id"], "pod_001")

    def test_table_runner_completes_mock_cycle(self) -> None:
        async def run_cycle() -> None:
            old_sensors = sensor_poller.SENSORS_FILE
            old_db = message_bus.DB_PATH
            old_log = action_log.LOG_FILE
            old_decisions = action_log.DECISIONS_FILE
            try:
                with tempfile.TemporaryDirectory() as tmp:
                    base = Path(tmp)
                    sensor_poller.SENSORS_FILE = base / "pod_states.json"
                    message_bus.DB_PATH = base / "agents.db"
                    action_log.LOG_FILE = base / "agent_actions.jsonl"
                    action_log.DECISIONS_FILE = base / "decisions.jsonl"
                    _write_demo_pods(sensor_poller.SENSORS_FILE)
                    message_bus.init_db()
                    await table_runner._run_cycle("T1", client=None, config=_demo_config())
                    reports = message_bus.get_latest_reports()
                    self.assertIn("T1", reports)
                    self.assertGreaterEqual(len(reports["T1"]["actions_taken"]), 1)
            finally:
                sensor_poller.SENSORS_FILE = old_sensors
                message_bus.DB_PATH = old_db
                action_log.LOG_FILE = old_log
                action_log.DECISIONS_FILE = old_decisions

        asyncio.run(run_cycle())

    def test_app_imports_without_nvidia_key(self) -> None:
        with patch.dict(os.environ, {"LLM_PROVIDER": "none", "DEMO_AUTOSTART_AGENTS": "false"}, clear=True):
            from fastapi.testclient import TestClient
            from hydroclawnics.main import app

            with TestClient(app) as client:
                response = client.get("/api/pods")
        self.assertEqual(response.status_code, 200)
        self.assertGreater(len(response.json()), 0)


if __name__ == "__main__":
    unittest.main()
