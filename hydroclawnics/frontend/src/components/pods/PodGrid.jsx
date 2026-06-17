import { useMemo, useState } from 'react'
import CropIcon from '../CropIcon'
import { FAULT_TYPES, STATUS_ORDER, TARGET_RANGES } from '../../data/operations'

const STATUS_COLORS = {
  healthy: 'var(--color-success)',
  warning: 'var(--color-warning)',
  critical: 'var(--color-critical)',
  recovering: 'var(--color-warning)',
  verifying: 'var(--color-info)',
}

const SEARCH_KEYS = ['status', 'zone', 'crop', 'reservoir', 'metric', 'issue', 'sort']
const METRIC_PRIORITY = ['ph', 'ec_ppm', 'water_level', 'flow_rate', 'air_temp_c', 'humidity', 'light_lux']

function normalize(value) {
  return `${value ?? ''}`.trim().toLowerCase()
}

function friendlyStatus(status) {
  if (status === 'recovering') return 'warning'
  return status || 'healthy'
}

function faultForPod(pod) {
  return FAULT_TYPES.find((fault) => fault.id === pod.fault_type) || null
}

function metricLabel(metric) {
  return TARGET_RANGES[metric]?.label || metric?.replaceAll('_', ' ') || 'Metric'
}

function metricText(pod, metric) {
  const state = metricStateForPod(pod, metric)
  const arrow = state.state === 'ok' ? '' : state.delta < 0 ? ' ↓' : ' ↑'
  return `${metricLabel(metric)} ${formatMetricWithRange(pod[metric], metric, rangeForPod(pod, metric))}${arrow}`
}

function rangeForPod(pod, metric) {
  const cropKey = normalize(pod.crop)
  const podRanges = pod.target_ranges || pod.targetRanges || pod.ranges || {}
  const cropRanges = pod.crop_target_ranges || pod.cropTargetRanges || {}
  return podRanges[metric] || cropRanges[cropKey]?.[metric] || TARGET_RANGES[metric] || null
}

function formatMetricWithRange(value, metric, range) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return '--'
  if (!range) return `${numeric}`
  return `${numeric.toFixed(range.digits ?? 1)}${range.unit ?? ''}`
}

function metricStateForPod(pod, metric) {
  const range = rangeForPod(pod, metric)
  const numeric = Number(pod[metric])
  if (!range || !Number.isFinite(numeric)) return { state: 'neutral', delta: 0, text: 'No range' }
  const inRange = numeric >= range.min && numeric <= range.max
  const delta = numeric < range.min ? numeric - range.min : numeric > range.max ? numeric - range.max : 0
  return {
    state: inRange ? 'ok' : Math.abs(delta) > (range.max - range.min) * 0.45 ? 'critical' : 'warning',
    delta,
    text: inRange ? `${range.min}-${range.max}${range.unit ?? ''}` : `${delta > 0 ? '+' : ''}${delta.toFixed(range.digits ?? 1)}${range.unit ?? ''}`,
  }
}

function primaryDeviation(pod) {
  const fault = faultForPod(pod)
  const metric = fault?.metric || METRIC_PRIORITY.find((key) => metricStateForPod(pod, key).state !== 'ok') || 'ph'
  const state = metricStateForPod(pod, metric)
  return { metric, state, fault }
}

function issueLabel(pod) {
  if (friendlyStatus(pod.status) === 'healthy') return 'Healthy'
  const deviation = primaryDeviation(pod)
  if (deviation.fault) return `${friendlyStatus(pod.status)}: ${deviation.fault.label}`
  return `${friendlyStatus(pod.status)}: ${metricLabel(deviation.metric)} ${deviation.state.text}`
}

function metricPair(pod) {
  const deviation = primaryDeviation(pod)
  if (friendlyStatus(pod.status) === 'healthy') return ['ph', 'ec_ppm']
  const secondary = deviation.metric === 'ec_ppm' ? 'ph' : 'ec_ppm'
  return [deviation.metric, secondary]
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value))
}

function recentMetricRange(pod, metric) {
  const values = (pod.history || [])
    .slice(-10)
    .map((reading) => Number(reading[metric]))
    .filter(Number.isFinite)

  const current = Number(pod[metric])
  if (Number.isFinite(current)) values.push(current)
  if (!values.length) return null

  values.sort((a, b) => a - b)
  const lowIndex = Math.floor((values.length - 1) * 0.2)
  const highIndex = Math.ceil((values.length - 1) * 0.8)
  return {
    low: values[lowIndex],
    high: values[highIndex],
  }
}

function metricScale(pod, metric) {
  const range = rangeForPod(pod, metric)
  const current = Number(pod[metric])
  const recent = recentMetricRange(pod, metric)

  if (range) {
    const rangeWidth = range.max - range.min
    const criticalOffset = rangeWidth * 0.45
    return {
      min: range.scaleMin,
      max: range.scaleMax,
      healthyMin: range.min,
      healthyMax: range.max,
      warningLow: range.min,
      warningHigh: range.max,
      criticalLow: range.min - criticalOffset,
      criticalHigh: range.max + criticalOffset,
      recent,
      current,
      source: pod.target_ranges?.[metric] || pod.targetRanges?.[metric] || pod.ranges?.[metric]
        ? 'pod'
        : pod.crop_target_ranges?.[normalize(pod.crop)]?.[metric] || pod.cropTargetRanges?.[normalize(pod.crop)]?.[metric]
          ? 'crop'
          : 'global',
    }
  }

  const safeCurrent = Number.isFinite(current) ? current : 0
  const spread = Math.max(Math.abs(safeCurrent) * 0.4, 1)
  return {
    min: safeCurrent - spread,
    max: safeCurrent + spread,
    recent,
    current,
  }
}

function positionInScale(value, scale) {
  if (!Number.isFinite(value) || scale.max === scale.min) return 50
  return clamp(((value - scale.min) / (scale.max - scale.min)) * 100)
}

function metricMarkerLabel(label, value, metric, range) {
  return `${label}: ${formatMetricWithRange(value, metric, range)}`
}

function statusRank(pod) {
  return STATUS_ORDER[pod.status] ?? STATUS_ORDER.healthy
}

function defaultPodSort(a, b) {
  const severity = statusRank(a) - statusRank(b)
  if (severity !== 0) return severity
  return new Date(b.timestamp || 0) - new Date(a.timestamp || 0)
}

function fuzzyIncludes(haystack, needle) {
  const source = normalize(haystack)
  const query = normalize(needle)
  if (!query) return true
  if (source.includes(query)) return true
  let cursor = 0
  for (const char of query) {
    cursor = source.indexOf(char, cursor)
    if (cursor === -1) return false
    cursor += 1
  }
  return true
}

function parseSearch(query) {
  const filters = {}
  const structured = /(\w+):(?:"([^"]+)"|(\S+))/g
  let free = query
  for (const match of query.matchAll(structured)) {
    const key = normalize(match[1])
    if (SEARCH_KEYS.includes(key)) filters[key] = match[2] ?? match[3] ?? ''
    free = free.replace(match[0], ' ')
  }
  return {
    filters,
    terms: free.split(/\s+/).map((term) => term.trim()).filter(Boolean),
  }
}

function podHaystack(pod) {
  const fault = faultForPod(pod)
  const deviation = primaryDeviation(pod)
  return [
    pod.id,
    pod.crop,
    pod.zone,
    pod.reservoir,
    pod.status,
    pod.lifecycle,
    pod.severity,
    pod.last_action,
    fault?.label,
    fault?.issue,
    metricLabel(deviation.metric),
    deviation.metric,
  ].filter(Boolean).join(' ')
}

function matchesStructuredFilter(pod, filters) {
  if (filters.status && friendlyStatus(pod.status) !== normalize(filters.status) && normalize(pod.lifecycle) !== normalize(filters.status)) return false
  if (filters.zone && !fuzzyIncludes(pod.zone, filters.zone)) return false
  if (filters.crop && !fuzzyIncludes(pod.crop, filters.crop)) return false
  if (filters.reservoir && !fuzzyIncludes(pod.reservoir, filters.reservoir)) return false
  if (filters.issue) {
    const issue = `${issueLabel(pod)} ${faultForPod(pod)?.issue || ''}`
    if (!fuzzyIncludes(issue, filters.issue)) return false
  }
  if (filters.metric) {
    const rawMetric = normalize(filters.metric)
    const metric = rawMetric === 'ec' ? 'ec_ppm' : rawMetric
    const deviation = primaryDeviation(pod)
    const isRelevant = normalize(deviation.metric) === metric || normalize(metricLabel(deviation.metric)) === metric
    const isOutOfRange = metricStateForPod(pod, deviation.metric).state !== 'ok'
    if (!isRelevant || (!isOutOfRange && friendlyStatus(pod.status) === 'healthy')) return false
  }
  return true
}

function filterPods(pods, query) {
  const parsed = parseSearch(query)
  const sort = normalize(parsed.filters.sort) || 'severity'
  const filtered = pods.filter((pod) => {
    if (!matchesStructuredFilter(pod, parsed.filters)) return false
    const haystack = podHaystack(pod)
    return parsed.terms.every((term) => fuzzyIncludes(haystack, term))
  })

  if (sort === 'recent') return [...filtered].sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
  return [...filtered].sort(defaultPodSort)
}

function ZoneStatusGrid({ pods }) {
  const zones = useMemo(() => {
    const grouped = pods.reduce((acc, pod) => {
      if (!acc[pod.zone]) acc[pod.zone] = []
      acc[pod.zone].push(pod)
      return acc
    }, {})

    return Object.entries(grouped).map(([zone, zonePods]) => {
      const critical = zonePods.filter((pod) => pod.status === 'critical')
      const warning = zonePods.filter((pod) => pod.status === 'warning' || pod.status === 'recovering')
      const verifying = zonePods.filter((pod) => pod.status === 'verifying')
      const lead = critical[0] || warning[0] || verifying[0] || null
      const status = critical.length ? 'critical' : warning.length ? 'warning' : verifying.length ? 'verifying' : 'healthy'
      return {
        zone,
        podCount: zonePods.length,
        status,
        issue: lead ? issueLabel(lead).replace(`${status}: `, '') : 'All readings in range',
      }
    }).sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9))
  }, [pods])

  return (
    <section>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Zone Status</h2>
        <span className="text-xs" style={{ color: 'var(--color-muted)' }}>{zones.length} zones</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {zones.map((zone) => (
          <article key={zone.zone} className={`zone-status zone-status-${zone.status}`}>
            <div className="flex min-w-0 items-center justify-between gap-2">
              <h3 className="truncate text-sm font-semibold">{zone.zone}</h3>
              <span className={`status-pill status-pill-small status-${zone.status}`}>{zone.status}</span>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-3 text-xs" style={{ color: 'var(--color-muted)' }}>
              <span>{zone.podCount} pods</span>
              <span className="truncate text-right">{zone.issue}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function ActiveIncidentSummary({ incident, onIncidentSelect, onSelect }) {
  const [acknowledged, setAcknowledged] = useState(false)
  if (!incident || incident.status !== 'active') return null

  const status = incident.lifecycle === 'verifying' ? 'verifying' : incident.severity

  return (
    <section className="active-incident-banner active-incident-alert rounded-md border p-3" style={{ borderColor: 'rgba(108, 195, 255, 0.38)', background: 'rgba(108, 195, 255, 0.08)' }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className={`status-pill status-pill-small status-${status}`}>{incident.lifecycle.replaceAll('_', ' ')}</span>
            <h2 className="min-w-0 truncate text-sm font-semibold sm:text-base">{incident.title}</h2>
            {acknowledged && <span className="text-xs" style={{ color: 'var(--color-muted)' }}>Acknowledged</span>}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs" style={{ color: 'var(--color-muted)' }}>
            <span>{incident.podId}</span>
            <span>{incident.crop}</span>
            <span>{incident.zone}</span>
            <span>{incident.reservoir}</span>
          </div>
          <p className="mt-1.5 max-w-4xl text-xs leading-5 sm:text-sm" style={{ color: 'var(--color-muted)' }}>
            {incident.evidence}. {incident.action}. {incident.result}.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button type="button" className="quiet-action" onClick={() => onSelect?.(incident.podId)}>View Pod</button>
          <button type="button" className="quiet-action" onClick={() => onIncidentSelect?.(incident)}>View Evidence</button>
          <button type="button" className="quiet-action" onClick={() => setAcknowledged(true)}>Acknowledge</button>
        </div>
      </div>
    </section>
  )
}

function SmartPodSearch({ query, setQuery, total, visible, onSimulateFault, simulationMessage }) {
  const [fault, setFault] = useState('ph_drop')
  return (
    <section className="app-panel smart-search-row rounded-md p-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="min-w-[220px] flex-1">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={'Search pods, crops, zones... try status:critical zone:"Zone 2" crop:tomato'}
            className="min-h-9 w-full rounded-md border px-3 text-sm"
            style={{ background: 'rgba(8, 13, 20, 0.72)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            aria-label="Search pods"
          />
        </div>
        <span className="rounded-md border px-2 py-1.5 text-xs" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>
          {visible} of {total} visible
        </span>
        <details className="syntax-help">
          <summary aria-label="Search syntax help">?</summary>
          <div>
            <span>status:critical</span>
            <span>zone:"Zone 2"</span>
            <span>crop:tomato</span>
            <span>reservoir:R-02</span>
            <span>metric:ph</span>
            <span>issue:humidity</span>
            <span>sort:recent</span>
          </div>
        </details>
        <select
          value={fault}
          onChange={(event) => setFault(event.target.value)}
          className="min-h-9 rounded-md border px-2 text-xs"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
          aria-label="Fault type"
        >
          {FAULT_TYPES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
        <button
          type="button"
          onClick={() => onSimulateFault(fault)}
          className="min-h-9 rounded-md border px-3 text-xs font-semibold"
          style={{ borderColor: 'rgba(255, 92, 122, 0.55)', background: 'rgba(255, 92, 122, 0.12)' }}
        >
          Simulate Fault
        </button>
        <span className="min-w-0 truncate text-xs" style={{ color: 'var(--color-warning)' }}>{simulationMessage}</span>
      </div>
    </section>
  )
}

function MiniMetricRange({ pod, metric, emphasized }) {
  const range = rangeForPod(pod, metric)
  const scale = metricScale(pod, metric)
  const state = metricStateForPod(pod, metric)
  const currentPosition = positionInScale(scale.current, scale)
  const healthyLeft = range ? positionInScale(scale.healthyMin, scale) : null
  const healthyRight = range ? positionInScale(scale.healthyMax, scale) : null
  const recentLeft = scale.recent ? positionInScale(scale.recent.low, scale) : currentPosition
  const recentRight = scale.recent ? positionInScale(scale.recent.high, scale) : currentPosition
  const title = `${metricLabel(metric)} current ${formatMetricWithRange(pod[metric], metric, range)}${scale.recent ? `, recent range ${formatMetricWithRange(scale.recent.low, metric, range)} to ${formatMetricWithRange(scale.recent.high, metric, range)}` : ''}${range ? `, healthy range ${formatMetricWithRange(range.min, metric, range)} to ${formatMetricWithRange(range.max, metric, range)}, ${scale.source || 'global'} target` : ''}`
  const markerClass = state.state === 'critical' ? 'metric-current metric-current-critical' : state.state === 'warning' ? 'metric-current metric-current-warning' : 'metric-current'

  return (
    <div className={`metric-range-row ${emphasized ? 'metric-range-row-emphasis' : ''}`} title={title} aria-label={title}>
      <div className="min-w-0 truncate font-mono text-xs">{metricText(pod, metric)}</div>
      <div className="metric-range-track" aria-hidden="true">
        {range && (
          <span
            className="metric-healthy-window"
            style={{ left: `${healthyLeft}%`, width: `${Math.max(2, healthyRight - healthyLeft)}%` }}
          />
        )}
        {scale.recent && (
          <span
            className="metric-recent-range"
            style={{ left: `${Math.min(recentLeft, recentRight)}%`, width: `${Math.max(3, Math.abs(recentRight - recentLeft))}%` }}
          />
        )}
        {range && (
          <>
            <span className="metric-threshold metric-warning-marker" data-label={metricMarkerLabel('Warn low', scale.warningLow, metric, range)} style={{ left: `${positionInScale(scale.warningLow, scale)}%` }} />
            <span className="metric-threshold metric-warning-marker" data-label={metricMarkerLabel('Warn high', scale.warningHigh, metric, range)} style={{ left: `${positionInScale(scale.warningHigh, scale)}%` }} />
            <span className="metric-threshold metric-critical-marker" data-label={metricMarkerLabel('Crit low', scale.criticalLow, metric, range)} style={{ left: `${positionInScale(scale.criticalLow, scale)}%` }} />
            <span className="metric-threshold metric-critical-marker" data-label={metricMarkerLabel('Crit high', scale.criticalHigh, metric, range)} style={{ left: `${positionInScale(scale.criticalHigh, scale)}%` }} />
          </>
        )}
        <span className={markerClass} data-label={metricMarkerLabel('Current', scale.current, metric, range)} style={{ left: `${currentPosition}%` }} />
      </div>
    </div>
  )
}

function PodCardCompact({ pod, incident, active, onSelect }) {
  const status = friendlyStatus(pod.status)
  const accent = STATUS_COLORS[pod.status] || STATUS_COLORS.healthy
  const metrics = metricPair(pod)
  const quiet = status === 'healthy'
  const deviation = primaryDeviation(pod)

return (
    <button
        type="button"
        onClick={() => onSelect?.(pod.id)}
        className={`pod-card pod-card-compact flex flex-col h-full text-left ${quiet ? 'pod-card-quiet' : ''} ${active ? 'pod-card-active' : ''}`}
        style={{ borderTopColor: accent }}
    >
        <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-1.5">
                    <CropIcon crop={pod.crop} className="h-4 w-4 shrink-0" />
                    <span className="truncate text-sm font-semibold">{pod.id}</span>
                </div>
                <div className="mt-1 truncate text-xs capitalize" style={{ color: 'var(--color-muted)' }}>{pod.crop} · {pod.zone}</div>
            </div>
            <span className={`status-pill status-pill-small status-${status}`}>{status}</span>
        </div>

        {issueLabel(pod) !== 'Healthy' && (
            <div className="mt-2 min-h-[18px] truncate text-xs font-semibold sm:text-sm" style={{ color: quiet ? 'var(--color-muted)' : accent }}>
                {issueLabel(pod)}
            </div>
        )}

        <div className="mt-2 grid gap-1.5" style={{ color: 'var(--color-text)' }}>
            {metrics.map((metric) => (
                <MiniMetricRange key={metric} pod={pod} metric={metric} emphasized={metric === deviation.metric && !quiet} />
            ))}
        </div>

        <div className="mt-auto pt-2 flex min-w-0 items-center justify-between gap-2 text-xs" style={{ color: 'var(--color-muted)' }}>
            <span className="truncate">{incident ? `Incident ${incident.lifecycle.replaceAll('_', ' ')}` : pod.last_action || 'Stable'}</span>
            <span className="shrink-0">{pod.reservoir}</span>
        </div>
    </button>
)
}

export default function PodGrid({
  pods,
  onSelect,
  onSimulateFault,
  simulationMessage,
  incidents = [],
  activeIncident,
  onIncidentSelect,
}) {
  const [query, setQuery] = useState('')
  const podList = useMemo(() => Object.values(pods), [pods])
  const visible = useMemo(() => filterPods(podList, query), [podList, query])
  const incidentByPod = useMemo(() => incidents.reduce((acc, incident) => {
    if (incident.status === 'active') acc[incident.podId] = incident
    return acc
  }, {}), [incidents])

  return (
    <div className="overview-dashboard flex h-full min-h-0 flex-col gap-3">
      <ZoneStatusGrid pods={podList} />
      <ActiveIncidentSummary incident={activeIncident} onIncidentSelect={onIncidentSelect} onSelect={onSelect} />
      <SmartPodSearch
        query={query}
        setQuery={setQuery}
        total={podList.length}
        visible={visible.length}
        onSimulateFault={onSimulateFault}
        simulationMessage={simulationMessage}
      />

      <section className="min-h-0 flex-1 overflow-y-auto pr-1" aria-label="Pod overview grid">
        {visible.length ? (
          <div className="pod-grid-dense grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {visible.map((pod) => (
              <PodCardCompact
                key={pod.id}
                pod={pod}
                incident={incidentByPod[pod.id]}
                active={activeIncident?.podId === pod.id}
                onSelect={onSelect}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-md border p-5 text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>
            No pods match the current search.
          </div>
        )}
      </section>
    </div>
  )
}
