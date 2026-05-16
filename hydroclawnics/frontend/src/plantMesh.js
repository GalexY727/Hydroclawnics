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
  return base.clone()
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
      { sign: -1, rz:  35 * (Math.PI / 180) },
      { sign:  1, rz: -35 * (Math.PI / 180) },
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
