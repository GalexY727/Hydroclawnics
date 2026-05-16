# Plant Model Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace sphere-on-cylinder plant models with stage-aware geometry, a pod tray, health-based color mapping, and organic idle sway animation.

**Architecture:** Extract a pure Three.js factory `createPlantMesh(stage, health)` to `plantMesh.js`; `PodMesh.jsx` calls it via `useMemo`, renders the group with `<primitive>`, and runs sway + alert-pulse in `useFrame`. `useFarm3D.js` derives `stage` and `health` from existing WebSocket fields.

**Tech Stack:** React 18, @react-three/fiber ^8.17.10, @react-three/drei ^9.122.0, Three.js ~r167, Vitest (new dev dep)

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `src/plantMesh.js` | Factory, material cache, health→color logic |
| Create | `src/plantMesh.test.js` | Unit tests for factory and color utils |
| Create | `src/useFarm3D.test.js` | Unit tests for deriveStage / deriveHealth |
| Create | `vitest.config.js` | Vitest config (separate from vite.config.js) |
| Modify | `src/useFarm3D.js` | Export deriveStage/deriveHealth; add stage/health; remove color |
| Modify | `src/PodMesh.jsx` | Full rewrite: tray JSX + `<primitive>` plant + useFrame |
| Modify | `src/Farm3D.jsx` | Pass `podIndex` to `<PodMesh>` |
| Modify | `src/PlantPreview.jsx` | Add `podIndex={0}`; add stage/health to mock pod |

All paths are relative to `hydroclawnics/frontend/`.

---

## Task 1: Add Vitest

**Files:**
- Create: `hydroclawnics/frontend/vitest.config.js`
- Modify: `hydroclawnics/frontend/package.json`

- [ ] **Step 1: Install vitest**

```bash
cd hydroclawnics/frontend
npm install --save-dev vitest
```

Expected: vitest appears in `devDependencies` in `package.json`.

- [ ] **Step 2: Create `vitest.config.js`**

```js
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
})
```

Three.js geometry and material classes work in Node without a WebGL context, so `node` environment is correct here.

- [ ] **Step 3: Add test script to `package.json`**

Add to the `"scripts"` block (after `"lint"`):

```json
"test": "vitest run"
```

- [ ] **Step 4: Verify Vitest works**

```bash
cd hydroclawnics/frontend
npm test
```

Expected: `No test files found` (or similar — no failures).

- [ ] **Step 5: Commit**

```bash
git add hydroclawnics/frontend/vitest.config.js hydroclawnics/frontend/package.json
git commit -m "chore: add vitest for plant mesh unit tests"
```

---

## Task 2: Write Failing Tests for `plantMesh.js`

**Files:**
- Create: `hydroclawnics/frontend/src/plantMesh.test.js`

- [ ] **Step 1: Create test file**

```js
// src/plantMesh.test.js
import * as THREE from 'three'
import { describe, it, expect } from 'vitest'
import { createPlantMesh, getHealthColor } from './plantMesh'

describe('getHealthColor', () => {
  it('returns stage 0 base color for health > 0.7', () => {
    const c = getHealthColor(0, 0.9)
    expect(c.getHexString()).toBe('a8c5a0')
  })

  it('returns stage 1 base color for health > 0.7', () => {
    const c = getHealthColor(1, 0.9)
    expect(c.getHexString()).toBe('7ab87a')
  })

  it('shifts away from stage color for warning health (0.4–0.7)', () => {
    const base = getHealthColor(0, 0.9).getHexString()
    const warn = getHealthColor(0, 0.55).getHexString()
    expect(warn).not.toBe(base)
  })

  it('shifts away from stage color for critical health (< 0.4)', () => {
    const base = getHealthColor(0, 0.9).getHexString()
    const crit = getHealthColor(0, 0.2).getHexString()
    expect(crit).not.toBe(base)
  })

  it('returns near-gray for health === 0', () => {
    const c = getHealthColor(0, 0)
    expect(c.getHexString()).toBe('6b6b6b')
  })

  it('defaults to stage 1 color when stage is undefined', () => {
    const c = getHealthColor(undefined, 0.9)
    expect(c.getHexString()).toBe('7ab87a')
  })
})

describe('createPlantMesh', () => {
  it('returns a THREE.Group', () => {
    expect(createPlantMesh(0, 0.9)).toBeInstanceOf(THREE.Group)
  })

  it('stage 0: stem + 1 sphere = 2 meshes', () => {
    const g = createPlantMesh(0, 0.9)
    const meshes = g.children.filter(c => c instanceof THREE.Mesh)
    expect(meshes.length).toBe(2)
  })

  it('stage 1: stem + 2 leaves = 3 meshes', () => {
    const g = createPlantMesh(1, 0.9)
    const meshes = g.children.filter(c => c instanceof THREE.Mesh)
    expect(meshes.length).toBe(3)
  })

  it('stage 2: stem + 3 cones = 4 meshes', () => {
    const g = createPlantMesh(2, 0.9)
    const meshes = g.children.filter(c => c instanceof THREE.Mesh)
    expect(meshes.length).toBe(4)
  })

  it('stage 3: stem + 4 cluster spheres + canopy = 6 meshes', () => {
    const g = createPlantMesh(3, 0.9)
    const meshes = g.children.filter(c => c instanceof THREE.Mesh)
    expect(meshes.length).toBe(6)
  })

  it('defaults to stage 1, health 0.8 for undefined args', () => {
    const g = createPlantMesh(undefined, undefined)
    const meshes = g.children.filter(c => c instanceof THREE.Mesh)
    expect(meshes.length).toBe(3) // same as stage 1
  })

  it('only foliage meshes have userData.isFoliage = true', () => {
    const g = createPlantMesh(0, 0.9)
    const foliage = g.children.filter(c => c instanceof THREE.Mesh && c.userData.isFoliage)
    const stem = g.children.filter(c => c instanceof THREE.Mesh && !c.userData.isFoliage)
    expect(foliage.length).toBe(1)
    expect(stem.length).toBe(1)
  })

  it('all meshes use MeshLambertMaterial', () => {
    const g = createPlantMesh(2, 0.55)
    g.children.forEach(child => {
      if (child instanceof THREE.Mesh) {
        expect(child.material).toBeInstanceOf(THREE.MeshLambertMaterial)
      }
    })
  })

  it('same stage+health returns same material instance (cache)', () => {
    const g1 = createPlantMesh(1, 0.9)
    const g2 = createPlantMesh(1, 0.9)
    const mat1 = g1.children.find(c => c instanceof THREE.Mesh).material
    const mat2 = g2.children.find(c => c instanceof THREE.Mesh).material
    expect(mat1).toBe(mat2)
  })

  it('stem position.y = 0.08 + stemH/2 for stage 0', () => {
    const g = createPlantMesh(0, 0.9)
    const stem = g.children.find(c => c instanceof THREE.Mesh && !c.userData.isFoliage)
    expect(stem.position.y).toBeCloseTo(0.08 + 0.3 / 2, 5)
  })
})
```

- [ ] **Step 2: Run tests — expect failure**

```bash
cd hydroclawnics/frontend
npm test
```

Expected: `Cannot find module './plantMesh'`

---

## Task 3: Implement `plantMesh.js`

**Files:**
- Create: `hydroclawnics/frontend/src/plantMesh.js`

- [ ] **Step 1: Create the file**

```js
import * as THREE from 'three'

const STAGE_COLORS = {
  0: '#a8c5a0',
  1: '#7ab87a',
  2: '#4a9e5c',
  3: '#2d7a4a',
}

// "stage:band" -> MeshLambertMaterial — shared across all pods at same stage+health band
const _materialCache = new Map()

function _healthBand(health) {
  if (health === 0) return 'dead'
  if (health < 0.4) return 'critical'
  if (health <= 0.7) return 'warning'
  return 'healthy'
}

export function getHealthColor(stage, health) {
  const h = health ?? 0.8
  if (h === 0) return new THREE.Color('#6b6b6b')
  const base = new THREE.Color(STAGE_COLORS[stage ?? 1] ?? STAGE_COLORS[1])
  if (h < 0.4) return base.lerp(new THREE.Color('#c47a7a'), 0.7)
  if (h <= 0.7) return base.lerp(new THREE.Color('#c8a84b'), 0.4)
  return base
}

function _getMaterial(stage, health) {
  const key = `${stage ?? 1}:${_healthBand(health ?? 0.8)}`
  if (!_materialCache.has(key)) {
    _materialCache.set(key, new THREE.MeshLambertMaterial({
      color: getHealthColor(stage, health),
    }))
  }
  return _materialCache.get(key)
}

function _makeStem(r, h, material) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 8), material)
  mesh.position.y = 0.08 + h / 2
  return mesh
}

export function createPlantMesh(stage = 1, health = 0.8) {
  const s = stage ?? 1
  const h = health ?? 0.8
  const mat = _getMaterial(s, h)
  const group = new THREE.Group()

  if (s === 0) {
    // Stage 0 — Seedling: thin stem + one small sphere
    const stemH = 0.3
    group.add(_makeStem(0.04, stemH, mat))

    const foliage = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), mat)
    foliage.userData.isFoliage = true
    foliage.position.y = 0.08 + stemH + 0.1
    group.add(foliage)

  } else if (s === 1) {
    // Stage 1 — Sprout: stem + 2 flat leaf shapes
    const stemH = 0.5
    group.add(_makeStem(0.05, stemH, mat))
    const stemTop = 0.08 + stemH

    const leafOffsets = [
      { sign: -1, rx: 0, rz:  35 * (Math.PI / 180) },
      { sign:  1, rx: 0, rz: -35 * (Math.PI / 180) },
    ]
    for (const { sign, rz } of leafOffsets) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), mat)
      leaf.userData.isFoliage = true
      leaf.scale.set(1, 0.3, 0.6)
      leaf.rotation.z = rz
      leaf.position.set(0.15 * sign, stemTop - 0.05, 0)
      group.add(leaf)
    }

  } else if (s === 2) {
    // Stage 2 — Vegetative: stem + 3 stacked cones, radii 0.30→0.22→0.15
    const stemH = 0.8
    group.add(_makeStem(0.06, stemH, mat))
    const stemTop = 0.08 + stemH

    const cones = [
      { r: 0.30, yOff: 0,    xOff:  0.04, zOff:  0.03, ry: 0 },
      { r: 0.22, yOff: 0.20, xOff: -0.03, zOff:  0.05, ry: (2 * Math.PI) / 3 },
      { r: 0.15, yOff: 0.38, xOff:  0.02, zOff: -0.04, ry: (4 * Math.PI) / 3 },
    ]
    for (const { r, yOff, xOff, zOff, ry } of cones) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(r, 0.25, 8), mat)
      cone.userData.isFoliage = true
      cone.position.set(xOff, stemTop + yOff, zOff)
      cone.rotation.y = ry
      group.add(cone)
    }

  } else {
    // Stage 3 — Mature: stem + 4 cluster spheres + main canopy sphere
    const stemH = 1.0
    group.add(_makeStem(0.07, stemH, mat))
    const stemTop = 0.08 + stemH

    const cluster = [
      { offset: [-0.18, -0.05, -0.12], r: 0.18 },
      { offset: [ 0.20,  0.00,  0.10], r: 0.22 },
      { offset: [-0.08,  0.04,  0.20], r: 0.15 },
      { offset: [ 0.14, -0.03, -0.18], r: 0.17 },
    ]
    for (const { offset, r } of cluster) {
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 8), mat)
      sphere.userData.isFoliage = true
      sphere.position.set(offset[0], stemTop + offset[1], offset[2])
      group.add(sphere)
    }

    const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 10), mat)
    canopy.userData.isFoliage = true
    canopy.position.y = stemTop + 0.1
    group.add(canopy)
  }

  return group
}
```

- [ ] **Step 2: Run tests — expect all passing**

```bash
cd hydroclawnics/frontend
npm test
```

Expected: all `plantMesh.test.js` tests pass, zero failures.

- [ ] **Step 3: Commit**

```bash
git add hydroclawnics/frontend/src/plantMesh.js hydroclawnics/frontend/src/plantMesh.test.js
git commit -m "feat: add createPlantMesh factory with stage geometry and health color"
```

---

## Task 4: Write Failing Tests for `useFarm3D.js` Derivation

**Files:**
- Create: `hydroclawnics/frontend/src/useFarm3D.test.js`

- [ ] **Step 1: Create test file**

```js
// src/useFarm3D.test.js
import { describe, it, expect } from 'vitest'
import { deriveStage, deriveHealth } from './useFarm3D'

describe('deriveStage', () => {
  it('returns 0 for age_hours < 12', () => expect(deriveStage(11)).toBe(0))
  it('returns 0 for age_hours = 0', () => expect(deriveStage(0)).toBe(0))
  it('returns 1 for age_hours = 12 (boundary)', () => expect(deriveStage(12)).toBe(1))
  it('returns 1 for age_hours = 35', () => expect(deriveStage(35)).toBe(1))
  it('returns 2 for age_hours = 36 (boundary)', () => expect(deriveStage(36)).toBe(2))
  it('returns 2 for age_hours = 59', () => expect(deriveStage(59)).toBe(2))
  it('returns 3 for age_hours = 60 (boundary)', () => expect(deriveStage(60)).toBe(3))
  it('returns 3 for age_hours = 200', () => expect(deriveStage(200)).toBe(3))
  it('defaults to 1 for undefined', () => expect(deriveStage(undefined)).toBe(1))
  it('defaults to 1 for NaN', () => expect(deriveStage(NaN)).toBe(1))
})

describe('deriveHealth', () => {
  it('returns 0.9 for "healthy"', () => expect(deriveHealth('healthy')).toBe(0.9))
  it('returns 0.55 for "warning"', () => expect(deriveHealth('warning')).toBe(0.55))
  it('returns 0.2 for "critical"', () => expect(deriveHealth('critical')).toBe(0.2))
  it('defaults to 0.8 for unknown string', () => expect(deriveHealth('unknown')).toBe(0.8))
  it('defaults to 0.8 for undefined', () => expect(deriveHealth(undefined)).toBe(0.8))
  it('defaults to 0.8 for null', () => expect(deriveHealth(null)).toBe(0.8))
})
```

- [ ] **Step 2: Run tests — expect failure**

```bash
cd hydroclawnics/frontend
npm test
```

Expected: `SyntaxError: The requested module './useFarm3D' does not provide an export named 'deriveStage'`

---

## Task 5: Update `useFarm3D.js`

**Files:**
- Modify: `hydroclawnics/frontend/src/useFarm3D.js`

- [ ] **Step 1: Replace `useFarm3D.js` with the updated version**

```js
const HEALTH_MAP = { healthy: 0.9, warning: 0.55, critical: 0.2 }

export function deriveStage(ageHours) {
  const h = Number(ageHours)
  if (!Number.isFinite(h)) return 1
  if (h < 12) return 0
  if (h < 36) return 1
  if (h < 60) return 2
  return 3
}

export function deriveHealth(status) {
  return HEALTH_MAP[status] ?? 0.8
}

function gridColumns(count) {
  if (count <= 20) return 5
  if (count <= 64) return 8
  return 10
}

export default function useFarm3D(pods) {
  const list = Object.values(pods)
  const cols = gridColumns(list.length)
  return list.map((pod, idx) => {
    const col = idx % cols
    const row = Math.floor(idx / cols)
    return {
      pod_id: pod.id,
      status: pod.status,
      age_hours: Number(pod.age_hours) || 0,
      stage: deriveStage(pod.age_hours),
      health: deriveHealth(pod.status),
      podIndex: idx,
      position: [(col - (cols - 1) / 2) * 3, 0, (row - 1) * 3],
    }
  })
}
```

Note: `heightScale` and `color` are removed — color is now owned by `createPlantMesh`, and height scaling will not be carried forward (the spec does not include it).

- [ ] **Step 2: Run tests — expect all passing**

```bash
cd hydroclawnics/frontend
npm test
```

Expected: all tests in both `plantMesh.test.js` and `useFarm3D.test.js` pass.

- [ ] **Step 3: Commit**

```bash
git add hydroclawnics/frontend/src/useFarm3D.js hydroclawnics/frontend/src/useFarm3D.test.js
git commit -m "feat: add deriveStage/deriveHealth to useFarm3D"
```

---

## Task 6: Rewrite `PodMesh.jsx`

**Files:**
- Modify: `hydroclawnics/frontend/src/PodMesh.jsx`

- [ ] **Step 1: Replace `PodMesh.jsx` entirely**

```jsx
import { useRef, useMemo } from 'react'
import { Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { createPlantMesh } from './plantMesh'

export default function PodMesh({ pod, onPodSelect, podIndex = 0 }) {
  const plantRef = useRef()
  const isAlerted = pod.status === 'warning' || pod.status === 'critical'
  const stage = pod.stage ?? 1
  const health = pod.health ?? 0.8

  const { plantGroup, alertMaterials } = useMemo(() => {
    const group = createPlantMesh(stage, health)
    const alertMats = []

    if (isAlerted) {
      const emissiveColor = new THREE.Color(
        pod.status === 'critical' ? '#c9566b' : '#d4a373'
      )
      group.traverse((child) => {
        if (child instanceof THREE.Mesh && child.userData.isFoliage) {
          const cloned = child.material.clone()
          cloned.emissive = emissiveColor
          cloned.emissiveIntensity = 0.02
          child.material = cloned
          alertMats.push(cloned)
        }
      })
    }

    return { plantGroup: group, alertMaterials: alertMats }
  }, [stage, health, isAlerted, pod.status])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const phase = podIndex * 1.3

    if (plantRef.current) {
      plantRef.current.rotation.x =
        (Math.sin(t * 0.3 + phase) * 0.7 + Math.sin(t * 0.13 + phase * 1.4) * 0.3) * 0.018
      plantRef.current.rotation.z =
        (Math.cos(t * 0.25 + phase) * 0.7 + Math.cos(t * 0.09 + phase * 1.6) * 0.3) * 0.012
    }

    if (isAlerted && alertMaterials.length > 0) {
      const intensity = 0.02 + 0.03 * (0.5 + 0.5 * Math.sin(t * 0.7))
      for (const mat of alertMaterials) {
        mat.emissiveIntensity = intensity
      }
    }
  })

  return (
    <group
      position={pod.position}
      onClick={(e) => { e.stopPropagation(); onPodSelect?.(pod.pod_id, pod.position) }}
    >
      {/* Tray — never rotates */}
      <group>
        <mesh position={[0, 0.04, 0]}>
          <boxGeometry args={[1.2, 0.08, 1.2]} />
          <meshLambertMaterial color="#8B7355" />
        </mesh>
        <mesh position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.0, 1.0]} />
          <meshLambertMaterial color="#5b8fa8" opacity={0.5} transparent />
        </mesh>
        <Text
          position={[0, 0.085, 0.55]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.18}
          color="#f5f1de"
          anchorX="center"
          anchorY="middle"
        >
          {pod.pod_id}
        </Text>
      </group>

      {/* Plant — sways with wind */}
      <primitive ref={plantRef} object={plantGroup} />
    </group>
  )
}
```

- [ ] **Step 2: Run tests to confirm no regressions**

```bash
cd hydroclawnics/frontend
npm test
```

Expected: all tests still pass (PodMesh has no unit tests — that's intentional; it is an R3F component with full context requirements).

- [ ] **Step 3: Commit**

```bash
git add hydroclawnics/frontend/src/PodMesh.jsx
git commit -m "feat: rewrite PodMesh with stage geometry, pod tray, and organic sway"
```

---

## Task 7: Update `Farm3D.jsx` and `PlantPreview.jsx`

**Files:**
- Modify: `hydroclawnics/frontend/src/Farm3D.jsx`
- Modify: `hydroclawnics/frontend/src/PlantPreview.jsx`

- [ ] **Step 1: Update the `PodMesh` render in `Farm3D.jsx`**

In `Farm3D.jsx`, find the `mappedPods.map(...)` block and pass `podIndex`:

Old:
```jsx
{mappedPods.map((pod) => (
  <PodMesh
    key={pod.pod_id}
    pod={pod}
    onPodSelect={(podId, position) => {
      controls.selectPod(position)
      window.setTimeout(() => onPodSelect?.(podId), 420)
    }}
  />
))}
```

New:
```jsx
{mappedPods.map((pod) => (
  <PodMesh
    key={pod.pod_id}
    pod={pod}
    podIndex={pod.podIndex}
    onPodSelect={(podId, position) => {
      controls.selectPod(position)
      window.setTimeout(() => onPodSelect?.(podId), 420)
    }}
  />
))}
```

- [ ] **Step 2: Update `PlantPreview.jsx`**

`PlantPreview` builds its own mock pod for the preview canvas. Add `stage`, `health`, and `podIndex` to it.

Old `mockMappedPod` in `PlantPreview.jsx`:
```js
const mockMappedPod = {
  pod_id: pod.id,
  status: pod.status,
  age_hours: Number(pod.age_hours) || 0,
  heightScale: Math.min(1.4, Math.max(0.5, (Number(pod.plant_height_cm) || 10) / 15)),
  color: { healthy: '#7fb069', warning: '#d4a373', critical: '#c9566b' }[pod.status] || '#7fb069',
  position: [0, 0, 0],
}
```

New:
```js
import { deriveStage, deriveHealth } from './useFarm3D'

// (inside PreviewScene)
const mockMappedPod = {
  pod_id: pod.id,
  status: pod.status,
  age_hours: Number(pod.age_hours) || 0,
  stage: deriveStage(pod.age_hours),
  health: deriveHealth(pod.status),
  position: [0, 0, 0],
}
```

Remove the `import` of anything that no longer exists (the old `color`/`heightScale` fields are gone).

Note: `PodMesh` reads `podIndex` as a component-level prop with a default of `0`, not from `pod.podIndex`. No explicit `podIndex` prop is needed on the `<PodMesh>` call in PlantPreview — the default is correct for the preview context.

- [ ] **Step 3: Run tests**

```bash
cd hydroclawnics/frontend
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add hydroclawnics/frontend/src/Farm3D.jsx hydroclawnics/frontend/src/PlantPreview.jsx
git commit -m "feat: wire podIndex to PodMesh and update PlantPreview mock pod"
```

---

## Task 8: Smoke Test in Browser

**No file changes — verification only.**

- [ ] **Step 1: Start the dev server**

```bash
cd hydroclawnics/frontend
npm run dev
```

- [ ] **Step 2: Open the app and verify the following**

- [ ] The 3D farm view shows pod trays (flat brown boxes) with blue water planes inside
- [ ] Stage 0 pods (youngest) show a thin stem with a small sphere
- [ ] Stage 1 pods show a stem with two flat leaves at ±35°
- [ ] Stage 2 pods show a stem with three layered cones
- [ ] Stage 3 pods show a full bushy canopy with a main sphere
- [ ] Healthy plants are saturated green; warning plants shift toward amber; critical plants shift toward dusty rose
- [ ] All plants sway gently and asynchronously (compound wave, looks like wind)
- [ ] Alerted pods have a faint, slow emissive pulse — not strobing
- [ ] Clicking a pod still triggers the click-to-orbit and opens the detail modal
- [ ] Pod ID labels are visible on the tray surface
- [ ] The `PlantPreview` in the pod detail modal shows the correct stage geometry

- [ ] **Step 3: Final commit if any tweaks were needed**

```bash
git add -p   # stage only what changed
git commit -m "fix: smoke test tweaks for plant model upgrade"
```
