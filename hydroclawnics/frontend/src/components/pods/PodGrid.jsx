import { useMemo, useState } from 'react'
import { Sparklines, SparklinesLine } from 'react-sparklines'
import CropIcon from '../CropIcon'
import PhysicalPot from './PhysicalPot'
import { FAULT_TYPES, STATUS_ORDER, TARGET_RANGES, formatMetric, metricState } from '../../data/operations'

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

function StatusHeader({ summary, connectionStatus, policy }) {
  const lastSync = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return (
    <section className="grid gap-3 lg:grid-cols-[1.2fr_repeat(4,0.7fr)]">
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
        <div className="mt-4 grid grid-cols-3 gap-2 text-xs" style={{ color: 'var(--color-muted)' }}>
          <span>Mode: <strong style={{ color: 'var(--color-text)' }}>{policy.mode}</strong></span>
          <span>Connection: <strong style={{ color: 'var(--color-text)' }}>{connectionStatus}</strong></span>
          <span>Last sync: <strong style={{ color: 'var(--color-text)' }}>{lastSync}</strong></span>
        </div>
      </div>

      {[
        ['Pods', summary.pods],
        ['Active faults', summary.activeFaults],
        ['Interventions', summary.activeInterventions],
        ['Resolved today', summary.resolvedToday],
      ].map(([label, value]) => (
        <div key={label} className="app-panel rounded-md p-4">
          <div className="text-xs uppercase" style={{ color: 'var(--color-muted)' }}>{label}</div>
          <div className="mt-3 text-3xl font-semibold">{value}</div>
        </div>
      ))}
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

function Trend({ pod }) {
  const values = (pod.history || []).map((reading) => Number(reading.ph || pod.ph || 0))
  const stroke = STATUS_COLORS[pod.status] || 'var(--color-success)'
  return (
    <div className="h-9">
      <Sparklines data={values.length > 1 ? values : [Number(pod.ph || 0), Number(pod.ph || 0)]} margin={3}>
        <SparklinesLine color={stroke} style={{ strokeWidth: 2, fill: 'none' }} />
      </Sparklines>
    </div>
  )
}

function PodCard({ pod, onSelect }) {
  const accent = STATUS_COLORS[pod.status] || STATUS_COLORS.healthy
  return (
    <button
      type="button"
      onClick={() => onSelect?.(pod.id)}
      className="pod-card min-w-0 rounded-md border p-3 text-left transition-all duration-200"
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

      <div className="grid grid-cols-2 gap-2">
        {['ph', 'ec_ppm', 'air_temp_c', 'humidity'].map((metric) => <MetricChip key={metric} pod={pod} metric={metric} />)}
      </div>

      <div className="mt-3 rounded-md border p-2" style={{ borderColor: 'var(--color-border)', background: 'rgba(7, 11, 17, 0.6)' }}>
        <div className="mb-1 flex items-center justify-between text-[10px] uppercase" style={{ color: 'var(--color-muted)' }}>
          <span>pH trend</span>
          <span>{pod.lifecycle || 'stable'}</span>
        </div>
        <Trend pod={pod} />
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

export default function PodGrid({ pods, summary, connectionStatus, onSelect, onSimulateFault, simulationMessage, policy }) {
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

  return (
    <div className="flex h-full flex-col gap-4">
      <StatusHeader summary={summary} connectionStatus={connectionStatus} policy={policy} />
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
          {visible.map((pod) => <PodCard key={pod.id} pod={pod} onSelect={onSelect} />)}
        </div>
      </div>
    </div>
  )
}
