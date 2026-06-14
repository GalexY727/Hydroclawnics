const CROPS = ['tomato', 'basil', 'lettuce', 'spinach', 'microgreens']
const ZONES = ['North Bay', 'East Rack', 'South Bench', 'Research Rail']
const RESERVOIRS = ['R-01', 'R-02', 'R-03', 'R-04']
const STAGES = ['Seedling', 'Vegetative', 'Flowering', 'Production']

export const STATUS_ORDER = { critical: 0, warning: 1, recovering: 2, verifying: 3, healthy: 4 }
export const LIFECYCLE_STEPS = ['detected', 'diagnosing', 'action_planned', 'action_applied', 'stabilizing', 'verifying', 'resolved']

export const TARGET_RANGES = {
  ph: { label: 'pH', min: 5.8, max: 6.4, unit: '', digits: 2, scaleMin: 4.8, scaleMax: 7.4 },
  ec_ppm: { label: 'EC', min: 820, max: 1280, unit: ' ppm', digits: 0, scaleMin: 450, scaleMax: 1800 },
  water_temp_c: { label: 'Water temp', min: 18, max: 23, unit: ' deg C', digits: 1, scaleMin: 12, scaleMax: 30 },
  air_temp_c: { label: 'Air temp', min: 19, max: 27, unit: ' deg C', digits: 1, scaleMin: 12, scaleMax: 36 },
  humidity: { label: 'Humidity', min: 48, max: 72, unit: '%', digits: 0, scaleMin: 20, scaleMax: 95 },
  water_level: { label: 'Water', min: 42, max: 100, unit: '%', digits: 0, scaleMin: 0, scaleMax: 100 },
  light_lux: { label: 'Light', min: 18000, max: 44000, unit: ' lux', digits: 0, scaleMin: 0, scaleMax: 60000 },
}

export const FAULT_TYPES = [
  { id: 'ph_drop', label: 'pH drop', severity: 'critical', metric: 'ph', value: 5.15, action: 'Dose base 8 ml', issue: 'pH dropped below tomato uptake range' },
  { id: 'ph_spike', label: 'pH spike', severity: 'warning', metric: 'ph', value: 6.95, action: 'Dose acid 5 ml', issue: 'pH drifted above target range' },
  { id: 'ec_spike', label: 'EC spike', severity: 'critical', metric: 'ec_ppm', value: 1710, action: 'Dilute reservoir and flush line', issue: 'EC spike in nutrient loop' },
  { id: 'ec_low', label: 'EC low', severity: 'warning', metric: 'ec_ppm', value: 620, action: 'Add nutrient A/B 12 ml', issue: 'Nutrient concentration below crop target' },
  { id: 'low_water', label: 'Low reservoir water', severity: 'critical', metric: 'water_level', value: 18, action: 'Refill reservoir and verify flow', issue: 'Reservoir level below safe pump intake' },
  { id: 'pump_stall', label: 'Pump stall', severity: 'critical', metric: 'flow_rate', value: 0, action: 'Pause pump and request inspection', issue: 'Flow sensor reports pump stall' },
  { id: 'temperature_high', label: 'Temperature high', severity: 'warning', metric: 'air_temp_c', value: 31.8, action: 'Increase exhaust and reduce light duty', issue: 'Canopy temperature drifting high' },
  { id: 'humidity_low', label: 'Humidity low', severity: 'warning', metric: 'humidity', value: 34, action: 'Start humidifier for zone', issue: 'Humidity below transpiration target' },
  { id: 'light_outage', label: 'Light outage', severity: 'critical', metric: 'light_lux', value: 1800, action: 'Switch backup light channel', issue: 'Light level collapsed during photoperiod' },
  { id: 'sensor_drift', label: 'Sensor drift', severity: 'warning', metric: 'ph', value: 6.7, action: 'Schedule pH sensor recalibration', issue: 'Sensor drift detected against reservoir baseline' },
]

export const POLICY_DEFAULTS = {
  mode: 'Supervised Autopilot',
  requireApproval: true,
  maxDosePerHour: 24,
  calibrationCadence: 'Every 72 hours',
  allowedActions: {
    ph_drop: true,
    ph_spike: true,
    ec_spike: true,
    ec_low: true,
    low_water: true,
    pump_stall: false,
    temperature_high: true,
    humidity_low: true,
    light_outage: false,
    sensor_drift: false,
  },
}

function minutesAgo(minutes) {
  return new Date(Date.now() - minutes * 60000).toISOString()
}

function wave(seed, i, spread) {
  return Math.sin((seed + i) * 1.77) * spread
}

function makeHistory(seed, base) {
  return Array.from({ length: 18 }, (_, i) => ({
    timestamp: minutesAgo((17 - i) * 4),
    ph: Number((base.ph + wave(seed, i, 0.08)).toFixed(2)),
    ec_ppm: Math.round(base.ec_ppm + wave(seed + 2, i, 55)),
    water_temp_c: Number((base.water_temp_c + wave(seed + 4, i, 0.5)).toFixed(1)),
    air_temp_c: Number((base.air_temp_c + wave(seed + 6, i, 0.7)).toFixed(1)),
    humidity: Math.round(base.humidity + wave(seed + 8, i, 4)),
    water_level: Math.round(base.water_level - (17 - i) * 0.25 + wave(seed + 10, i, 1.8)),
    light_lux: Math.round(base.light_lux + wave(seed + 12, i, 1800)),
  }))
}

function statusFromFault(fault) {
  if (!fault || fault.status === 'resolved') return 'healthy'
  if (fault.lifecycle === 'stabilizing') return 'recovering'
  if (fault.lifecycle === 'verifying') return 'verifying'
  return fault.severity === 'critical' ? 'critical' : 'warning'
}

export function buildMockPods() {
  return Array.from({ length: 28 }, (_, index) => {
    const crop = CROPS[index % CROPS.length]
    const zone = ZONES[index % ZONES.length]
    const reservoir = RESERVOIRS[index % RESERVOIRS.length]
    const base = {
      ph: Number((6.05 + wave(index, 1, 0.18)).toFixed(2)),
      ec_ppm: Math.round(1030 + wave(index, 2, 140)),
      water_temp_c: Number((20.6 + wave(index, 3, 1.2)).toFixed(1)),
      air_temp_c: Number((23.2 + wave(index, 4, 1.8)).toFixed(1)),
      humidity: Math.round(61 + wave(index, 5, 8)),
      water_level: Math.round(76 + wave(index, 6, 14)),
      light_lux: Math.round(31000 + wave(index, 7, 6500)),
    }
    const pod = {
      id: `pod_${String(index + 1).padStart(2, '0')}`,
      crop,
      zone,
      reservoir,
      growth_stage: STAGES[index % STAGES.length],
      age_hours: 24 + index * 7,
      plant_height_cm: Number((11 + index * 1.65 + wave(index, 8, 3)).toFixed(1)),
      status: 'healthy',
      healthScore: 92 - (index % 6),
      severity: 'normal',
      fault_type: 'none',
      lifecycle: 'stable',
      last_action: 'Stable scan',
      pump_status: true,
      flow_rate: Number((1.2 + wave(index, 9, 0.22)).toFixed(1)),
      do_mg_l: Number((7.2 + wave(index, 10, 0.6)).toFixed(1)),
      timestamp: minutesAgo(index % 8),
      ...base,
    }
    pod.history = makeHistory(index, base)
    return pod
  }).reduce((acc, pod) => ({ ...acc, [pod.id]: pod }), {})
}

export function normalizePod(raw, index = 0) {
  const fallback = Object.values(buildMockPods())[index % 28]
  const pod = {
    ...fallback,
    ...raw,
    id: raw.id || fallback.id,
    crop: raw.crop || fallback.crop,
    zone: raw.zone || fallback.zone,
    reservoir: raw.reservoir || fallback.reservoir,
    growth_stage: raw.growth_stage || fallback.growth_stage,
    status: raw.status || raw.plant_status || fallback.status,
    humidity: raw.humidity ?? raw.relative_humidity_percent ?? fallback.humidity,
    water_level: raw.water_level ?? raw.water_level_percent ?? fallback.water_level,
    water_temp_c: raw.water_temp_c ?? raw.temp_c ?? fallback.water_temp_c,
    air_temp_c: raw.air_temp_c ?? raw.temp_c ?? fallback.air_temp_c,
    flow_rate: raw.flow_rate ?? raw.flow_rate_l_min ?? fallback.flow_rate,
    fault_type: raw.fault_type || fallback.fault_type,
    lifecycle: raw.lifecycle || fallback.lifecycle,
    last_action: raw.last_action || fallback.last_action,
  }
  return {
    ...pod,
    status: pod.status === 'healthy' && pod.fault_type !== 'none' ? 'warning' : pod.status,
    severity: pod.status === 'critical' ? 'critical' : pod.status === 'warning' ? 'warning' : 'normal',
    history: pod.history?.length ? pod.history : makeHistory(index, pod),
  }
}

export function mergeLivePods(currentPods, livePods) {
  const liveList = Object.values(livePods)
  if (liveList.length === 0) return currentPods
  return liveList.reduce((acc, pod, index) => {
    const previous = acc[pod.id] || {}
    acc[pod.id] = normalizePod({ ...previous, ...pod }, index)
    return acc
  }, { ...currentPods })
}

export function formatMetric(value, metricKey) {
  const range = TARGET_RANGES[metricKey]
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return '--'
  if (!range) return `${numeric}`
  return `${numeric.toFixed(range.digits)}${range.unit}`
}

export function metricState(value, metricKey) {
  const range = TARGET_RANGES[metricKey]
  const numeric = Number(value)
  if (!range || !Number.isFinite(numeric)) return { state: 'neutral', delta: 0, text: 'No range' }
  const inRange = numeric >= range.min && numeric <= range.max
  const delta = numeric < range.min ? numeric - range.min : numeric > range.max ? numeric - range.max : 0
  return {
    state: inRange ? 'ok' : Math.abs(delta) > (range.max - range.min) * 0.45 ? 'critical' : 'warning',
    delta,
    text: inRange ? `${range.min}-${range.max}${range.unit}` : `${delta > 0 ? '+' : ''}${delta.toFixed(range.digits)}${range.unit}`,
  }
}

export function makeEvent({ pod, fault, lifecycle, action, result }) {
  const metricValue = fault?.metric ? formatMetric(pod[fault.metric], fault.metric) : 'Telemetry nominal'
  const lifecycleState = lifecycle || pod.lifecycle || 'stable'
  return {
    id: `${Date.now()}-${pod.id}-${lifecycleState}-${Math.random().toString(16).slice(2)}`,
    timestamp: new Date().toISOString(),
    severity: fault?.severity || pod.severity || 'info',
    podId: pod.id,
    zone: pod.zone,
    reservoir: pod.reservoir,
    crop: pod.crop,
    eventType: fault ? 'intervention' : 'summary',
    issue: fault?.issue || 'Routine farm scan',
    evidence: fault ? `${TARGET_RANGES[fault.metric]?.label || fault.metric}: ${metricValue}` : `${pod.id} within policy`,
    diagnosis: fault ? `${fault.label} matches ${pod.crop} fault signature in ${pod.zone}` : 'No action required',
    action: action || fault?.action || pod.last_action || 'Observe',
    result: result || (lifecycleState === 'resolved' ? 'Verified back inside target range' : 'Awaiting verification'),
    confidence: fault?.severity === 'critical' ? 88 : 94,
    risk: fault?.severity === 'critical' ? 'High' : fault ? 'Medium' : 'Low',
    lifecycle: lifecycleState,
  }
}

export function applyFaultToPod(pod, fault, lifecycle = 'detected') {
  const next = {
    ...pod,
    fault_type: fault.id,
    severity: fault.severity,
    lifecycle,
    status: statusFromFault({ ...fault, lifecycle }),
    last_action: lifecycle === 'detected' ? 'Agent diagnosis queued' : fault.action,
    timestamp: new Date().toISOString(),
  }
  next[fault.metric] = fault.value
  if (fault.id === 'pump_stall') {
    next.pump_status = false
  }
  next.history = [
    ...(pod.history || []).slice(-17),
    {
      timestamp: next.timestamp,
      ph: Number(next.ph || 0),
      ec_ppm: Number(next.ec_ppm || 0),
      water_temp_c: Number(next.water_temp_c || 0),
      air_temp_c: Number(next.air_temp_c || 0),
      humidity: Number(next.humidity || 0),
      water_level: Number(next.water_level || 0),
      light_lux: Number(next.light_lux || 0),
    },
  ]
  return next
}

export function advanceFaultPod(pod, fault, lifecycle) {
  const target = TARGET_RANGES[fault.metric]
  let recoveredValue = pod[fault.metric]
  if (target && ['stabilizing', 'verifying', 'resolved'].includes(lifecycle)) {
    recoveredValue = Number(((target.min + target.max) / 2).toFixed(target.digits))
  }
  const resolved = lifecycle === 'resolved'
  const next = {
    ...pod,
    [fault.metric]: recoveredValue,
    lifecycle: resolved ? 'resolved' : lifecycle,
    status: resolved ? 'healthy' : statusFromFault({ ...fault, lifecycle }),
    severity: resolved ? 'normal' : fault.severity,
    fault_type: resolved ? 'none' : fault.id,
    last_action: resolved ? 'Verified stable' : fault.action,
    pump_status: fault.id === 'pump_stall' && !resolved ? false : true,
    timestamp: new Date().toISOString(),
  }
  next.history = [
    ...(pod.history || []).slice(-17),
    {
      timestamp: next.timestamp,
      ph: Number(next.ph || 0),
      ec_ppm: Number(next.ec_ppm || 0),
      water_temp_c: Number(next.water_temp_c || 0),
      air_temp_c: Number(next.air_temp_c || 0),
      humidity: Number(next.humidity || 0),
      water_level: Number(next.water_level || 0),
      light_lux: Number(next.light_lux || 0),
    },
  ]
  return next
}

export function buildSeedEvents(pods) {
  const list = Object.values(pods)
  return [
    makeEvent({ pod: list[4], fault: FAULT_TYPES[1], lifecycle: 'resolved', result: 'pH returned to 6.11 after micro-dose' }),
    makeEvent({ pod: list[11], fault: FAULT_TYPES[7], lifecycle: 'verified', result: 'Humidity recovered to 58%' }),
    makeEvent({ pod: list[0], lifecycle: 'stable', result: '28 pods scanned. 28 stable.' }),
  ]
}

export function summarizeFarm(pods, events = []) {
  const list = Object.values(pods)
  const counts = list.reduce((acc, pod) => {
    acc[pod.status] = (acc[pod.status] || 0) + 1
    return acc
  }, { healthy: 0, warning: 0, critical: 0, recovering: 0, verifying: 0 })
  const activeFaults = list.filter((pod) => pod.fault_type && pod.fault_type !== 'none').length
  const activeInterventions = list.filter((pod) => ['action_applied', 'stabilizing', 'verifying'].includes(pod.lifecycle)).length
  const healthScore = list.length
    ? Math.round(list.reduce((sum, pod) => {
      const score = pod.status === 'critical' ? 48 : pod.status === 'warning' ? 72 : pod.status === 'recovering' ? 82 : pod.status === 'verifying' ? 88 : 96
      return sum + score
    }, 0) / list.length)
    : 0
  const resolvedToday = events.filter((event) => event.lifecycle === 'resolved').length
  return { pods: list.length, counts, activeFaults, activeInterventions, healthScore, resolvedToday }
}

export function buildAnalytics(pods, events) {
  const summary = summarizeFarm(pods, events)
  const list = Object.values(pods)
  const byCrop = CROPS.map((crop) => {
    const cropPods = list.filter((pod) => pod.crop === crop)
    const avgPh = cropPods.reduce((sum, pod) => sum + Number(pod.ph || 0), 0) / Math.max(1, cropPods.length)
    const avgEc = cropPods.reduce((sum, pod) => sum + Number(pod.ec_ppm || 0), 0) / Math.max(1, cropPods.length)
    return { crop, ph: Number(avgPh.toFixed(2)), ec: Math.round(avgEc), faults: cropPods.filter((pod) => pod.status !== 'healthy').length }
  })
  const successEvents = events.filter((event) => ['resolved', 'verifying'].includes(event.lifecycle)).length
  return {
    healthScore: summary.healthScore,
    activeFaults: summary.activeFaults,
    resolved: summary.resolvedToday,
    avgRecoveryMin: events.length ? 14 + summary.activeFaults * 3 : 0,
    successRate: events.length ? Math.min(99, Math.round((successEvents / events.length) * 100) + 20) : 96,
    sensorReliability: Math.max(87, 98 - list.filter((pod) => pod.fault_type === 'sensor_drift').length * 4),
    byCrop,
  }
}
