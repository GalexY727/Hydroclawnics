# Plant Model Upgrade — Design Spec
**Date:** 2026-05-16
**Branch:** w-css-v2
**Status:** Approved

---

## Goal

Replace the current sphere-on-cylinder plant models in the hydroponics 3D simulation with recognizable, stage-aware geometry. No textures — geometry, color, and animation only.

---

## Files Changed

| File | Change |
|---|---|
| `useFarm3D.js` | Add `stage` and `health` fields; remove `color` |
| `PodMesh.jsx` | Full rewrite — imperative factory + `<primitive>` |
| `PlantPreview.jsx` | Add `podIndex={0}` prop to `<PodMesh>` |

`Farm3D.jsx`, `useCameraControls.js`, `PodGrid.jsx` — untouched.

---

## Data Derivation

Neither `stage` nor `health` are in the WebSocket payload. Both are derived in `useFarm3D.js`:

**Stage** (from `age_hours`):
- `< 12h` → stage 0 (Seedling)
- `< 36h` → stage 1 (Sprout)
- `< 60h` → stage 2 (Vegetative)
- `≥ 60h` → stage 3 (Mature)

**Health** (from `status` string):
- `healthy` → 0.9
- `warning` → 0.55
- `critical` → 0.2
- missing/unknown → 0.8 (default)

---

## `createPlantMesh(stage, health)` Factory

A pure Three.js function (not a React component) that returns a `THREE.Group`.

### Health → Color Mapping

Applied to all plant materials. Tray and water plane are NOT health-tinted.

| Health | Behavior |
|---|---|
| `> 0.7` | Stage color as-is |
| `0.4–0.7` | Lerp 40% toward amber `#c8a84b` + desaturate |
| `< 0.4` | Lerp 70% toward dusty rose `#c47a7a` + desaturate |
| `=== 0` | Near-gray `#6b6b6b` |

Implemented with `THREE.Color.lerp()`. No custom shaders.

### Material Cache

One shared `MeshLambertMaterial` per `"${stage}:${healthBand}"` key, stored in a module-level `Map`. Repeated calls for pods at the same stage+health share the same material — zero extra draw calls. Alerted pods get a **per-instance `.clone()`** of their material so the pulse doesn't bleed to other pods.

### Stage Geometry

All stems are `CylinderGeometry`. Stem `position.y = 0.08 + stemH/2` so the base sits flush on top of the tray rim (`y=0.08`).

**Stage 0 — Seedling** (color `#a8c5a0`, pale green)
- Stem: `CylinderGeometry(0.04, 0.04, 0.3)`
- Foliage: 1× `SphereGeometry(0.1)` at stem top

**Stage 1 — Sprout** (color `#7ab87a`, medium green)
- Stem: `CylinderGeometry(0.05, 0.05, 0.5)`
- Foliage: 2× `SphereGeometry` scaled `(1, 0.3, 0.6)`, rotated ±35° from stem, offset slightly outward

**Stage 2 — Vegetative** (color `#4a9e5c`, rich green)
- Stem: `CylinderGeometry(0.06, 0.06, 0.8)`
- Foliage: 3× `ConeGeometry`, each `h=0.25`, radii stepping `r=0.30 → r=0.22 → r=0.15` (largest at bottom, smallest at top), stacked vertically with slight per-cone XZ offsets `(±0.05, ±0.04)` and small per-cone Y rotations

**Stage 3 — Mature** (color `#2d7a4a`, deep green)
- Stem: `CylinderGeometry(0.07, 0.07, 1.0)`
- Foliage: 4× cluster spheres at explicit offsets from stem top:
  - `(-0.18, -0.05, -0.12)` r=0.18
  - `( 0.20,  0.00,  0.10)` r=0.22
  - `(-0.08,  0.04,  0.20)` r=0.15
  - `( 0.14, -0.03, -0.18)` r=0.17
- Main canopy: `SphereGeometry(0.28)` centered at stem top

### Pod Tray (all stages)

Separate `THREE.Group`, never rotated. Tray bottom sits at `y=0`; top rim at `y=0.08`.

- Box tray: `BoxGeometry(1.2, 0.08, 1.2)`, `position.y=0.04`, color `#8B7355`, `MeshLambertMaterial`
- Water plane: `PlaneGeometry(1.0, 1.0)`, `rotation.x = -π/2`, `position.y=0.07`, color `#5b8fa8`, `opacity=0.5`, `transparent=true`, `MeshLambertMaterial`
- Stem base sits at `y=0.08`; stem `position.y = 0.08 + stemH/2`
- Pod ID `<Text>` label: attached to tray group, position unchanged from current

---

## `PodMesh` Component

```
PodMesh({ pod, onPodSelect, podIndex })
```

- `useMemo` calls `createPlantMesh(pod.stage, pod.health)` → `THREE.Group`
- Renders tray group as JSX, plant group as `<primitive object={plantGroup} />`
- `useFrame` mutates `plantGroup.rotation` for sway; mutates alert material `emissiveIntensity` for pulse

### Idle Sway

Compound wave — two incommensurable frequencies, aperiodic, reads as wind/breathing:

```
phase = podIndex * 1.3
rotation.x = (sin(t * 0.3 + phase) * 0.7 + sin(t * 0.13 + phase * 1.4) * 0.3) * 0.018
rotation.z = (cos(t * 0.25 + phase) * 0.7 + cos(t * 0.09 + phase * 1.6) * 0.3) * 0.012
```

Amplitude ~1°. Never visibly loops. Applied to plant group only.

### Alert Pulse

Only when `pod.status === 'warning' || 'critical'`. Uses a cloned material to avoid bleeding:

```
emissiveIntensity = 0.02 + 0.03 * (0.5 + 0.5 * sin(t * 0.7))
```

Peak intensity `0.05` — subtle warmth, not a flash. ~0.1 Hz, feels like a slow heartbeat.

---

## Constraints Checklist

- [x] Three.js primitives only — no loaders, no GLTF, no textures
- [x] Works with existing WebSocket health data (derived from `status` string)
- [x] Works with existing stage data (derived from `age_hours`)
- [x] Missing stage/health defaults to stage=1, health=0.8
- [x] Draw calls minimized via shared material cache
- [x] Click-to-orbit preserved (onClick on root group, unchanged)
- [x] Warning/critical flag system preserved (alert pulse on cloned material)
- [x] Compatible with R3F `^8.17.10` / Three.js ~r167 APIs
- [x] `MeshLambertMaterial` throughout (not Phong, not Standard)
