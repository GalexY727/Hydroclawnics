-- THIS PROMPT HAS ALREADY BEEN EXECUTED, DO NOT ATTEMPT TO MAKE THESE CHANGES
Create a branch off of the one you were previously on titled "agent-folder"
Create the ./hydroclawnics/agent/ folder and all files needed to integrate
a NemoClaw agent (running on NVIDIA Brev) with the existing FastAPI + WebSocket
backend. The agent is the brain — it reads sensor state and calls tools to
control the farm. It must work identically whether talking to real Arduino
hardware or the simulation.

## FOLDER STRUCTURE TO CREATE
hydroclawnics/agent/
  __init__.py
  tool_registry.py       # All 16 Arduino functions as NemoClaw tools
  hardware_bridge.py     # Serial comms to Arduino
  sim_bridge.py          # Drop-in sim replacement
  bridge_router.py       # Routes based on HARDWARE_MODE env var
  agent_runner.py        # NemoClaw agent loop + Brev client setup
  action_log.py          # JSON-lines action logger (no DB)
  sensor_poller.py       # Polls current sensor/sim state, publishes to WS

## THE 16 TOOLS
Register all of the following as NemoClaw tool definitions.
Each tool must have: name, description, parameters (zone_id always required),
and an execute() method that routes to bridge_router.

Tools and their signatures:
  turn_fan_on(zone_id)
  turn_fan_off(zone_id)
  set_fan_speed(zone_id, speed_percent: int 0-100)
  open_vent(zone_id)
  close_vent(zone_id)
  turn_heater_on(zone_id)
  turn_heater_off(zone_id)
  turn_cooler_on(zone_id)
  turn_cooler_off(zone_id)
  turn_humidifier_on(zone_id)
  turn_humidifier_off(zone_id)
  turn_dehumidifier_on(zone_id)
  turn_dehumidifier_off(zone_id)
  set_climate_target(zone_id, target_temp_c: float, target_humidity_percent: float)
  enter_heat_stress_mode(zone_id)
  enter_high_humidity_mode(zone_id)

Each tool description should be rich enough for the agent to reason about when
to use it — e.g. "Use when zone temperature exceeds target by more than 3°C
and fan is currently off."

## BRIDGE ROUTER (bridge_router.py)
Read HARDWARE_MODE env var (default: "false").
  if HARDWARE_MODE == "true": delegate to hardware_bridge.py
  else: delegate to sim_bridge.py
Both bridges must expose identical interfaces:
  def execute_command(tool_name: str, params: dict) -> dict
  def get_sensor_state(zone_id: str) -> SensorReading

## HARDWARE BRIDGE (hardware_bridge.py)
- Connect to Arduino via serial (port from ARDUINO_PORT env var, default /dev/ttyUSB0)
- Serialize tool calls as JSON lines over serial: {"cmd": "turn_fan_on", "zone": "A"}
- Read response line back: {"ok": true} or {"ok": false, "error": "..."}
- Timeout: 2s per command, retry once, then raise HardwareError
- get_sensor_state(): send {"cmd": "read_sensors", "zone": zone_id},
  parse response into SensorReading

## SIM BRIDGE (sim_bridge.py)
- This is the DROP-IN REPLACEMENT for hardware
- Maintain a SimState dict: one entry per zone_id (zones: "A" through "T" for
  20 pods, plus "PHYSICAL" for the real pot)
- Each zone state: { temp_c, humidity_pct, fan_on, fan_speed, vent_open,
  heater_on, cooler_on, humidifier_on, dehumidifier_on,
  water_level, ph, health_score }
- execute_command(): update SimState based on the command
  e.g. turn_fan_on sets fan_on=True, gradually decreases temp over time
- get_sensor_state(): return current SimState for zone
- Add a background tick() that runs every 5s:
  - Slowly drifts temp/humidity if no active control
  - Randomly flags 1-2 zones as warning or critical to simulate real conditions
  - Updates health_score based on distance from climate targets
- Expose SimState as a property so sensor_poller.py can read all zones at once

## SENSOR POLLER (sensor_poller.py)
- Polls all zones every 3 seconds
- Calls bridge_router.get_sensor_state(zone_id) for each zone
- Publishes full farm state as JSON to the existing WebSocket endpoint:
  { "type": "sensor_update", "zones": { zone_id: SensorReading, ... } }
- SensorReading model:
  { zone_id, temp_c, humidity_pct, water_level, ph, health_score,
    status: "healthy"|"warning"|"critical", fan_on, heater_on, cooler_on,
    humidifier_on, dehumidifier_on, vent_open, fan_speed, timestamp }
- Determine status automatically:
    critical if health_score < 0.4 OR temp > 35 OR ph < 5.5 OR ph > 7.5
    warning  if health_score < 0.7 OR temp > 30 OR ph < 6.0 OR ph > 7.0
    healthy  otherwise

## ACTION LOGGER (action_log.py)
- Write every agent action as a JSON line to ./logs/agent_actions.jsonl
- Format: { "ts": ISO8601, "zone_id", "tool", "params", "result", "reasoning" }
- reasoning = the agent's chain-of-thought text (passed in from agent_runner)
- Also publish to WebSocket as { "type": "agent_action", ...same fields }
  so the frontend reasoning feed updates in real time
- Expose last_n(n=50) -> list for the frontend to fetch on load

## AGENT RUNNER (agent_runner.py)
- Connect to NemoClaw on Brev using env vars:
    NEMOCLAW_ENDPOINT (the Brev-deployed NemoClaw URL)
    NEMOCLAW_API_KEY
- System prompt for the agent (include this verbatim):
  "You are an autonomous hydroponics farm manager. Your job is to monitor
  sensor readings across all zones and take corrective actions to keep plants
  healthy. You have access to 16 tools to control climate per zone.
  Always explain your reasoning before taking an action. Prioritize critical
  zones first. Never run heating and cooling simultaneously in the same zone.
  When in doubt, prefer conservative actions (reduce fan speed before turning
  off entirely)."
- Agent loop:
  1. Every 30 seconds (configurable via AGENT_INTERVAL_S env var):
     a. Fetch full farm state from sensor_poller (or directly from bridge_router)
     b. Send state + tool definitions to NemoClaw
     c. Parse tool_call blocks from response
     d. Execute each tool call via tool_registry
     e. Log action + reasoning via action_log.py
     f. Publish agent reasoning text to WebSocket as:
        { "type": "agent_thought", "text": "...", "ts": ISO8601 }
  2. Handle NemoClaw returning no tool calls (agent decided no action needed)
     — log as { "tool": "no_op", "reasoning": "..." }
  3. On NemoClaw error: log error, skip cycle, retry next interval

## INTEGRATION REQUIREMENTS
- agent_runner.py should be startable as: python -m hydroclawnics.agent.agent_runner
- It must import cleanly alongside the existing FastAPI app
- Add a /agent/status endpoint to the existing FastAPI app that returns:
  { "running": bool, "last_cycle_ts": ISO8601, "cycles_completed": int,
    "hardware_mode": bool, "zones_monitored": int }
- Add a /agent/logs endpoint that returns last 50 actions from action_log
- Do NOT touch existing WebSocket handler — just publish to it via the
  existing broadcast() function (or whatever it's called in the current code)

## ENV VARS SUMMARY
  HARDWARE_MODE=false       # true = Arduino, false = sim
  ARDUINO_PORT=/dev/ttyUSB0
  NEMOCLAW_ENDPOINT=https://...brev.dev/...
  NEMOCLAW_API_KEY=...
  AGENT_INTERVAL_S=30

## CONSTRAINTS
- Python 3.11+
- No new database — logs are flat JSON lines only
- Async where possible (asyncio / FastAPI background tasks)
- If NemoClaw SDK import fails, raise a clear error with setup instructions
- Sim bridge must work fully offline (no network needed for demo mode)
- All 16 tools must be individually testable: add a simple
  agent/test_tools.py that fires each tool against the sim and prints results

## SUCCESS CRITERIA
- python -m hydroclawnics.agent.agent_runner starts without errors
- Sim bridge ticks, drifts state, generates warnings autonomously
- All 16 tools route correctly in both sim and hardware mode
- Agent reasoning appears in WebSocket stream within 30s of start
- /agent/status returns correct state
- test_tools.py passes all 16 tools against sim

After you have finished this, you can go ahead and make the fleshed out version of ./.github/workflows/deploy.yml as well as ./deploy.sh for the brev instance

After you finish with everything. Commit it and push it, and make a pull request on my behalf for this branch to go to the one it was forked off of.