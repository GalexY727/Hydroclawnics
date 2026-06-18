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
  return Math.max(1, Math.ceil(Math.sqrt(count)))
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
  const maxCols = Math.max(gridColumns(list.length), ...groups.map(([, items]) => items.length))
  const rowOffset = (groups.length - 1) / 2
  let podIndex = 0

  return groups.flatMap(([group, items], row) => items.map((pod, col) => {
    const idx = podIndex
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
      group,
      podIndex: idx,
      position: [(col - (maxCols - 1) / 2) * 2.45, 0, (row - rowOffset) * 2.35],
    }
  }))
}
