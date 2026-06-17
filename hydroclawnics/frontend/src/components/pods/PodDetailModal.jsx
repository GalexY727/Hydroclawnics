import { useEffect, useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import CropIcon from '../CropIcon'
import PlantPreview from '../farm/PlantPreview'
import { FAULT_TYPES, TARGET_RANGES } from '../../data/operations'

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

const TREND_ZONE_COLORS = {
  stable: '#58d68d',
  warning: '#f5b85b',
  critical: '#ff5c7a',
}

const TREND_CHART_HEIGHT = 168
const TREND_CHART_MARGIN = { top: 8, right: 14, bottom: 18, left: 0 }
const TREND_ZONE_BLEND_PCT = 0.42

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

function secondsAgoLabel(seconds) {
  const safeSeconds = Math.max(0, Math.round(Number(seconds) || 0))
  return `${safeSeconds} seconds ago`
}

function timeToken(seconds) {
  const safeSeconds = Math.max(0, Math.round(Number(seconds) || 0))
  return `t-${safeSeconds}s`
}

function secondsAgo(timestamp, fallbackSeconds) {
  const date = timestamp ? new Date(timestamp) : null
  if (!date || Number.isNaN(date.getTime())) return fallbackSeconds
  return Math.max(0, Math.round((Date.now() - date.getTime()) / 1000))
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

function yOffsetInScale(value, scale) {
  if (!Number.isFinite(value) || scale.max === scale.min) return 50
  return clamp(((scale.max - value) / (scale.max - scale.min)) * 100)
}

function zoneColorForValue(value, scale) {
  if (!Number.isFinite(value) || !scale) return TREND_ZONE_COLORS.stable
  if (value < scale.criticalLow || value > scale.criticalHigh) return TREND_ZONE_COLORS.critical
  if (value < scale.healthyMin || value > scale.healthyMax) return TREND_ZONE_COLORS.warning
  return TREND_ZONE_COLORS.stable
}

function trendGradientStops(scale) {
  if (!scale || !Number.isFinite(scale.min) || !Number.isFinite(scale.max) || scale.max === scale.min) return []

  const stops = [
    { offset: 0, color: zoneColorForValue(scale.max, scale) },
    { offset: 100, color: zoneColorForValue(scale.min, scale) },
  ]
  const boundaries = [
    { value: scale.criticalHigh, highColor: TREND_ZONE_COLORS.critical, lowColor: TREND_ZONE_COLORS.warning },
    { value: scale.healthyMax, highColor: TREND_ZONE_COLORS.warning, lowColor: TREND_ZONE_COLORS.stable },
    { value: scale.healthyMin, highColor: TREND_ZONE_COLORS.stable, lowColor: TREND_ZONE_COLORS.warning },
    { value: scale.criticalLow, highColor: TREND_ZONE_COLORS.warning, lowColor: TREND_ZONE_COLORS.critical },
  ]

  boundaries.forEach(({ value, highColor, lowColor }) => {
    const offset = yOffsetInScale(value, scale)
    if (offset <= 0 || offset >= 100) return
    stops.push(
      { offset: clamp(offset - TREND_ZONE_BLEND_PCT), color: highColor },
      { offset: clamp(offset), color: highColor },
      { offset: clamp(offset), color: lowColor },
      { offset: clamp(offset + TREND_ZONE_BLEND_PCT), color: lowColor },
    )
  })

  return stops.sort((a, b) => a.offset - b.offset)
}

function safeIdToken(value) {
  return `${value ?? 'metric'}`.replace(/[^a-zA-Z0-9_-]/g, '-')
}

function trendReferenceLines(scale) {
  if (!scale) return []
  return [
    { key: 'min', y: scale.healthyMin, color: TREND_ZONE_COLORS.warning },
    { key: 'max', y: scale.healthyMax, color: TREND_ZONE_COLORS.warning },
    { key: 'critical-min', y: scale.criticalLow, color: TREND_ZONE_COLORS.critical },
    { key: 'critical-max', y: scale.criticalHigh, color: TREND_ZONE_COLORS.critical },
  ].filter(({ y }) => Number.isFinite(y) && y >= scale.min && y <= scale.max)
}

function markerLabel(label, value, metric, range) {
  return `${label}: ${formatMetricValue(value, metric, range)}`
}

function agentEntryPodId(entry) {
  const matchingAction = entry?.actions_taken?.find((action) => action?.pod_id || action?.params?.pod_id)
  return entry?.pod_id || entry?.podId || entry?.table_id || entry?.params?.pod_id || matchingAction?.pod_id || matchingAction?.params?.pod_id || ''
}

function agentEntryTime(entry) {
  return entry?.timestamp || entry?.ts || entry?.actions_taken?.[0]?.ts || null
}

function podAgentText(entry) {
  if (!entry) return ''
  return entry.reasoning || entry.diagnosis || entry.raw_reasoning || entry.reason || entry.summary_text || ''
}

function actionLabel(value) {
  if (!value) return ''
  return `${value}`.replaceAll('_', ' ')
}

function buildTelemetryAssessment(pod) {
  const metric = issueMetric(pod)
  const range = rangeForPod(pod, metric)
  const state = metricStateForPod(pod, metric)
  const value = formatMetricValue(pod?.[metric], metric, range)
  const target = range ? `${formatMetricValue(range.min, metric, range)}-${formatMetricValue(range.max, metric, range)}` : 'not configured'
  const stable = state.state === 'ok' && ['healthy', 'resolved', 'stable'].includes(pod?.status || pod?.lifecycle || 'healthy')

  if (stable) {
    return {
      severity: 'normal',
      summary: `${metricLabel(metric)} is in target at ${value}. No intervention is queued for this pod.`,
      evidence: `Current ${metricLabel(metric)} ${value}; target ${target}.`,
      action: pod?.last_action && pod.last_action !== 'Stable scan' ? pod.last_action : 'Continue routine scan',
      result: 'Telemetry is inside the configured target window.',
    }
  }

  return {
    severity: state.state === 'critical' || pod?.status === 'critical' ? 'critical' : 'warning',
    summary: `${metricLabel(metric)} needs attention: ${value} against target ${target}.`,
    evidence: `${metricLabel(metric)} ${state.text}; current ${value}; target ${target}.`,
    action: pod?.last_action && pod.last_action !== 'Stable scan' ? pod.last_action : 'Verify sensor trend and prepare corrective action',
    result: pod?.lifecycle ? `Lifecycle is ${pod.lifecycle.replaceAll('_', ' ')}.` : 'Awaiting verification.',
  }
}

function buildAgentAssessment(pod, latestEvent, podAgentEntry) {
  const telemetry = buildTelemetryAssessment(pod)
  const fault = FAULT_TYPES.find((item) => item.id === pod?.fault_type)
  const liveAction = actionLabel(podAgentEntry?.action || podAgentEntry?.tool || podAgentEntry?.actions_taken?.find((action) => action?.tool && action.tool !== 'no_op')?.tool)
  const liveText = podAgentText(podAgentEntry)
  const liveStatus = podAgentEntry?.status

  if (podAgentEntry) {
    return {
      severity: liveStatus === 'critical' ? 'critical' : liveStatus === 'warning' ? 'warning' : telemetry.severity,
      timestamp: agentEntryTime(podAgentEntry),
      source: 'live decision',
      summary: liveText || telemetry.summary,
      evidence: podAgentEntry.diagnosis || telemetry.evidence,
      action: liveAction || latestEvent?.action || fault?.action || telemetry.action,
      result: podAgentEntry.result || latestEvent?.result || telemetry.result,
    }
  }

  if (latestEvent) {
    return {
      severity: latestEvent.severity || telemetry.severity,
      timestamp: latestEvent.timestamp,
      source: latestEvent.lifecycle?.replaceAll('_', ' ') || 'event',
      summary: latestEvent.diagnosis || latestEvent.issue || telemetry.summary,
      evidence: latestEvent.evidence || telemetry.evidence,
      action: latestEvent.action || fault?.action || telemetry.action,
      result: latestEvent.result || telemetry.result,
    }
  }

  return {
    ...telemetry,
    timestamp: pod?.timestamp,
    source: 'current telemetry',
  }
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
    <section className="detail-panel detail-telemetry-panel">
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

function TrendChart({ data, metric, pod }) {
  const range = rangeForPod(pod, metric)
  const config = METRICS.find((item) => item.key === metric) || METRICS[0]
  const dataValues = data.map((reading) => Number(reading[metric])).filter(Number.isFinite)
  const baseScale = range ? metricScale(pod, metric) : null
  const scale = baseScale && Number.isFinite(baseScale.min) && Number.isFinite(baseScale.max)
    ? {
        ...baseScale,
        min: Math.min(baseScale.min, ...dataValues),
        max: Math.max(baseScale.max, ...dataValues),
      }
    : null
  const gradientId = `detail-trend-gradient-${safeIdToken(pod?.id)}-${safeIdToken(metric)}`
  const gradientStops = trendGradientStops(scale)
  const referenceLines = trendReferenceLines(scale)
  const stroke = gradientStops.length ? `url(#${gradientId})` : config.color

  return (
    <section className="detail-panel">
      <div className="detail-section-heading">
        <h3>{metricLabel(metric)} Trend</h3>
        <span>{data.length} recent samples</span>
      </div>
      <div className="detail-trend-chart overflow-hidden">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={TREND_CHART_MARGIN}>
            {gradientStops.length > 0 && (
              <defs>
                <linearGradient
                  id={gradientId}
                  x1="0"
                  y1={TREND_CHART_MARGIN.top}
                  x2="0"
                  y2={TREND_CHART_HEIGHT - TREND_CHART_MARGIN.bottom}
                  gradientUnits="userSpaceOnUse"
                >
                  {gradientStops.map((stop, index) => (
                    <stop key={`${stop.offset}-${index}`} offset={`${stop.offset}%`} stopColor={stop.color} />
                  ))}
                </linearGradient>
              </defs>
            )}
            <CartesianGrid stroke="rgba(148, 163, 184, 0.1)" vertical={false} />
            <XAxis
              dataKey="timeToken"
              minTickGap={18}
              tick={{ fill: 'var(--color-muted)', fontSize: 9 }}
              tickLine={true}
              axisLine={true}
            />
            <YAxis
              width={48}
              tick={{ fill: 'var(--color-muted)', fontSize: 10 }}
              tickFormatter={(value) => compactNumber(value)}
              domain={scale ? [scale.min, scale.max] : undefined}
              axisLine={true}
              tickLine={true}
            />
            {referenceLines.map(({ key, y, color }) => (
              <ReferenceLine
                key={key}
                y={y}
                stroke={color}
                strokeDasharray="3 5"
                strokeOpacity={0.42}
                strokeWidth={1}
                ifOverflow="extendDomain"
              />
            ))}
            <Tooltip
              formatter={(value, _name) => [formatMetricValue(value, metric, range), _name]}
              labelFormatter={(_value, items) => items?.[0]?.payload?.timeAgoLabel || ''}
              contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text)' }}
            />
            <Line type="monotone" dataKey={metric} stroke={stroke} dot={false} strokeWidth={2.4} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

function AgentAssessment({ pod, latestEvent, podAgentEntry }) {
  const assessment = buildAgentAssessment(pod, latestEvent, podAgentEntry)
  return (
    <section className="detail-panel">
      <div className="detail-section-heading">
        <h3>Agent Assessment</h3>
        <span>{assessment.timestamp ? timeLabel(assessment.timestamp) : assessment.source}</span>
      </div>
      <div className="grid gap-2 text-sm leading-6" style={{ color: 'var(--color-muted)' }}>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`severity-chip severity-${assessment.severity}`}>{assessment.source}</span>
          <p className="min-w-0 flex-1">{assessment.summary}</p>
        </div>
        <p><strong style={{ color: 'var(--color-text)' }}>Evidence:</strong> {assessment.evidence}</p>
        <p><strong style={{ color: 'var(--color-text)' }}>Action:</strong> {assessment.action}</p>
        <p><strong style={{ color: 'var(--color-text)' }}>Result:</strong> {assessment.result}</p>
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

  const chartData = useMemo(() => {
    const readings = pod?.history || []
    return readings.map((reading, index) => {
      const fallbackSeconds = (readings.length - index - 1) * 240
      const ageSeconds = secondsAgo(reading.timestamp, fallbackSeconds)
      return {
        ...reading,
        index,
        secondsAgo: ageSeconds,
        timeAgoLabel: secondsAgoLabel(ageSeconds),
        timeToken: timeToken(ageSeconds),
      }
    })
  }, [pod])
  const podId = pod?.id
  const podAgentEntry = useMemo(() => {
    if (!podId) return null
    return agentLog.find((entry) => agentEntryPodId(entry) === podId) || null
  }, [agentLog, podId])
  const latestEvent = useMemo(() => events.find((event) => event.podId === podId), [events, podId])

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
          <div className="grid items-start gap-4 xl:grid-cols-[1.25fr_0.75fr]">
            <div className="grid content-start gap-4">
              <TelemetryTable pod={pod} selectedMetric={selectedMetric} onMetricSelect={setSelectedMetric} />
              <TrendChart data={chartData} metric={selectedMetric} pod={pod} />
              <AgentAssessment pod={pod} latestEvent={latestEvent} podAgentEntry={podAgentEntry} />
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
              <ManualControls pod={pod} onManualAction={onManualAction} />
            </aside>
          </div>
        </div>
      </section>
    </div>
  )
}
