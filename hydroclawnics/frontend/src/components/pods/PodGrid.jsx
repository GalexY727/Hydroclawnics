import { useMemo, useState } from 'react'
import CropIcon from '../CropIcon'
import { FAULT_TYPES, STATUS_ORDER, TARGET_RANGES, formatMetric, metricState } from '../../data/operations'

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

function timeLabel(timestamp) {
  const date = timestamp ? new Date(timestamp) : new Date()
  if (Number.isNaN(date.getTime())) return '--:--'
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function faultForPod(pod) {
  return FAULT_TYPES.find((fault) => fault.id === pod.fault_type) || null
}

function metricLabel(metric) {
  return TARGET_RANGES[metric]?.label || metric?.replaceAll('_', ' ') || 'Metric'
}

function metricText(pod, metric) {
  const state = metricState(pod[metric], metric)
  const arrow = state.state === 'ok' ? '' : state.delta < 0 ? ' ↓' : ' ↑'
  return `${metricLabel(metric)} ${formatMetric(pod[metric], metric)}${arrow}`
}

function primaryDeviation(pod) {
  const fault = faultForPod(pod)
  const metric = fault?.metric || METRIC_PRIORITY.find((key) => metricState(pod[key], key).state !== 'ok') || 'ph'
  const state = metricState(pod[metric], metric)
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
    const isOutOfRange = metricState(pod[deviation.metric], deviation.metric).state !== 'ok'
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

function farmState(summary) {
  if (summary.counts.critical > 0) return { label: 'Critical Attention', status: 'critical' }
  if (summary.counts.warning > 0 || summary.counts.verifying > 0 || summary.counts.recovering > 0) return { label: 'Watch', status: 'warning' }
  return { label: 'Operational', status: 'healthy' }
}

function FarmSummary({ summary, connectionStatus, policy, incidents }) {
  const state = farmState(summary)
  const activeIncidents = incidents.filter((incident) => incident.status === 'active').length
  const stablePods = summary.counts.healthy || 0
  const lastSync = timeLabel()
  const metrics = [
    ['Operational status', state.label],
    ['Total pods', summary.pods],
    ['Stable pods', stablePods],
    ['Active incidents', activeIncidents],
    ['Mode', policy.mode],
    ['Connection', connectionStatus],
    ['Last sync', lastSync],
  ]

  return (
    <section className="app-panel dashboard-summary rounded-md p-3">
      <div className="grid items-center gap-3 xl:grid-cols-[170px_1fr]">
        <div className="min-w-0">
          <div className="text-xs uppercase" style={{ color: 'var(--color-muted)' }}>Farm Health</div>
          <div className="mt-1 flex items-center gap-2">
            <span className="font-mono text-3xl font-semibold leading-none">{summary.healthScore}%</span>
            <span className={`status-pill status-pill-small status-${state.status}`}>{state.label}</span>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map(([label, value]) => (
            <div key={label} className="summary-metric">
              <div className="truncate text-[10px] uppercase" style={{ color: 'var(--color-muted)' }}>{label}</div>
              <div className="mt-0.5 truncate text-xs font-semibold sm:text-sm">{value}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
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
            placeholder={'Search pods, crops, zones... try status:critical zone:"East Rack" crop:tomato'}
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
            <span>zone:"East Rack"</span>
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

function PodCardCompact({ pod, incident, active, onSelect }) {
  const status = friendlyStatus(pod.status)
  const accent = STATUS_COLORS[pod.status] || STATUS_COLORS.healthy
  const metrics = metricPair(pod)
  const quiet = status === 'healthy'

  return (
    <button
      type="button"
      onClick={() => onSelect?.(pod.id)}
      className={`pod-card pod-card-compact ${quiet ? 'pod-card-quiet' : ''} ${active ? 'pod-card-active' : ''}`}
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

      <div className="mt-2 min-h-[18px] truncate text-xs font-semibold sm:text-sm" style={{ color: quiet ? 'var(--color-muted)' : accent }}>
        {issueLabel(pod)}
      </div>

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs" style={{ color: 'var(--color-text)' }}>
        {metrics.map((metric) => (
          <span key={metric} className="font-mono">{metricText(pod, metric)}</span>
        ))}
      </div>

      <div className="mt-2 flex min-w-0 items-center justify-between gap-2 text-xs" style={{ color: 'var(--color-muted)' }}>
        <span className="truncate">{incident ? `Incident ${incident.lifecycle.replaceAll('_', ' ')}` : pod.last_action || 'Stable'}</span>
        <span className="shrink-0">{pod.reservoir}</span>
      </div>
    </button>
  )
}

export default function PodGrid({
  pods,
  summary,
  connectionStatus,
  onSelect,
  onSimulateFault,
  simulationMessage,
  policy,
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
      <FarmSummary summary={summary} connectionStatus={connectionStatus} policy={policy} incidents={incidents} />
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
