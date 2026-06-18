const HEALTH_MAP = { healthy: 0.9, warning: 0.55, critical: 0.2 }
const MAX_PODS_PER_ROW = 8
const POD_SPACING_X = 1.85
const POD_SPACING_Z = 1.7
const ISLAND_GAP_X = 1.55
const ISLAND_GAP_Z = 1.45
const ISLAND_PAD_X = 1.45
const ISLAND_PAD_Z = 1.4

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

function chunk(items, size) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, index * size + size))
}

function balancedRows(items) {
  const rowCount = Math.max(1, Math.ceil(items.length / MAX_PODS_PER_ROW))
  const baseLength = Math.floor(items.length / rowCount)
  const extraItems = items.length % rowCount
  let cursor = 0

  return Array.from({ length: rowCount }, (_, index) => {
    const rowLength = baseLength + (index < extraItems ? 1 : 0)
    const row = items.slice(cursor, cursor + rowLength)
    cursor += rowLength
    return row
  })
}

function buildIslandLayouts(groups) {
  const islands = groups.map(([group, items], index) => {
    const rows = balancedRows(items)
    const maxRowLength = Math.max(1, ...rows.map((row) => row.length))
    const contentWidth = (maxRowLength - 1) * POD_SPACING_X + ISLAND_PAD_X * 2
    const contentDepth = (rows.length - 1) * POD_SPACING_Z + ISLAND_PAD_Z * 2

    return {
      group,
      index,
      rows,
      width: Math.max(4.6, contentWidth),
      depth: Math.max(3.2, contentDepth),
    }
  })

  const layoutRows = chunk(islands, 2)
  let cursorZ = -layoutRows.reduce((sum, row) => sum + Math.max(...row.map((island) => island.depth)) + ISLAND_GAP_Z, -ISLAND_GAP_Z) / 2

  layoutRows.forEach((row) => {
    const rowDepth = Math.max(...row.map((island) => island.depth))
    const rowWidth = row.reduce((sum, island) => sum + island.width, 0) + Math.max(0, row.length - 1) * ISLAND_GAP_X
    let cursorX = -rowWidth / 2

    row.forEach((island) => {
      island.center = [cursorX + island.width / 2, 0, cursorZ + rowDepth / 2]
      cursorX += island.width + ISLAND_GAP_X
    })

    cursorZ += rowDepth + ISLAND_GAP_Z
  })

  return islands
}

export default function useFarm3D(pods) {
  const list = Object.values(pods)
  const grouped = list.reduce((acc, pod) => {
    const group = pod.zone || pod.reservoir || 'Farm'
    if (!acc.has(group)) acc.set(group, [])
    acc.get(group).push(pod)
    return acc
  }, new Map())
  const groups = Array.from(grouped.entries())
  const islands = buildIslandLayouts(groups)
  let podIndex = 0

  return islands.flatMap((island) => island.rows.flatMap((rowItems, rowIndex) => rowItems.map((pod, col) => {
    const idx = podIndex
    const x = island.center[0] + (col - (rowItems.length - 1) / 2) * POD_SPACING_X
    const z = island.center[2] + (rowIndex - (island.rows.length - 1) / 2) * POD_SPACING_Z
    podIndex += 1
    return {
      pod_id: pod.id,
      crop: pod.crop,
      status: pod.status,
      fault_type: pod.fault_type,
      lifecycle: pod.lifecycle,
      zone: pod.zone,
      reservoir: pod.reservoir,
      ph: pod.ph,
      ec_ppm: pod.ec_ppm,
      water_level: pod.water_level,
      flow_rate: pod.flow_rate,
      pump_status: pod.pump_status,
      age_hours: Number(pod.age_hours) || 0,
      stage: deriveStage(pod.age_hours),
      health: deriveHealth(pod.status),
      group: island.group,
      islandId: island.group,
      islandIndex: island.index,
      islandCenter: island.center,
      islandWidth: island.width,
      islandDepth: island.depth,
      islandRows: island.rows.length,
      rowInIsland: rowIndex,
      podsInRow: rowItems.length,
      podIndex: idx,
      position: [x, 0, z],
    }
  })))
}
