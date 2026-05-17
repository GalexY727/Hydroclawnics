from __future__ import annotations

from dataclasses import dataclass


@dataclass
class ToolDef:
    name: str
    description: str
    parameters: dict


TOOLS: list[ToolDef] = [
    ToolDef(
        name="turn_fan_on",
        description=(
            "Activate the zone ventilation fan. Use when zone temperature exceeds target by >2°C, "
            "humidity is elevated above 75%, or air needs circulation after an out-of-range event. "
            "Has immediate cooling and air-exchange effect."
        ),
        parameters={
            "type": "object",
            "properties": {"pod_id": {"type": "string", "description": "Pod ID (e.g. pod_001)"}},
            "required": ["pod_id"],
        },
    ),
    ToolDef(
        name="turn_fan_off",
        description=(
            "Deactivate the zone ventilation fan. Use only when temperature and humidity are within "
            "acceptable range and no active heat event is in progress. "
            "Never turn off during heat_stress_mode."
        ),
        parameters={
            "type": "object",
            "properties": {"pod_id": {"type": "string", "description": "Pod ID (e.g. pod_001)"}},
            "required": ["pod_id"],
        },
    ),
    ToolDef(
        name="set_fan_speed",
        description=(
            "Set fan speed as a percentage (0–100). Use 25–50% for gentle air circulation during "
            "normal operation; 75–100% during heat stress or elevated humidity. "
            "Prefer adjusting speed before full on/off toggle — it is the most conservative action."
        ),
        parameters={
            "type": "object",
            "properties": {
                "pod_id": {"type": "string", "description": "Pod ID (e.g. pod_001)"},
                "speed_percent": {
                    "type": "integer",
                    "minimum": 0,
                    "maximum": 100,
                    "description": "Fan speed as a percentage 0–100",
                },
            },
            "required": ["pod_id", "speed_percent"],
        },
    ),
    ToolDef(
        name="open_vent",
        description=(
            "Open the passive ventilation vent for a zone. Increases passive airflow and reduces "
            "humidity. Combine with fan for maximum air exchange during heat events."
        ),
        parameters={
            "type": "object",
            "properties": {"pod_id": {"type": "string"}},
            "required": ["pod_id"],
        },
    ),
    ToolDef(
        name="close_vent",
        description=(
            "Close the passive vent. Use to retain heat during cold periods or when external air "
            "quality is poor. Do not close during heat_stress_mode."
        ),
        parameters={
            "type": "object",
            "properties": {"pod_id": {"type": "string"}},
            "required": ["pod_id"],
        },
    ),
    ToolDef(
        name="turn_heater_on",
        description=(
            "Activate the zone heater. Use when zone temperature drops >2°C below the target. "
            "The heater will automatically disable the cooler for safety. "
            "Never manually run simultaneously with cooler in the same zone."
        ),
        parameters={
            "type": "object",
            "properties": {"pod_id": {"type": "string"}},
            "required": ["pod_id"],
        },
    ),
    ToolDef(
        name="turn_heater_off",
        description=(
            "Deactivate the zone heater. Always call this before turning on the cooler in the same zone. "
            "Safe to call even if heater is already off."
        ),
        parameters={
            "type": "object",
            "properties": {"pod_id": {"type": "string"}},
            "required": ["pod_id"],
        },
    ),
    ToolDef(
        name="turn_cooler_on",
        description=(
            "Activate zone active cooling. Use when temperature exceeds target by >3°C. "
            "The cooler will automatically disable the heater for safety. "
            "Never manually run simultaneously with heater in the same zone."
        ),
        parameters={
            "type": "object",
            "properties": {"pod_id": {"type": "string"}},
            "required": ["pod_id"],
        },
    ),
    ToolDef(
        name="turn_cooler_off",
        description=(
            "Deactivate zone active cooling. Call when temperature returns to within 1°C of target "
            "or before activating the heater."
        ),
        parameters={
            "type": "object",
            "properties": {"pod_id": {"type": "string"}},
            "required": ["pod_id"],
        },
    ),
    ToolDef(
        name="turn_humidifier_on",
        description=(
            "Activate the humidifier. Use when relative humidity drops below 50% for leafy crops. "
            "The humidifier will automatically disable the dehumidifier. "
            "Never run simultaneously with dehumidifier."
        ),
        parameters={
            "type": "object",
            "properties": {"pod_id": {"type": "string"}},
            "required": ["pod_id"],
        },
    ),
    ToolDef(
        name="turn_humidifier_off",
        description=(
            "Deactivate the humidifier. Call when humidity reaches target range or before "
            "turning on the dehumidifier. Safe to call even if already off."
        ),
        parameters={
            "type": "object",
            "properties": {"pod_id": {"type": "string"}},
            "required": ["pod_id"],
        },
    ),
    ToolDef(
        name="turn_dehumidifier_on",
        description=(
            "Activate the dehumidifier. Use when humidity exceeds 80% to prevent mold and root "
            "disease. The dehumidifier will automatically disable the humidifier. "
            "Never run simultaneously with humidifier."
        ),
        parameters={
            "type": "object",
            "properties": {"pod_id": {"type": "string"}},
            "required": ["pod_id"],
        },
    ),
    ToolDef(
        name="turn_dehumidifier_off",
        description=(
            "Deactivate the dehumidifier. Call when humidity drops to target range or before "
            "activating the humidifier."
        ),
        parameters={
            "type": "object",
            "properties": {"pod_id": {"type": "string"}},
            "required": ["pod_id"],
        },
    ),
    ToolDef(
        name="set_climate_target",
        description=(
            "Update the climate control target temperature and humidity for a zone. Call when "
            "crop type changes, seasonal adjustment is needed, or the supervisor issues a "
            "reconfiguration directive."
        ),
        parameters={
            "type": "object",
            "properties": {
                "pod_id": {"type": "string"},
                "target_temp_c": {
                    "type": "number",
                    "description": "Target temperature in Celsius",
                },
                "target_humidity_percent": {
                    "type": "number",
                    "description": "Target relative humidity 0–100",
                },
            },
            "required": ["pod_id", "target_temp_c", "target_humidity_percent"],
        },
    ),
    ToolDef(
        name="enter_heat_stress_mode",
        description=(
            "Activate heat stress emergency protocol: sets fan to 100%, opens vent, enables cooler, "
            "disables heater. Use when zone temperature exceeds 32°C or any pod reports a "
            "heat-stress condition. This is a compound emergency action."
        ),
        parameters={
            "type": "object",
            "properties": {"pod_id": {"type": "string"}},
            "required": ["pod_id"],
        },
    ),
    ToolDef(
        name="enter_high_humidity_mode",
        description=(
            "Activate high-humidity emergency protocol: enables dehumidifier, sets fan to 75%, "
            "disables humidifier. Use when humidity exceeds 85% or mold risk is detected. "
            "This is a compound emergency action."
        ),
        parameters={
            "type": "object",
            "properties": {"pod_id": {"type": "string"}},
            "required": ["pod_id"],
        },
    ),
    ToolDef(
        name="set_light_level",
        description=(
            "Set a pod's grow light level to a target lux value. Use when light_lux is outside "
            "the crop's healthy range. Calculate target_lux as the midpoint of the crop's light range."
        ),
        parameters={
            "type": "object",
            "properties": {
                "pod_id": {"type": "string", "description": "Pod ID (e.g. pod_001)"},
                "target_lux": {
                    "type": "number",
                    "minimum": 1000,
                    "maximum": 60000,
                    "description": "Target light intensity in lux",
                },
            },
            "required": ["pod_id", "target_lux"],
        },
    ),
    ToolDef(
        name="dose_acid",
        description=(
            "Add acid solution to lower the pH of a specific pod's solution. Use when a pod's pH "
            "is above the target range. Calculate amount_ml from the current pH and crop target midpoint. "
            "Each 10 ml lowers pH by "
            "~0.2 units. Target only the pod(s) that are out of range."
        ),
        parameters={
            "type": "object",
            "properties": {
                "pod_id": {"type": "string", "description": "Pod ID (e.g. pod_001)"},
                "amount_ml": {
                    "type": "number",
                    "minimum": 1,
                    "maximum": 120,
                    "description": "Volume of acid solution to add in millilitres",
                },
            },
            "required": ["pod_id", "amount_ml"],
        },
    ),
    ToolDef(
        name="dose_base",
        description=(
            "Add pH-up (base) solution to raise the pH of a specific pod's solution. Use when a "
            "pod's pH is below the target range. Calculate amount_ml from the current pH and crop target midpoint. Each 10 ml raises "
            "pH by ~0.2 units. Target only the pod(s) that are out of range."
        ),
        parameters={
            "type": "object",
            "properties": {
                "pod_id": {"type": "string", "description": "Pod ID (e.g. pod_001)"},
                "amount_ml": {
                    "type": "number",
                    "minimum": 1,
                    "maximum": 120,
                    "description": "Volume of base solution to add in millilitres",
                },
            },
            "required": ["pod_id", "amount_ml"],
        },
    ),
    ToolDef(
        name="dose_nutrients",
        description=(
            "Add concentrated nutrient solution to raise the EC of a specific pod. Use when a "
            "pod's EC is below the target range for the crop. Calculate amount_ml from the current EC "
            "and crop target midpoint. Each 1 ml raises EC by ~1 ppm. Target only the pod(s) that are out of range."
        ),
        parameters={
            "type": "object",
            "properties": {
                "pod_id": {"type": "string", "description": "Pod ID (e.g. pod_001)"},
                "amount_ml": {
                    "type": "number",
                    "minimum": 10,
                    "maximum": 1500,
                    "description": "Volume of nutrient concentrate to add in millilitres",
                },
            },
            "required": ["pod_id", "amount_ml"],
        },
    ),
    ToolDef(
        name="flush_reservoir",
        description=(
            "Dilute a specific pod's solution with fresh water to lower its EC. Use when a pod's "
            "EC is above the target range. Calculate flush_percent from current EC and crop target midpoint. "
            "Target only the pod(s) that are out of range."
        ),
        parameters={
            "type": "object",
            "properties": {
                "pod_id": {"type": "string", "description": "Pod ID (e.g. pod_001)"},
                "flush_percent": {
                    "type": "number",
                    "minimum": 10,
                    "maximum": 80,
                    "description": "Percentage of solution to replace with fresh water",
                },
            },
            "required": ["pod_id", "flush_percent"],
        },
    ),
]

TOOL_MAP: dict[str, ToolDef] = {t.name: t for t in TOOLS}


def as_openai_tools() -> list[dict]:
    return [
        {
            "type": "function",
            "function": {
                "name": t.name,
                "description": t.description,
                "parameters": t.parameters,
            },
        }
        for t in TOOLS
    ]


def execute_tool(name: str, params: dict) -> dict:
    from . import bridge_router

    if name not in TOOL_MAP:
        return {"ok": False, "error": f"Unknown tool: {name}"}
    return bridge_router.execute_command(name, params)
