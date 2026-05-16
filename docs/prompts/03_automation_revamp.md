-- THIS PROMPT HAS ALREADY BEEN EXECUTED, DO NOT ATTEMPT TO MAKE THESE CHANGES

Update the frontend with three focused changes:
1. Add an Automation tab with a 3D viewport and agent activity feed
2. Add 3D-only toast labels floating above plants in the Three.js scene

No toast notifications anywhere outside the 3D scene.
No changes to the existing dashboard notification system.

## CONTEXT
Stack: React + Three.js. WebSocket delivers agent events.
The 3D scene already supports click-to-orbit on individual plants.
New WebSocket events available (already implemented in backend):
  "pod_agent_update": { pod_id, zone_id, tool, params, reason, status, ts, cycle_id }
  "agent_cycle_summary": { ts, cycle_id, duration_ms, zones_evaluated,
    actions_taken, no_ops, critical_zones, warning_zones, summary_text,
    actions: [{ zone_id, pod_id, tool, params, reason, ts }] }
New endpoint available: GET /agent/pod/{pod_id}/reasoning
Design system: Gruvbox-inspired, muted sage/amber/dusty rose/soft blue,
8px grid, Inter font, dark theme, 8px border-radius.

---

## TASK 1: Automation Tab

Add "Automation" as a new tab in the main dashboard navigation.

Layout:
  LEFT PANEL (60%) — 3D viewport
    - Reuse the existing Three.js 3D farm view (same renderer instance)
    - Full height, always visible when Automation tab is active
    - 3D toast labels appear here (Task 2)
    - Small HUD overlay in bottom-left corner:
        "Auto-tracking: pod_13" when orbiting a specific plant
        "Free camera" when not tracking
        Muted text, 12px, no background — just sits in the corner

  RIGHT PANEL (40%) — Agent activity feed
    - Header: "Agent Activity" + subtle pulsing green dot when agent
      is running (CSS animation, no libraries)
    - Displays agent_cycle_summary events as cards, newest first
    - Each summary card:
        Top line: timestamp (muted, small) + cycle duration (muted, small, right-aligned)
        Summary text (500 weight, wraps naturally, full text — no truncation here)
        Zone chips row: critical zones in dusty rose, warning zones in amber,
          each as a small pill showing zone_id
        Expandable section: clicking card reveals individual actions list
          Each action: pod_id chip + tool label (human-readable, see mapping
          in Task 2) + reason text (muted, 2 lines max)
        Left border color:
          dusty rose (#c47a7a) if critical_zones is non-empty
          amber (#c8a84b) if warning_zones is non-empty, no criticals
          sage green (#7aad7a) if actions_taken === 0 (all no-ops)
    - Max 50 cards rendered, drop oldest
    - Empty state: "Waiting for first agent cycle..." centered, muted italic

---
Work with the existing framework, integration should be fairly simple. The right panel is already always active, don't overcomplicate that part.

## TASK 2: 3D Toast Labels (inside Three.js scene ONLY)

When a "pod_agent_update" WebSocket event arrives with tool !== "no_op",
show a floating text label above the affected plant in the Three.js scene.
These toasts ONLY exist in the 3D canvas. No DOM toasts anywhere.

### Auto-orbit on action
When a real tool call arrives (tool !== "no_op"):
  - Cooldown: 8 seconds between orbit changes
  - If cooldown elapsed: smoothly transition camera to orbit that pod
  - Update HUD text to "Auto-tracking: {pod_id}"
  - If user manually clicked a plant in the last 30 seconds: skip auto-orbit
  - If tool === "no_op": do not change orbit

### Tool → human label mapping
  turn_fan_on           → "Fan on"
  turn_fan_off          → "Fan off"
  set_fan_speed         → "Fan {speed_percent}%"
  open_vent             → "Vent open"
  close_vent            → "Vent closed"
  turn_heater_on        → "Heater on"
  turn_heater_off       → "Heater off"
  turn_cooler_on        → "Cooler on"
  turn_cooler_off       → "Cooler off"
  turn_humidifier_on    → "Humid. on"
  turn_humidifier_off   → "Humid. off"
  turn_dehumidifier_on  → "Dehumid. on"
  turn_dehumidifier_off → "Dehumid. off"
  set_climate_target    → "{temp_c}°C / {humidity_percent}%"
  enter_heat_stress_mode    → "Heat stress mode"
  enter_high_humidity_mode  → "High humidity mode"

### Sprite implementation
Use THREE.Sprite with canvas-rendered texture. No CSS2DRenderer.
No external text libraries. Canvas → CanvasTexture → SpriteMaterial → Sprite.

Canvas: 256x64px
  Background: rounded rect, rgba(18, 18, 18, 0.82), radius 10px
  Text: 15px Inter bold, vertically and horizontally centered
  Text color by tool category:
    fan/vent tools      → soft blue (#7aa8c4)
    heater/cooler tools → amber (#c8a84b)
    stress modes        → dusty rose (#c47a7a)
    humidifier tools    → sage green (#7aad7a)
    default             → white (#f0ede6)

Sprite position:
  X, Z: same as plant position
  Y: plant mesh top + 0.5 units

Fixed rotation — CRITICAL:
  sprite.material.rotation = 0
  Do NOT use lookAt. Do NOT billboard.
  All toasts face the same fixed world direction at all times.
  This is intentional design, not a bug.

### Toast stack per plant
Each plant tracks its active toasts in an array.
New toast → push existing toasts up by 0.4 units (increment Y)
Max 4 toasts per plant — if exceeded, remove the bottom one immediately.

### Animation
Pop in:  scale 0 → 1 over 180ms, ease-out
Hold:    4000ms at full opacity
Fade:    opacity 1 → 0 over 700ms
On fade complete: remove sprite from scene, shift remaining
  stack down by 0.4 units

Run animation in the existing Three.js animation loop using
clock.getDelta() or a timestamp — no setTimeout for animation frames.

---

## CONSTRAINTS
- 3D toasts are THREE.Sprite only — no DOM elements, no CSS2DRenderer
- Fixed sprite rotation — no lookAt under any circumstances
- No toast notifications outside the 3D scene
- Automation tab reuses existing Three.js renderer — no second canvas
- parseAgentCycle must handle both the structured text format AND
  the agent_cycle_summary JSON actions array — use whichever is available
- Do not add new npm dependencies
- Commit after each task: "feat(frontend): [task name]"