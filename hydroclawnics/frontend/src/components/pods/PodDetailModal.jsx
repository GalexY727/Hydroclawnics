import { useEffect, useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import CropIcon from '../CropIcon'
import PlantPreview from '../farm/PlantPreview'
import { FAULT_TYPES, LIFECYCLE_STEPS, TARGET_RANGES } from '../../data/operations'

const ACTIONS = [
  { id: 'dose_acid', label: 'Dose acid', risk: 'Requires pH high confirmation' },
  { id: 'dose_base', label: 'Dose base', risk: 'Requires pH low confirmation' },
  { id: 'flush_reservoir', label: 'Flush reservoir', risk: 'Supervisor approval required' },
  { id: 'pause_pump', label: 'Pause pump', risk: 'Critical action' },
  { id: 'resume_pump', label: 'Resume pump', risk: 'Verify line pressure first' },
  { id: 'recalibrate_sensor', label: 'Recalibrate sensor', risk: 'Locks reading for 90 sec' },
]

const METRICS = [
  { key: 'ph', color: 'var(--color-success)' },
  { key: 'ec_ppm', color: 'var(--color-warning)' },
  { key: 'water_temp_c', color: 'var(--color-info)' },
  { key: 'air_temp_c', color: '#79d2ff' },
  { key: 'humidity', color: '#8be9d4' },
  { key: 'water_level', color: '#78d7ff' },
  { key: 'light_lux', color: '#f5d66b' },
]

function normalize(value) {
  return `${value ?? ''}`.trim().toLowerCase()
}

function compactNumber(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return '--'
  if (numeric === 0) return '0'
  if (Number.isInteger(numeric)) return `${numeric}`
  return `${Number(numeric.toFixed(2))}`
}

function timeLabel(timestamp) {
  const date = timestamp ? new Date(timestamp) : new Date()
  if (Number.isNaN(date.getTime())) return '--:--'
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function metricLabel(metric) {
  return TARGET_RANGES[metric]?.label || metric?.replaceAll('_', ' ') || 'Metric'
}

function rangeForPod(pod, metric) {
  const cropKey = normalize(pod?.crop)
  const podRanges = pod?.target_ranges || pod?.targetRanges || pod?.ranges || {}
  const cropRanges = pod?.crop_target_ranges || pod?.cropTargetRanges || {}
  return podRanges[metric] || cropRanges[cropKey]?.[metric] || TARGET_RANGES[metric] || null
}

function formatMetricValue(value, metric, range = TARGET_RANGES[metric]) {
  const unit = range?.unit ?? ''
  const formatted = compactNumber(value)
  return formatted === '--' ? formatted : `${formatted}${unit}`
}

function metricStateForPod(pod, metric) {
  const range = rangeForPod(pod, metric)
  const numeric = Number(pod?.[metric])
  if (!range || !Number.isFinite(numeric)) return { state: 'neutral', delta: 0, text: 'No target' }
  const inRange = numeric >= range.min && numeric <= range.max
  const delta = numeric < range.min ? numeric - range.min : numeric > range.max ? numeric - range.max : 0
  return {
    state: inRange ? 'ok' : Math.abs(delta) > (range.max - range.min) * 0.45 ? 'critical' : 'warning',
    delta,
    text: inRange ? `${formatMetricValue(range.min, metric, range)}-${formatMetricValue(range.max, metric, range)}` : `${delta > 0 ? '+' : ''}${formatMetricValue(delta, metric, range)}`,
  }
}

function issueMetric(pod) {
  const fault = FAULT_TYPES.find((item) => item.id === pod?.fault_type)
  if (fault?.metric) return fault.metric
  return METRICS.find(({ key }) => metricStateForPod(pod, key).state !== 'ok')?.key || 'ph'
}

function issueText(pod) {
  if (!pod || pod.status === 'healthy') return 'Telemetry inside target range'
  const fault = FAULT_TYPES.find((item) => item.id === pod.fault_type)
  if (fault) return fault.label
  const metric = issueMetric(pod)
  const state = metricStateForPod(pod, metric)
  return `${metricLabel(metric)} ${state.text}`
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value))
}

function recentMetricRange(pod, metric) {
  const values = (pod?.history || [])
    .slice(-10)
    .map((reading) => Number(reading[metric]))
    .filter(Number.isFinite)
  const current = Number(pod?.[metric])
  if (Number.isFinite(current)) values.push(current)
  if (!values.length) return null
  values.sort((a, b) => a - b)
  return {
    low: values[Math.floor((values.length - 1) * 0.2)],
    high: values[Math.ceil((values.length - 1) * 0.8)],
  }
}

function metricScale(pod, metric) {
  const range = rangeForPod(pod, metric)
  const current = Number(pod?.[metric])
  const recent = recentMetricRange(pod, metric)
  if (range) {
    const width = range.max - range.min
    return {
      min: range.scaleMin,
      max: range.scaleMax,
      healthyMin: range.min,
      healthyMax: range.max,
      warningLow: range.min,
      warningHigh: range.max,
      criticalLow: range.min - width * 0.45,
      criticalHigh: range.max + width * 0.45,
      current,
      recent,
    }
  }
  const safeCurrent = Number.isFinite(current) ? current : 0
  const spread = Math.max(Math.abs(safeCurrent) * 0.4, 1)
  return { min: safeCurrent - spread, max: safeCurrent + spread, current, recent }
}

function positionInScale(value, scale) {
  if (!Number.isFinite(value) || scale.max === scale.min) return 50
  return clamp(((value - scale.min) / (scale.max - scale.min)) * 100)
}

function markerLabel(label, value, metric, range) {
  return `${label}: ${formatMetricValue(value, metric, range)}`
}

function MiniRange({ pod, metric, emphasized }) {
  const range = rangeForPod(pod, metric)
  const scale = metricScale(pod, metric)
  const state = metricStateForPod(pod, metric)
  const currentPosition = positionInScale(scale.current, scale)
  const healthyLeft = range ? positionInScale(scale.healthyMin, scale) : null
  const healthyRight = range ? positionInScale(scale.healthyMax, scale) : null
  const recentLeft = scale.recent ? positionInScale(scale.recent.low, scale) : currentPosition
  const recentRight = scale.recent ? positionInScale(scale.recent.high, scale) : currentPosition
  const markerClass = state.state === 'critical' ? 'metric-current metric-current-critical' : state.state === 'warning' ? 'metric-current metric-current-warning' : 'metric-current'

  return (
    <div className={`metric-range-track detail-mini-range ${emphasized ? 'detail-mini-range-focus' : ''}`} aria-hidden="true">
      {range && <span className="metric-healthy-window" style={{ left: `${healthyLeft}%`, width: `${Math.max(2, healthyRight - healthyLeft)}%` }} />}
      {scale.recent && <span className="metric-recent-range" style={{ left: `${Math.min(recentLeft, recentRight)}%`, width: `${Math.max(3, Math.abs(recentRight - recentLeft))}%` }} />}
      {range && (
        <>
          <span className="metric-threshold metric-warning-marker" data-label={markerLabel('Warn low', scale.warningLow, metric, range)} style={{ left: `${positionInScale(scale.warningLow, scale)}%` }} />
          <span className="metric-threshold metric-warning-marker" data-label={markerLabel('Warn high', scale.warningHigh, metric, range)} style={{ left: `${positionInScale(scale.warningHigh, scale)}%` }} />
          <span className="metric-threshold metric-critical-marker" data-label={markerLabel('Crit low', scale.criticalLow, metric, range)} style={{ left: `${positionInScale(scale.criticalLow, scale)}%` }} />
          <span className="metric-threshold metric-critical-marker" data-label={markerLabel('Crit high', scale.criticalHigh, metric, range)} style={{ left: `${positionInScale(scale.criticalHigh, scale)}%` }} />
        </>
      )}
      <span className={markerClass} data-label={markerLabel('Current', scale.current, metric, range)} style={{ left: `${currentPosition}%` }} />
    </div>
  )
}

function TelemetryTable({ pod, selectedMetric, onMetricSelect }) {
  return (
    <section className="detail-panel">
      <div className="detail-section-heading">
        <h3>Telemetry</h3>
        <span>Current, target, recent range</span>
      </div>
      <div className="detail-telemetry-table">
        {METRICS.map(({ key }) => {
          const range = rangeForPod(pod, key)
          const state = metricStateForPod(pod, key)
          const recent = recentMetricRange(pod, key)
          const active = key === selectedMetric
          return (
            <button key={key} type="button" className={`detail-metric-row ${active ? 'detail-metric-row-active' : ''}`} onClick={() => onMetricSelect(key)}>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`detail-state-dot detail-state-${state.state}`} />
                  <span className="truncate text-sm font-semibold">{metricLabel(key)}</span>
                </div>
                <div className="mt-0.5 truncate text-[11px]" style={{ color: 'var(--color-muted)' }}>
                  Target {range ? `${formatMetricValue(range.min, key, range)}-${formatMetricValue(range.max, key, range)}` : 'not configured'}
                </div>
              </div>
              <div className="font-mono text-sm font-semibold">{formatMetricValue(pod[key], key, range)}</div>
              <MiniRange pod={pod} metric={key} emphasized={state.state !== 'ok'} />
              <div className="truncate text-right text-[11px]" style={{ color: 'var(--color-muted)' }}>
                {recent ? `${formatMetricValue(recent.low, key, range)}-${formatMetricValue(recent.high, key, range)}` : '--'}
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function TrendChart({ data, metric }) {
  const range = TARGET_RANGES[metric]
  const config = METRICS.find((item) => item.key === metric) || METRICS[0]
  return (
    <section className="detail-panel">
      <div className="detail-section-heading">
        <h3>{metricLabel(metric)} Trend</h3>
        <span>{data.length} recent samples</span>
      </div>
      <div className="h-56 overflow-hidden">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 12, right: 14, bottom: 10, left: 0 }}>
            <CartesianGrid stroke="rgba(148, 163, 184, 0.1)" vertical={false} />
            <XAxis dataKey="index" hide />
            <YAxis
              width={48}
              tick={{ fill: 'var(--color-muted)', fontSize: 10 }}
              tickFormatter={(value) => compactNumber(value)}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value) => [formatMetricValue(value, metric, range), metricLabel(metric)]}
              labelFormatter={(value) => `Sample ${value}`}
              contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text)' }}
            />
            <Line type="monotone" dataKey={metric} stroke={config.color} dot={false} strokeWidth={2.2} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

function AgentAssessment({ pod, latestEvent, podAgentEntries }) {
  const fault = FAULT_TYPES.find((item) => item.id === pod.fault_type)
  const stable = !latestEvent && !fault
  return (
    <section className="detail-panel">
      <div className="detail-section-heading">
        <h3>Agent Assessment</h3>
        <span>{latestEvent ? timeLabel(latestEvent.timestamp) : 'latest state'}</span>
      </div>
      {stable ? (
        <p className="text-sm leading-6" style={{ color: 'var(--color-muted)' }}>
          {podAgentEntries[0]?.reasoning || 'The pod is stable. The agent is watching for trend deviation before recommending changes.'}
        </p>
      ) : (
        <div className="grid gap-2 text-sm leading-6" style={{ color: 'var(--color-muted)' }}>
          <p><strong style={{ color: 'var(--color-text)' }}>Evidence:</strong> {latestEvent?.evidence || `${metricLabel(issueMetric(pod))} outside target`}</p>
          <p><strong style={{ color: 'var(--color-text)' }}>Action:</strong> {latestEvent?.action || fault?.action || pod.last_action || 'Observe'}</p>
          <p><strong style={{ color: 'var(--color-text)' }}>Result:</strong> {latestEvent?.result || 'Awaiting verification'}</p>
        </div>
      )}
    </section>
  )
}

function Lifecycle({ pod, podEvents }) {
  const activeIndex = Math.max(0, LIFECYCLE_STEPS.indexOf(pod.lifecycle))
  return (
    <section className="detail-panel">
      <div className="detail-section-heading">
        <h3>Timeline</h3>
        <span className="capitalize">{pod.lifecycle?.replaceAll('_', ' ') || 'stable'}</span>
      </div>
      <div className="mt-3 grid gap-2">
        {LIFECYCLE_STEPS.map((step, index) => {
          const done = pod.lifecycle === 'resolved' || index <= activeIndex
          const event = podEvents.find((item) => item.lifecycle === step)
          return (
            <div key={step} className="grid grid-cols-[16px_1fr_auto] items-start gap-2">
              <span className="mt-1.5 h-2.5 w-2.5 rounded-full border" style={{ borderColor: done ? 'var(--color-info)' : 'var(--color-border)', background: done ? 'var(--color-info)' : 'transparent' }} />
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold capitalize">{step.replaceAll('_', ' ')}</div>
                <div className="truncate text-[11px]" style={{ color: 'var(--color-muted)' }}>{event?.result || (done ? 'Completed' : 'Pending')}</div>
              </div>
              <span className="text-[10px]" style={{ color: 'var(--color-muted)' }}>{event ? timeLabel(event.timestamp) : ''}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function ManualControls({ pod, onManualAction }) {
  const [pending, setPending] = useState(null)
  return (
    <section className="detail-panel">
      <div className="detail-section-heading">
        <h3>Manual Override</h3>
        <span>supervised</span>
      </div>
      <div className="mt-3 grid gap-2">
        {ACTIONS.map((action) => {
          const highRisk = ['flush_reservoir', 'pause_pump'].includes(action.id)
          const disabled = highRisk && pending !== action.id
          return (
            <button
              key={action.id}
              type="button"
              onClick={() => {
                if (disabled) {
                  setPending(action.id)
                  return
                }
                onManualAction?.(`${action.label} requested for ${pod.id}`)
                setPending(null)
              }}
              className="detail-action-button"
              style={{ borderColor: pending === action.id ? 'var(--color-warning)' : 'var(--color-border)' }}
            >
              <span>{pending === action.id ? `Confirm ${action.label}` : action.label}</span>
              <small>{action.risk}</small>
            </button>
          )
        })}
      </div>
    </section>
  )
}

export default function PodDetailModal({ pod, events = [], agentLog = [], onManualAction, onClose }) {
  const defaultMetric = useMemo(() => issueMetric(pod), [pod])
  const [selectedMetric, setSelectedMetric] = useState(defaultMetric)

  useEffect(() => {
    setSelectedMetric(defaultMetric)
  }, [defaultMetric, pod?.id])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const chartData = useMemo(() => (pod?.history || []).map((reading, index) => ({ ...reading, index })), [pod])
  const podEvents = useMemo(() => events.filter((event) => event.podId === pod?.id), [events, pod?.id])
  const podAgentEntries = useMemo(() => agentLog.filter((entry) => entry.pod_id === pod?.id), [agentLog, pod?.id])
  const latestEvent = podEvents[0]

  if (!pod) return null

  const ageDays = Math.max(1, Math.round(Number(pod.age_hours || 0) / 24))
  const statusText = pod.status || 'healthy'
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-3 md:p-5" style={{ background: 'var(--color-overlay)' }} onMouseDown={onClose}>
      <section
        className="modal-enter flex max-h-[94vh] w-[96vw] max-w-[1180px] flex-col overflow-hidden rounded-md border"
        style={{ borderColor: 'var(--color-border-strong)', background: 'var(--color-panel)' }}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pod-detail-title"
      >
        <header className="detail-modal-header">
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <CropIcon crop={pod.crop} className="h-6 w-6" />
              <h2 id="pod-detail-title" className="truncate text-xl font-semibold">{pod.id}</h2>
              <span className={`status-pill status-${statusText}`}>{statusText}</span>
              <span className="detail-issue-chip">{issueText(pod)}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm" style={{ color: 'var(--color-muted)' }}>
              <span>{pod.crop}</span>
              <span>{pod.zone}</span>
              <span>{pod.reservoir}</span>
              <span>{pod.growth_stage}</span>
              <span>{ageDays} days</span>
              <span>{formatMetricValue(pod.plant_height_cm, 'plant_height_cm', { unit: ' cm' })}</span>
              <span>Updated {timeLabel(pod.timestamp)}</span>
            </div>
          </div>
          <button type="button" className="grid h-9 w-9 shrink-0 place-items-center rounded-md transition-colors hover:bg-[color:var(--color-hover)]" onClick={onClose} aria-label="Close pod detail">
            X
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
            <div className="grid gap-4">
              <TelemetryTable pod={pod} selectedMetric={selectedMetric} onMetricSelect={setSelectedMetric} />
              <TrendChart data={chartData} metric={selectedMetric} />
              <AgentAssessment pod={pod} latestEvent={latestEvent} podAgentEntries={podAgentEntries} />
            </div>

            <aside className="grid content-start gap-4">
              <section className="detail-panel">
                <div className="detail-section-heading">
                  <h3>Pod Context</h3>
                  <span>support systems</span>
                </div>
                <PlantPreview pod={pod} className="h-52 w-full" />
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs" style={{ color: 'var(--color-muted)' }}>
                  <span>Pump: {pod.pump_status ? 'on' : 'off'}</span>
                  <span>Flow: {formatMetricValue(pod.flow_rate, 'flow_rate', { unit: ' L/m' })}</span>
                  <span>DO: {formatMetricValue(pod.do_mg_l, 'do_mg_l', { unit: ' mg/L' })}</span>
                </div>
              </section>
              <Lifecycle pod={pod} podEvents={podEvents} />
              <ManualControls pod={pod} onManualAction={onManualAction} />
            </aside>
          </div>
        </div>
      </section>
    </div>
  )
}
