import { useMemo, useState } from 'react'
import CropIcon from '../CropIcon'
import PhysicalPot from './PhysicalPot'
import { FAULT_TYPES, STATUS_ORDER, TARGET_RANGES, formatMetric, metricState, trendState } from '../../data/operations'

const STATUS_COLORS = {
  healthy: 'var(--color-success)',
  warning: 'var(--color-warning)',
  critical: 'var(--color-critical)',
  recovering: 'var(--color-warning)',
  verifying: 'var(--color-info)',
}

const SORT_OPTIONS = [
  { value: 'status', label: 'Severity' },
  { value: 'zone', label: 'Zone' },
  { value: 'crop', label: 'Crop' },
  { value: 'reservoir', label: 'Reservoir' },
  { value: 'modified', label: 'Last sync' },
]

function uniqueValues(pods, key) {
  return [...new Set(pods.map((pod) => pod[key]).filter(Boolean))].sort()
}

function ZoneHealthStrip({ pods, activeIncident }) {
  const zones = useMemo(() => {
    const grouped = pods.reduce((acc, pod) => {
      if (!acc[pod.zone]) acc[pod.zone] = []
      acc[pod.zone].push(pod)
      return acc
    }, {})
    return Object.entries(grouped).map(([zone, zonePods]) => ({
      zone,
      pods: zonePods.length,
      critical: zonePods.filter((pod) => pod.status === 'critical').length,
      warning: zonePods.filter((pod) => pod.status === 'warning').length,
      verifying: zonePods.filter((pod) => pod.status === 'verifying' || pod.status === 'recovering').length,
    }))
  }, [pods])

  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {zones.map((zone) => {
        const active = activeIncident?.zone === zone.zone
        const color = zone.critical ? 'var(--color-critical)' : zone.warning ? 'var(--color-warning)' : zone.verifying ? 'var(--color-info)' : 'var(--color-success)'
        return (
          <div key={zone.zone} className={`zone-strip ${active ? 'zone-strip-active' : ''}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs font-semibold">{zone.zone}</span>
              <span className="text-[10px]" style={{ color: 'var(--color-muted)' }}>{zone.pods} pods</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full" style={{ background: color }} />
          </div>
        )
      })}
    </div>
  )
}

function StatusHeader({ summary, connectionStatus, policy, pods, incidents, activeIncident, agentStatus }) {
  const lastSync = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return (
    <section className="grid gap-3 xl:grid-cols-[1.35fr_0.9fr]">
      <div className="app-panel rounded-md p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase" style={{ color: 'var(--color-muted)' }}>Farm Health</div>
            <div className="mt-1 flex items-end gap-3">
              <span className="text-4xl font-semibold leading-none">{summary.healthScore}%</span>
              <span className="mb-1 text-sm" style={{ color: 'var(--color-success)' }}>Operational</span>
            </div>
          </div>
          <div className="grid h-16 w-16 place-items-center rounded-md border font-mono text-lg" style={{ borderColor: 'var(--color-success)', background: 'rgba(88, 214, 141, 0.12)', color: 'var(--color-success)' }}>
            AI
          </div>
        </div>
        <div className="mt-4 grid gap-2 text-xs sm:grid-cols-3" style={{ color: 'var(--color-muted)' }}>
          <span>Mode: <strong style={{ color: 'var(--color-text)' }}>{policy.mode}</strong></span>
          <span>Connection: <strong style={{ color: 'var(--color-text)' }}>{connectionStatus}</strong></span>
          <span>Last sync: <strong style={{ color: 'var(--color-text)' }}>{lastSync}</strong></span>
        </div>
        <ZoneHealthStrip pods={pods} activeIncident={activeIncident} />
      </div>

      <div className="grid gap-3">
        <div className="app-panel rounded-md p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">AI Sentinel</h2>
              <p className="mt-1 text-xs" style={{ color: 'var(--color-muted)' }}>
                Scanning {agentStatus.scanningPodId || '--'} in {agentStatus.scanningZone}
              </p>
            </div>
            <span className="ai-pulse h-3 w-3 rounded-full" style={{ background: 'var(--color-info)' }} />
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full" style={{ background: 'var(--color-surface-2)' }}>
            <div className="h-full rounded-full" style={{ width: `${agentStatus.cycleProgress}%`, background: 'linear-gradient(90deg, var(--color-info), var(--color-success))' }} />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs" style={{ color: 'var(--color-muted)' }}>
            <span>Next {agentStatus.nextCheckSeconds}s</span>
            <span>Verify {agentStatus.pendingVerification}</span>
            <span>{summary.activeInterventions} actions</span>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {[
            ['Pods', summary.pods],
            ['Faults', summary.activeFaults],
            ['Incidents', incidents.length],
            ['Resolved', summary.resolvedToday],
          ].map(([label, value]) => (
            <div key={label} className="rounded-md border p-3" style={{ borderColor: 'var(--color-border)', background: 'rgba(8, 13, 20, 0.58)' }}>
              <div className="text-[10px] uppercase" style={{ color: 'var(--color-muted)' }}>{label}</div>
              <div className="mt-2 text-xl font-semibold">{value}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function FilterBar({ filters, setFilters, options, total, onSimulateFault, simulationMessage }) {
  const update = (key, value) => setFilters((current) => ({ ...current, [key]: value }))
  return (
    <section className="app-panel rounded-md p-3">
      <div className="flex flex-wrap items-center gap-2">
        {[
          ['status', ['all', 'critical', 'warning', 'recovering', 'verifying', 'healthy']],
          ['crop', ['all', ...options.crops]],
          ['zone', ['all', ...options.zones]],
          ['reservoir', ['all', ...options.reservoirs]],
          ['severity', ['all', 'critical', 'warning', 'normal']],
        ].map(([key, values]) => (
          <select
            key={key}
            value={filters[key]}
            onChange={(event) => update(key, event.target.value)}
            className="min-h-9 rounded-md border px-2 text-xs capitalize"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
            aria-label={`Filter by ${key}`}
          >
            {values.map((value) => <option key={value} value={value}>{key}: {value}</option>)}
          </select>
        ))}

        <select
          value={filters.sort}
          onChange={(event) => update('sort', event.target.value)}
          className="min-h-9 rounded-md border px-2 text-xs"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
          aria-label="Sort pods"
        >
          {SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>Sort: {option.label}</option>)}
        </select>

        <span className="ml-auto text-xs" style={{ color: 'var(--color-muted)' }}>{total} visible</span>

        <select
          value={filters.fault}
          onChange={(event) => update('fault', event.target.value)}
          className="min-h-9 rounded-md border px-2 text-xs"
          style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
          aria-label="Fault type"
        >
          {FAULT_TYPES.map((fault) => <option key={fault.id} value={fault.id}>{fault.label}</option>)}
        </select>
        <button
          type="button"
          onClick={() => onSimulateFault(filters.fault)}
          className="min-h-9 rounded-md border px-3 text-xs font-semibold"
          style={{ borderColor: 'var(--color-critical)', background: 'rgba(255, 92, 122, 0.12)', color: 'var(--color-text)' }}
        >
          Simulate Fault
        </button>
        <span className="text-xs" style={{ color: 'var(--color-warning)' }}>{simulationMessage}</span>
      </div>
    </section>
  )
}

function MetricChip({ pod, metric }) {
  const state = metricState(pod[metric], metric)
  const color = state.state === 'ok' ? 'var(--color-success)' : state.state === 'critical' ? 'var(--color-critical)' : 'var(--color-warning)'
  return (
    <div className="min-w-0 rounded-md border px-2 py-1.5" style={{ borderColor: 'var(--color-border)', background: 'rgba(8, 13, 20, 0.55)' }}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px]" style={{ color: 'var(--color-muted)' }}>{TARGET_RANGES[metric]?.label || metric}</span>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      </div>
      <div className="mt-1 truncate font-mono text-xs font-semibold">{formatMetric(pod[metric], metric)}</div>
      <div className="mt-0.5 truncate text-[10px]" style={{ color }}>{state.text}</div>
    </div>
  )
}

function TrendBar({ state }) {
  const color = state === 'unstable' ? 'var(--color-critical)' : state === 'rising' || state === 'falling' ? 'var(--color-warning)' : 'var(--color-success)'
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-1.5 flex-1 rounded-full" style={{ background: color, opacity: state === 'falling' ? 0.45 : 1 }} />
      <span className="h-1.5 flex-1 rounded-full" style={{ background: color, opacity: state === 'stable' ? 0.8 : 1 }} />
      <span className="h-1.5 flex-1 rounded-full" style={{ background: color, opacity: state === 'rising' ? 1 : 0.45 }} />
    </div>
  )
}

function primaryDeviation(pod) {
  const priority = ['ph', 'ec_ppm', 'water_level', 'air_temp_c', 'humidity']
  const metric = priority.find((key) => metricState(pod[key], key).state !== 'ok') || 'ph'
  const state = metricState(pod[metric], metric)
  return { metric, state }
}

function PodCard({ pod, incident, active, onSelect }) {
  const accent = STATUS_COLORS[pod.status] || STATUS_COLORS.healthy
  const trend = trendState(pod, 'ph')
  const deviation = primaryDeviation(pod)
  return (
    <button
      type="button"
      onClick={() => onSelect?.(pod.id)}
      className={`pod-card min-w-0 rounded-md border p-3 text-left transition-all duration-200 ${active ? 'pod-card-active' : ''}`}
      style={{ borderColor: 'var(--color-border)', borderTopColor: accent, background: 'rgba(19, 28, 40, 0.82)' }}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <CropIcon crop={pod.crop} className="h-5 w-5" />
            <span className="truncate text-sm font-semibold">{pod.id}</span>
          </div>
          <div className="mt-1 truncate text-xs capitalize" style={{ color: 'var(--color-muted)' }}>{pod.crop} / {pod.zone}</div>
        </div>
        <span className={`status-pill status-${pod.status}`}>{pod.status}</span>
      </div>

      {incident && (
        <div className="mb-3 rounded-md border px-2 py-1.5 text-xs" style={{ borderColor: 'var(--color-info)', background: 'rgba(108, 195, 255, 0.1)', color: 'var(--color-info)' }}>
          Incident {incident.lifecycle.replaceAll('_', ' ')}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {['ph', 'ec_ppm', 'air_temp_c', 'humidity'].map((metric) => <MetricChip key={metric} pod={pod} metric={metric} />)}
      </div>

      <div className="mt-3 rounded-md border p-2" style={{ borderColor: 'var(--color-border)', background: 'rgba(7, 11, 17, 0.6)' }}>
        <div className="mb-1 flex items-center justify-between text-[10px] uppercase" style={{ color: 'var(--color-muted)' }}>
          <span>{TARGET_RANGES[deviation.metric]?.label} {deviation.state.text}</span>
          <span>{trend}</span>
        </div>
        <TrendBar state={trend} />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-xs" style={{ color: 'var(--color-muted)' }}>
        <span className="truncate">{pod.last_action || 'Stable'}</span>
        <span className="shrink-0">{pod.reservoir}</span>
      </div>
    </button>
  )
}

function sortPods(pods, sort) {
  const list = [...pods]
  if (sort === 'status') return list.sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9))
  if (sort === 'modified') return list.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
  return list.sort((a, b) => `${a[sort] || ''}`.localeCompare(`${b[sort] || ''}`))
}

function ActiveIncidentBanner({ incident, onIncidentSelect }) {
  if (!incident || incident.status !== 'active') return null
  return (
    <button
      type="button"
      onClick={() => onIncidentSelect?.(incident)}
      className="active-incident-banner rounded-md border p-3 text-left"
      style={{ borderColor: 'var(--color-info)', background: 'rgba(108, 195, 255, 0.1)' }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs uppercase" style={{ color: 'var(--color-info)' }}>Active Incident</div>
          <div className="mt-1 text-sm font-semibold">{incident.title}</div>
          <div className="mt-1 text-xs" style={{ color: 'var(--color-muted)' }}>{incident.podId} / {incident.zone} / {incident.reservoir}</div>
        </div>
        <span className={`status-pill status-${incident.lifecycle === 'verifying' ? 'verifying' : incident.severity}`}>{incident.lifecycle}</span>
      </div>
    </button>
  )
}

export default function PodGrid({ pods, summary, connectionStatus, onSelect, onSimulateFault, simulationMessage, policy, incidents = [], activeIncident, agentStatus, onIncidentSelect }) {
  const podList = useMemo(() => Object.values(pods), [pods])
  const [filters, setFilters] = useState({
    status: 'all',
    crop: 'all',
    zone: 'all',
    reservoir: 'all',
    severity: 'all',
    sort: 'status',
    fault: 'ph_drop',
  })
  const options = useMemo(() => ({
    crops: uniqueValues(podList, 'crop'),
    zones: uniqueValues(podList, 'zone'),
    reservoirs: uniqueValues(podList, 'reservoir'),
  }), [podList])
  const visible = useMemo(() => sortPods(podList.filter((pod) => (
    (filters.status === 'all' || pod.status === filters.status) &&
    (filters.crop === 'all' || pod.crop === filters.crop) &&
    (filters.zone === 'all' || pod.zone === filters.zone) &&
    (filters.reservoir === 'all' || pod.reservoir === filters.reservoir) &&
    (filters.severity === 'all' || pod.severity === filters.severity)
  )), filters.sort), [filters, podList])
  const incidentByPod = useMemo(() => incidents.reduce((acc, incident) => {
    if (incident.status === 'active') acc[incident.podId] = incident
    return acc
  }, {}), [incidents])

  return (
    <div className="flex h-full flex-col gap-4">
      <StatusHeader
        summary={summary}
        connectionStatus={connectionStatus}
        policy={policy}
        pods={podList}
        incidents={incidents}
        activeIncident={activeIncident}
        agentStatus={agentStatus}
      />
      <ActiveIncidentBanner incident={activeIncident} onIncidentSelect={onIncidentSelect} />
      <FilterBar
        filters={filters}
        setFilters={setFilters}
        options={options}
        total={visible.length}
        onSimulateFault={onSimulateFault}
        simulationMessage={simulationMessage}
      />

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          <div className="md:col-span-2">
            <PhysicalPot pods={pods} />
          </div>
          {visible.map((pod) => (
            <PodCard
              key={pod.id}
              pod={pod}
              incident={incidentByPod[pod.id]}
              active={activeIncident?.podId === pod.id}
              onSelect={onSelect}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
