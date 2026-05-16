import * as THREE from 'three'

export const PLANT_TYPES = ['lettuce', 'tomato', 'basil', 'spinach', 'microgreens']

const PLANT_COLORS = {
  lettuce:     { 0: '#c8dba0', 1: '#96cc64', 2: '#5a9e3c', 3: '#3a8c2a' },
  tomato:      { 0: '#7acc40', 1: '#5ab030', 2: '#3d8a20', 3: '#2d6e18' },
  basil:       { 0: '#7acc40', 1: '#5acc20', 2: '#3a9c2c', 3: '#2d6e2d' },
  spinach:     { 0: '#2d7040', 1: '#2a6840', 2: '#1e5430', 3: '#1a4a1a' },
  microgreens: { 0: '#a0d060', 1: '#7ec850', 2: '#6db845', 3: '#5ca838' },
}

// "stage:band:plantType" -> MeshLambertMaterial
const _materialCache = new Map()
const _redFruitMat = new THREE.MeshLambertMaterial({ color: '#cc3300' })

const TRAY_Y = 0.08

function _healthBand(health) {
  if (health === 0) return 'dead'
  if (health < 0.4) return 'critical'
  if (health <= 0.7) return 'warning'
  return 'healthy'
}

export function getHealthColor(stage, health, plantType = 'lettuce') {
  const h = health ?? 0.8
  const s = Math.min(3, Math.max(0, stage ?? 1))
  const pt = plantType ?? 'lettuce'
  if (h === 0) return new THREE.Color('#6b6b6b')
  const colors = PLANT_COLORS[pt] ?? PLANT_COLORS.lettuce
  const base = new THREE.Color(colors[s])
  if (h < 0.4) return base.lerp(new THREE.Color('#c47a7a'), 0.7)
  if (h <= 0.7) return base.lerp(new THREE.Color('#c8a84b'), 0.4)
  return base.clone()
}

function _getMaterial(stage, health, plantType = 'lettuce') {
  const key = `${stage ?? 1}:${_healthBand(health ?? 0.8)}:${plantType ?? 'lettuce'}`
  if (!_materialCache.has(key)) {
    _materialCache.set(key, new THREE.MeshLambertMaterial({
      color: getHealthColor(stage, health, plantType),
    }))
  }
  return _materialCache.get(key)
}

function _makeStem(r, h, material) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 8), material)
  mesh.position.y = TRAY_Y + h / 2
  return mesh
}

// Lettuce: flat rosette of ellipsoidal leaves, stays close to tray
function _buildLettuce(s, mat) {
  const group = new THREE.Group()

  if (s === 0) {
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 5), mat)
      leaf.scale.set(1, 0.2, 0.8)
      leaf.userData.isFoliage = true
      leaf.position.set(Math.cos(angle) * 0.09, TRAY_Y + 0.01, Math.sin(angle) * 0.09)
      group.add(leaf)
    }
  } else if (s === 1) {
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2
      const isOuter = i % 2 === 1
      const dist = isOuter ? 0.2 : 0.11
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 5), mat)
      leaf.scale.set(1, 0.22, 0.85)
      leaf.userData.isFoliage = true
      if (isOuter) leaf.rotation.x = 20 * Math.PI / 180
      leaf.position.set(Math.cos(angle) * dist, TRAY_Y + 0.02, Math.sin(angle) * dist)
      group.add(leaf)
    }
  } else if (s === 2) {
    const rings = [
      { count: 4, leafR: 0.10, dist: 0.09, droop: 0.05 },
      { count: 5, leafR: 0.14, dist: 0.23, droop: 0.28 },
    ]
    for (const { count, leafR, dist, droop } of rings) {
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(leafR, 8, 5), mat)
        leaf.scale.set(1, 0.18, 0.9)
        leaf.userData.isFoliage = true
        leaf.rotation.y = angle + ((i * 7 % 5 - 2) * 0.15)
        leaf.rotation.x = droop
        leaf.position.set(Math.cos(angle) * dist, TRAY_Y + 0.02, Math.sin(angle) * dist)
        group.add(leaf)
      }
    }
  } else {
    const rings = [
      { count: 4, leafR: 0.09, dist: 0.07, droop: 0.0 },
      { count: 5, leafR: 0.13, dist: 0.2,  droop: 0.22 },
      { count: 4, leafR: 0.16, dist: 0.32, droop: 0.42 },
    ]
    for (const { count, leafR, dist, droop } of rings) {
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + droop * 0.2
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(leafR, 8, 5), mat)
        leaf.scale.set(1, 0.15, 0.9)
        leaf.userData.isFoliage = true
        leaf.rotation.y = angle + ((i * 7 % 5 - 2) * 0.2)
        leaf.rotation.x = droop
        leaf.position.set(Math.cos(angle) * dist, TRAY_Y + 0.02, Math.sin(angle) * dist)
        group.add(leaf)
      }
    }
  }
  return group
}

// Tomato: stem + leaf clusters + red sphere fruits
function _buildTomato(s, mat) {
  const group = new THREE.Group()

  if (s === 0) {
    group.add(_makeStem(0.02, 0.2, mat))
    const stemTop = TRAY_Y + 0.2
    for (const sign of [-1, 1]) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.07, 7, 5), mat)
      leaf.scale.set(1, 0.35, 0.75)
      leaf.userData.isFoliage = true
      leaf.position.set(sign * 0.11, stemTop + 0.01, 0)
      leaf.rotation.z = sign * 0.4
      group.add(leaf)
    }
  } else if (s === 1) {
    group.add(_makeStem(0.025, 0.3, mat))
    const stemTop = TRAY_Y + 0.3
    for (let d = 0; d < 4; d++) {
      const angle = (d / 4) * Math.PI * 2
      const px = Math.cos(angle) * 0.18
      const pz = Math.sin(angle) * 0.18
      const main = new THREE.Mesh(new THREE.SphereGeometry(0.09, 7, 5), mat)
      main.scale.set(1, 0.38, 0.8)
      main.userData.isFoliage = true
      main.position.set(px, stemTop - 0.04, pz)
      group.add(main)
      for (const j of [-1, 1]) {
        const leaflet = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 4), mat)
        leaflet.scale.set(1, 0.38, 0.75)
        leaflet.userData.isFoliage = true
        leaflet.position.set(px + j * Math.sin(angle) * 0.09, stemTop - 0.07, pz + j * Math.cos(angle) * 0.09)
        group.add(leaflet)
      }
    }
  } else if (s === 2) {
    group.add(_makeStem(0.03, 0.25, mat))
    const base = TRAY_Y + 0.22
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2
      const r = 0.12 + (i % 2) * 0.06
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.09, 7, 5), mat)
      leaf.scale.set(1, 0.35, 0.82)
      leaf.userData.isFoliage = true
      leaf.position.set(Math.cos(angle) * r, base + (i % 3) * 0.03, Math.sin(angle) * r)
      leaf.rotation.z = Math.cos(angle) * 0.2
      group.add(leaf)
    }
    for (let i = 0; i < 2; i++) {
      const angle = (i / 2) * Math.PI * 2 + 1.0
      const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 5), _redFruitMat)
      fruit.position.set(Math.cos(angle) * 0.13, base + 0.05, Math.sin(angle) * 0.13)
      group.add(fruit)
    }
  } else {
    group.add(_makeStem(0.035, 0.22, mat))
    const base = TRAY_Y + 0.18
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2
      const r = 0.1 + (i % 3) * 0.07
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.1, 7, 5), mat)
      leaf.scale.set(1, 0.32, 0.85)
      leaf.userData.isFoliage = true
      leaf.position.set(Math.cos(angle) * r, base + (i % 4) * 0.025, Math.sin(angle) * r)
      leaf.rotation.z = Math.cos(angle) * 0.18
      group.add(leaf)
    }
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + 0.6
      const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), _redFruitMat)
      fruit.position.set(Math.cos(angle) * 0.15, base + 0.07, Math.sin(angle) * 0.15)
      group.add(fruit)
    }
  }
  return group
}

// Basil: compact mound of round leaf pairs
function _buildBasil(s, mat) {
  const group = new THREE.Group()

  if (s === 0) {
    for (const sign of [-1, 1]) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 5), mat)
      leaf.scale.set(1, 0.3, 1)
      leaf.userData.isFoliage = true
      leaf.position.set(sign * 0.09, TRAY_Y + 0.02, 0)
      group.add(leaf)
    }
  } else if (s === 1) {
    group.add(_makeStem(0.018, 0.15, mat))
    const stemTop = TRAY_Y + 0.15
    const levels = [stemTop - 0.1, stemTop - 0.01]
    for (let h = 0; h < levels.length; h++) {
      const y = levels[h]
      const useZ = h === 1
      for (const sign of [-1, 1]) {
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.07, 7, 5), mat)
        leaf.scale.set(1, 0.35, 1)
        leaf.userData.isFoliage = true
        leaf.position.set(useZ ? 0 : sign * 0.1, y, useZ ? sign * 0.1 : 0)
        leaf.rotation.z = useZ ? 0 : sign * 0.25
        leaf.rotation.x = useZ ? sign * 0.25 : 0
        group.add(leaf)
      }
    }
  } else if (s === 2) {
    group.add(_makeStem(0.022, 0.2, mat))
    const base = TRAY_Y + 0.15
    const positions = [
      [0, base + 0.1, 0],
      [0.14, base + 0.04, 0.05],
      [-0.14, base + 0.04, 0.05],
      [0.05, base + 0.04, 0.14],
      [-0.05, base + 0.04, -0.14],
      [0.1, base - 0.02, 0.1],
      [-0.1, base - 0.02, 0.1],
      [0.1, base - 0.02, -0.1],
      [-0.1, base - 0.02, -0.1],
    ]
    for (const pos of positions) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.07, 7, 5), mat)
      leaf.scale.set(1, 0.4, 1)
      leaf.userData.isFoliage = true
      leaf.position.set(...pos)
      group.add(leaf)
    }
  } else {
    group.add(_makeStem(0.028, 0.22, mat))
    const base = TRAY_Y + 0.14
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.09, 7, 5), mat)
      leaf.scale.set(1, 0.38, 1)
      leaf.userData.isFoliage = true
      leaf.position.set(Math.cos(angle) * 0.22, base, Math.sin(angle) * 0.22)
      group.add(leaf)
    }
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + 0.25
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.082, 7, 5), mat)
      leaf.scale.set(1, 0.4, 1)
      leaf.userData.isFoliage = true
      leaf.position.set(Math.cos(angle) * 0.13, base + 0.07, Math.sin(angle) * 0.13)
      group.add(leaf)
    }
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.075, 7, 5), mat)
    top.scale.set(1, 0.55, 1)
    top.userData.isFoliage = true
    top.position.set(0, base + 0.16, 0)
    group.add(top)
  }
  return group
}

// Spinach: dark flat oval leaves, low and wide
function _buildSpinach(s, mat) {
  const group = new THREE.Group()

  if (s === 0) {
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 5), mat)
      leaf.scale.set(0.65, 0.15, 1)
      leaf.userData.isFoliage = true
      leaf.position.set(Math.cos(angle) * 0.1, TRAY_Y + 0.01, Math.sin(angle) * 0.1)
      leaf.rotation.y = angle
      group.add(leaf)
    }
  } else if (s === 1) {
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 5), mat)
      leaf.scale.set(0.62, 0.16, 1)
      leaf.userData.isFoliage = true
      leaf.rotation.y = angle
      leaf.rotation.x = 0.12 + Math.sin(i * 2) * 0.08
      leaf.position.set(Math.cos(angle) * 0.17, TRAY_Y + 0.02, Math.sin(angle) * 0.17)
      group.add(leaf)
    }
  } else if (s === 2) {
    for (let i = 0; i < 9; i++) {
      const angle = (i / 9) * Math.PI * 2
      const r = 0.12 + (i % 3) * 0.08
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 5), mat)
      leaf.scale.set(0.58, 0.15, 1)
      leaf.userData.isFoliage = true
      leaf.rotation.y = angle
      leaf.rotation.x = 0.12 + (i % 4) * 0.06
      leaf.position.set(Math.cos(angle) * r, TRAY_Y + 0.02 + (i % 3) * 0.01, Math.sin(angle) * r)
      group.add(leaf)
    }
    const center = new THREE.Mesh(new THREE.SphereGeometry(0.1, 7, 5), mat)
    center.scale.set(0.7, 0.18, 1)
    center.userData.isFoliage = true
    center.position.set(0, TRAY_Y + 0.04, 0)
    group.add(center)
  } else {
    const rings = [
      { count: 6, leafR: 0.17, radius: 0.3 },
      { count: 5, leafR: 0.15, radius: 0.2 },
      { count: 4, leafR: 0.12, radius: 0.1 },
    ]
    for (const { count, leafR, radius } of rings) {
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + radius * 0.3
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(leafR, 8, 5), mat)
        leaf.scale.set(0.58, 0.13, 1)
        leaf.userData.isFoliage = true
        leaf.rotation.y = angle
        leaf.rotation.x = 0.2
        leaf.position.set(Math.cos(angle) * radius, TRAY_Y + 0.03, Math.sin(angle) * radius)
        group.add(leaf)
      }
    }
  }
  return group
}

// Microgreens: dense carpet of tiny sprouts using golden-angle distribution
function _buildMicrogreens(s, mat) {
  const group = new THREE.Group()
  const counts  = [9, 20, 30, 42]
  const stemHs  = [0, 0.10, 0.14, 0.15]
  const leafRs  = [0.035, 0.028, 0.030, 0.032]
  const spreads = [0.18, 0.28, 0.34, 0.38]

  const count  = counts[s]
  const stemH  = stemHs[s]
  const leafR  = leafRs[s]
  const spread = spreads[s]

  const stemGeo = stemH > 0
    ? new THREE.CylinderGeometry(0.007, 0.007, stemH, 4)
    : null

  for (let i = 0; i < count; i++) {
    const angle = i * 2.399963
    const r = spread * Math.sqrt(i / Math.max(count - 1, 1))
    const x = Math.cos(angle) * r
    const z = Math.sin(angle) * r

    if (stemGeo) {
      const stem = new THREE.Mesh(stemGeo, mat)
      stem.position.set(x, TRAY_Y + stemH / 2, z)
      group.add(stem)
    }

    const dot = new THREE.Mesh(new THREE.SphereGeometry(leafR, 5, 4), mat)
    dot.userData.isFoliage = true
    dot.scale.y = 0.65
    dot.position.set(x, TRAY_Y + stemH + leafR * 0.5, z)
    group.add(dot)
  }
  return group
}

export function createPlantMesh(stage = 1, health = 0.8, plantType = 'lettuce') {
  const s  = Math.min(3, Math.max(0, stage ?? 1))
  const h  = health ?? 0.8
  const pt = PLANT_TYPES.includes(plantType) ? plantType : 'lettuce'
  const mat = _getMaterial(s, h, pt)

  switch (pt) {
    case 'tomato':      return _buildTomato(s, mat)
    case 'basil':       return _buildBasil(s, mat)
    case 'spinach':     return _buildSpinach(s, mat)
    case 'microgreens': return _buildMicrogreens(s, mat)
    default:            return _buildLettuce(s, mat)
  }
}
