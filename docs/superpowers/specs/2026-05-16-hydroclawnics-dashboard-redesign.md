# Hydroclawnics Dashboard Redesign

**Date:** 2026-05-16  
**Branch:** w-css-v2  
**Approach:** B — Camera module refactor + clean feature layer  

---

## Overview

Full redesign and feature upgrade of the Hydroclawnics monitoring dashboard. The goals are: modernize the visual language into a cohesive "Command Center" feel, fix the 3D camera system by extracting it into a dedicated hook, add scalable grid controls (filter / sort / paginate), sync the frontend data layer to the new backend schema, and introduce plant growth stages in the 3D view.

---

## 1. Layout & Navigation

### Structure
Replace the current stacked-tab layout with a **Command Center** structure:

- **Top nav bar** (full width, 56px): logo left, pill-tab switcher center, status indicators + settings button right.
- **Pill-tab switcher** replaces the current `TabSwitcher`: three tabs — `Farm Overview` (2D grid), `3D Farm`, `Settings`. Active tab has a filled pill style (background = `--color-info`, text = `--color-bg`). Inactive tabs are muted text, no border.
- **Main content area** (below nav, full remaining height): renders the active view. On ≥1280px screens, the agent log renders as a fixed-width right drawer (280px). On smaller screens, the drawer collapses and is accessible via a toggle button.
- **Physical pot panel** is removed from its own always-visible section and instead appears as the first card in the Farm Overview grid, visually distinguished (slightly wider or with a "Physical" label badge).

### Transitions
- Switching tabs fades content out (150ms, `opacity 0 → 1`) and slides the new view up slightly (`translateY(8px → 0)`). Use CSS transitions, not a library.
- The active tab pill transition is `background-color 200ms ease`.

### Settings Tab
Currently a non-functional gear icon. Becomes a real tab with three sections:

1. **Farm Config** — read-only display of farm name, total pod count, WebSocket URL, connection uptime.
2. **Alert Thresholds** — editable fields (pH min/max, water level warning %, water level critical %) stored in `localStorage`. These override the backend-provided `plant_status` display label (frontend warning badge shows even if backend says healthy, if threshold is breached). Start with defaults matching the existing `PhysicalPot` ranges.
3. **Display Preferences** — per-page count (12 / 24 / 48), sort preference, both persisted to `localStorage`.

---

## 2. Schema Sync

Update `useWebSocket.js` to map the new backend schema fields. The existing field names that differ must be aliased so no downstream component breaks:

| Backend field | Frontend alias | Notes |
|---|---|---|
| `plant_status` | `status` | Was already `status` — now maps from `plant_status` |
| `fault_type` | `fault_type` | New — shown on card and in modal |
| `plant_height_cm` | `plant_height_cm` | New — used for 3D geometry scale |
| `water_temp_c` | `water_temp_c` | New (separate from `air_temp_c`) |
| `air_temp_c` | `air_temp_c` | New — shown on pod card |
| `relative_humidity_percent` | `humidity` | New — shown on pod card |
| `water_level_percent` | `water_level` | New — shown as bar on card |
| `pump_status` | `pump_status` | New — shown in detail modal |
| `flow_rate_l_min` | `flow_rate` | New — shown in detail modal |

`withHistory` accumulates the same 20-reading window as before, extended to also track `water_level` and `humidity`.

---

## 3. 2D Grid (Farm Overview)

### Pod Card
Style C with left accent border:

- **Left border** (3px): `--color-success` (healthy), `--color-warning` (warning), `--color-critical` (critical).
- **Background tint**: critical cards use `#1c1620` instead of `--color-surface`.
- **Layout top-to-bottom:**
  1. Crop name (9px, uppercase, muted) — e.g. `LETTUCE`
  2. Row: pod ID (12px bold) + `fault_type` string if non-"none" (9px, warning/critical color)
  3. 2×2 metric grid: pH, EC, Tair, RH (label muted 9px, value mono 10px bold)
  4. Water level bar: label + percentage right-aligned, 3px track below

- **Water bar color**: blue (`--color-info`) above 50%, amber below 50%, red (`--color-critical`) below 20%.
- Cards are `<button>` elements — clicking opens `PodDetailModal`.

### Toolbar
Rendered above the grid, inside a `--color-surface` rounded panel:

- **Status filter pills**: All · Critical (N) · Warning (N) · Healthy (N). Multi-select not supported — only one status filter active at a time. Active pill takes the status color.
- **Crop filter pills**: one per unique crop type present in current pod list (derived dynamically, not hardcoded). Multi-select supported — selecting multiple crop types shows the union.
- **Sort dropdown**: Status (critical first) · Plant type · Water level ↑ · Age (newest) · Last modified · Pod ID.
- **Result count** right-aligned: "Showing 1–12 of 20 pods".
- Changing any filter or sort resets to page 1.

### Pagination
Below the grid:

- Left: "Pods 1–12 of 20" (updates with filter).
- Center: prev `‹` · page numbers · next `›`. Ellipsis (`…`) appears when total pages ≥ 5.
- Right: per-page selector (12 / 24 / 48). Persisted to `localStorage` under key `hydro_per_page`.
- Page size default: 12.

### Implementation
Extract grid logic into `usePodGrid.js` hook: accepts raw pod map, returns `{ filteredPods, page, totalPages, setPage, sort, setSort, statusFilter, setStatusFilter, cropFilter, setCropFilter, perPage, setPerPage }`. `PodGrid.jsx` becomes a pure rendering component.

---

## 4. 3D Farm View

### Camera System — `useCameraControls.js`
New hook, owns all camera state. Replaces the inline `CameraRig` component and ad-hoc `focus` state.

**Mode enum:** `'free'` | `'orbiting'`

**State:**
- `mode` — current camera mode
- `focusTarget` — `[x, y, z]` world position being orbited, or `null`
- `orbitControlsRef` — ref passed to `<OrbitControls>`

**Behaviors:**

- `selectPod(position)` — sets `mode = 'orbiting'`, sets `focusTarget`. Smoothly lerps `camera.position` toward an offset point and `orbitControls.target` toward the pod position over ~20 frames (0.08 lerp factor, same as before). After lerp settles, `OrbitControls` takes over freely — no further locking. This enables full 360° orbit.
- `resetToCenter()` — sets `mode = 'free'`, sets `focusTarget = null`. Lerps camera back to default position `[0, 9, 12]` and target `[0, 0, 0]`.
- `handleBackgroundClick()` — called when canvas receives a click that is NOT on a pod mesh. Calls `resetToCenter()`.
- **WASD + Space/C** — active only when `mode === 'free'`. Key bindings registered in a `useEffect` on the canvas container (not `window`, to avoid conflicts). Movement at 0.1 units per frame in camera-relative directions. Space = up (+Y), C = down (-Y). A small HUD chip "Free camera · WASD" shown bottom-left of the 3D viewport when in free mode (fades out after 3s of no movement).

**Orbit lock fix:** The current implementation re-lerps the camera every frame while `focus` is set, which prevents free orbiting. The new hook stops lerping once the target is within 0.02 units (settled), then lets `OrbitControls` handle input freely.

### `Farm3D.jsx` changes
- Receives `useCameraControls` output as props (or instantiates the hook internally — implementation detail).
- Canvas `onClick` on the background plane calls `handleBackgroundClick()`.
- **Close button**: absolute-positioned `×` button, top-right of the 3D container div. 16×16 SVG icon. Clicking calls `onClose` prop (switches tab back to `'overview'` in `App.jsx`). Styled: 32×32 rounded button, `--color-surface-2` background, fades in on hover.
- Pod meshes call `selectPod(position)` on click (no longer opens modal directly — the modal is only opened from the 2D grid).

### `PodMesh.jsx` — Growth Stages
Stage derived from `age_hours`:

| Age | Stage | Geometry |
|---|---|---|
| 0–12h | Seedling | Cylinder (r=0.5, h=0.4) + tiny sphere (r=0.2) at y=0.7 |
| 12–36h | Sprout | Cylinder (r=0.5, h=0.6) + small sphere (r=0.3) at y=1.0 |
| 36–60h | Vegetative | Cylinder (r=0.5, h=0.65) + medium sphere (r=0.45) at y=1.1 |
| 60h+ | Mature | Cylinder (r=0.5, h=0.65) + large sphere (r=0.6) at y=1.2, second smaller sphere offset |

Scale of foliage sphere is also multiplied by `plant_height_cm / 15` (normalized to a 15cm reference plant), clamped to [0.5, 1.4]. This gives physically-derived size variation.

Material improvements: foliage uses `roughness={0.6}` and `metalness={0}`. Healthy pods get a subtle emissive tint (`emissive={color}` at `emissiveIntensity={0.08}`). Warning/critical pods pulse their emissive intensity between 0.05–0.15 using `useFrame` (a slow 2s sine wave). Pot cylinder stays unchanged (`#6a6a6a`, roughness 0.85).

`useFarm3D.js` layout updated: positions pods in a dynamic grid based on total count — 5 columns for ≤20 pods, 8 columns for 21–64, scaling further. Spacing stays 3 units.

---

## 5. Pod Detail Modal — 3D Plant Preview

`PodDetailModal.jsx` gains a `<PlantPreview>` section between the header and the metric cards.

`PlantPreview` is a small `<Canvas>` (height 160px, full width, isolated renderer) that renders just the selected pod's `PodMesh` centered at `[0, 0, 0]`, with `OrbitControls` enabled (autoRotate, autoRotateSpeed=1.5). No background interaction — purely decorative/informational.

The preview canvas has the same dark background (`#0f1419`) and ambient + directional lights as the main farm view. It uses the pod's actual `age_hours`, `plant_height_cm`, `status`, and `fault_type` to render the correct growth stage and color.

Wraps in `React.Suspense` with a muted "Loading preview..." fallback.

---

## 6. Visual Polish & Animations

### Micro-animations
- **Status badge changes**: when `pod.status` changes, badge pulses scale (`scale(1) → scale(1.15) → scale(1)`) over 300ms via a CSS keyframe triggered by a key change.
- **Water level bar**: transitions `width` over 400ms on update.
- **Card border**: `transition: border-color 200ms ease` already present; extend to include `box-shadow` for a subtle focus glow on click.
- **Tab switching**: `opacity` + `translateY` fade as described in section 1.
- **Modal enter**: scales from `scale(0.96)` to `scale(1)` over 200ms with fade.
- **Free camera HUD chip**: fades in on mode enter, fades out after 3s idle.

### Typography & Spacing
- Ensure Inter is loaded (already in `globals.css`). Add `font-feature-settings: 'tnum'` to all `.font-mono` numeric values so digits are tabular (no layout jitter on updates).
- Navbar: increase logo text tracking to `-0.8px`. Health summary in navbar gains colored dots next to each count (matching status colors).
- All section headings use `tracking-[-0.3px]`.

### Agent Log
- Each new entry animates in from the top with a 150ms slide-down + fade.
- Log entries that reference a pod ID show a small colored dot matching that pod's current status (looked up from the live `pods` map).

### Settings Tab
- Section cards use `--color-surface-2` background with a top accent line in `--color-info` (2px).
- Input fields use `--color-surface` background, `--color-border` border, focus ring in `--color-info`.
- Editable threshold fields show a live "preview" of how many pods would trigger warning/critical at the current thresholds.

---

## 7. File Change Map

| File | Change type | Description |
|---|---|---|
| `App.jsx` | Modify | Three-tab state, drawer toggle, layout restructure |
| `Navbar.jsx` | Modify | Pill tabs move here, colored health dots |
| `tabSwitcher.jsx` | Delete | Replaced by pill tabs in Navbar |
| `globals.css` | Modify | Tabular nums, new keyframes, modal animation |
| `useWebSocket.js` | Modify | Schema field mapping |
| `usePodGrid.js` | New | Filter/sort/paginate logic |
| `PodGrid.jsx` | Modify | Uses usePodGrid, new card layout, toolbar, pagination |
| `PodDetailModal.jsx` | Modify | Add PlantPreview canvas, new schema fields |
| `Farm3D.jsx` | Modify | Close button, background click handler, HUD chip |
| `useCameraControls.js` | New | Orbit + free-roam camera hook |
| `useFarm3D.js` | Modify | Dynamic column count, plant_height_cm scale |
| `PodMesh.jsx` | Modify | Growth stage geometry, emissive pulse |
| `AgentLog.jsx` | Modify | Slide-in animation, pod status dot |
| `SettingsPanel.jsx` | New | Settings tab content (three sections) |
| `PhysicalPot.jsx` | Modify | Rendered as first grid card in overview |

---

## 8. Out of Scope

- Backend changes (this is frontend-only).
- Actual WebSocket reconnection strategy changes.
- Real map/GPS layout of pods (positions remain simulated grid).
- Authentication or multi-user state.
