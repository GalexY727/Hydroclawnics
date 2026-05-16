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
