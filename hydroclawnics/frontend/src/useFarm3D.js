const STATUS_COLOR = {
  healthy:  '#7fb069',
  warning:  '#d4a373',
  critical: '#c9566b',
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
    const heightScale = Math.min(1.4, Math.max(0.5, (Number(pod.plant_height_cm) || 10) / 15))
    return {
      pod_id: pod.id,
      status: pod.status,
      age_hours: Number(pod.age_hours) || 0,
      heightScale,
      color: STATUS_COLOR[pod.status] || STATUS_COLOR.healthy,
      position: [(col - (cols - 1) / 2) * 3, 0, (row - 1) * 3],
    }
  })
}
