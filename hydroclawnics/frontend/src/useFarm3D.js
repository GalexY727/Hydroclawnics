const STATUS_COLOR = {
  healthy: '#4ade80',
  warning: '#facc15',
  critical: '#f87171',
}

export default function useFarm3D(pods) {
  return Object.values(pods).map((pod, idx) => ({
    pod_id: pod.id,
    status: pod.status,
    // # FIX: Growth scale now follows the 0-72 hour requirement instead of flattening over 240 hours.
    ageScale: Math.min(1, Math.max(0.3, 0.3 + (Number(pod.age_hours || 0) / 72) * 0.7)),
    color: STATUS_COLOR[pod.status] || STATUS_COLOR.healthy,
    position: [((idx % 4) - 1.5) * 3, 0, (Math.floor(idx / 4) - 2) * 3],
  }))
}
