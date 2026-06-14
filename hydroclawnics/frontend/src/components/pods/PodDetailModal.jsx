import { useEffect, useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import CropIcon from '../CropIcon'
import PlantPreview from '../farm/PlantPreview'
import { LIFECYCLE_STEPS, TARGET_RANGES, formatMetric, metricState } from '../../data/operations'

const ACTIONS = [
  { id: 'dose_acid', label: 'Dose acid', risk: 'Requires pH high confirmation' },
  { id: 'dose_base', label: 'Dose base', risk: 'Requires pH low confirmation' },
  { id: 'flush_reservoir', label: 'Flush reservoir', risk: 'Supervisor approval required' },
  { id: 'pause_pump', label: 'Pause pump', risk: 'Critical action' },
  { id: 'resume_pump', label: 'Resume pump', risk: 'Verify line pressure first' },
  { id: 'recalibrate_sensor', label: 'Recalibrate sensor', risk: 'Locks reading for 90 sec' },
]

function timeLabel(timestamp) {
  const date = timestamp ? new Date(timestamp) : new Date()
  if (Number.isNaN(date.getTime())) return '--:--'
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function MetricPanel({ pod, metric }) {
  const range = TARGET_RANGES[metric]
  const state = metricState(pod[metric], metric)
  const color = state.state === 'ok' ? 'var(--color-success)' : state.state === 'critical' ? 'var(--color-critical)' : 'var(--color-warning)'
  const numeric = Number(pod[metric])
  const percent = range && Number.isFinite(numeric)
    ? Math.max(0, Math.min(100, ((numeric - range.scaleMin) / (range.scaleMax - range.scaleMin)) * 100))
    : 0

  return (
    <div className="rounded-md border p-3" style={{ borderColor: 'var(--color-border)', background: 'rgba(8, 13, 20, 0.64)' }}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs" style={{ color: 'var(--color-muted)' }}>{range?.label || metric}</span>
        <span className="text-[10px]" style={{ color }}>{state.text}</span>
      </div>
      <div className="mt-2 font-mono text-xl font-semibold">{formatMetric(pod[metric], metric)}</div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--color-surface-2)' }}>
        <div className="h-full rounded-full" style={{ width: `${percent}%`, background: color }} />
      </div>
    </div>
  )
}

function TrendChart({ title, data, dataKey, stroke, unit }) {
  return (
    <div className="rounded-md border p-3" style={{ borderColor: 'var(--color-border)', background: 'rgba(8, 13, 20, 0.58)' }}>
      <div className="mb-2 text-xs font-semibold">{title}</div>
      <div className="h-32 overflow-hidden">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 10, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="rgba(148, 163, 184, 0.1)" vertical={false} />
            <XAxis dataKey="index" hide />
            <YAxis
              width={42}
              tick={{ fill: 'var(--color-muted)', fontSize: 9 }}
              tickFormatter={(value) => Number(value).toLocaleString([], { notation: Number(value) > 9999 ? 'compact' : 'standard' })}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value) => [`${value}${unit}`, title]}
              contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 6, color: 'var(--color-text)' }}
            />
            <Line type="monotone" dataKey={dataKey} stroke={stroke} dot={false} strokeWidth={2} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function IncidentEvidence({ podEvents }) {
  const incidentEvents = podEvents.filter((event) => event.eventType === 'intervention' || event.incidentId)
  if (!incidentEvents.length) return null
  const first = incidentEvents[incidentEvents.length - 1]
  const latest = incidentEvents[0]
  return (
    <section className="rounded-md border p-4" style={{ borderColor: 'var(--color-border)', background: 'rgba(8, 13, 20, 0.58)' }}>
      <h3 className="text-sm font-semibold">Incident Evidence</h3>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-md border p-3" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
          <div className="text-xs uppercase" style={{ color: 'var(--color-muted)' }}>Before</div>
          <div className="mt-2 text-sm">{first.evidence}</div>
          <div className="mt-1 text-xs" style={{ color: 'var(--color-muted)' }}>{first.lifecycle}</div>
        </div>
        <div className="rounded-md border p-3" style={{ borderColor: 'var(--color-info)', background: 'rgba(108, 195, 255, 0.1)' }}>
          <div className="text-xs uppercase" style={{ color: 'var(--color-info)' }}>Now</div>
          <div className="mt-2 text-sm">{latest.result}</div>
          <div className="mt-1 text-xs" style={{ color: 'var(--color-muted)' }}>{latest.lifecycle}</div>
        </div>
      </div>
    </section>
  )
}

function Lifecycle({ pod, podEvents }) {
  const activeIndex = Math.max(0, LIFECYCLE_STEPS.indexOf(pod.lifecycle))
  return (
    <section className="rounded-md border p-4" style={{ borderColor: 'var(--color-border)', background: 'rgba(8, 13, 20, 0.58)' }}>
      <h3 className="text-sm font-semibold">Agent Timeline</h3>
      <div className="mt-4 grid gap-2">
        {LIFECYCLE_STEPS.map((step, index) => {
          const done = pod.lifecycle === 'resolved' || index <= activeIndex
          const event = podEvents.find((item) => item.lifecycle === step)
          return (
            <div key={step} className="grid grid-cols-[18px_1fr_auto] items-start gap-3">
              <span className="mt-1 h-3 w-3 rounded-full border" style={{ borderColor: done ? 'var(--color-info)' : 'var(--color-border)', background: done ? 'var(--color-info)' : 'transparent' }} />
              <div>
                <div className="text-xs font-semibold capitalize">{step.replaceAll('_', ' ')}</div>
                <div className="mt-0.5 text-xs" style={{ color: 'var(--color-muted)' }}>{event?.result || (done ? 'Completed' : 'Pending')}</div>
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
    <section className="rounded-md border p-4" style={{ borderColor: 'var(--color-border)', background: 'rgba(8, 13, 20, 0.58)' }}>
      <h3 className="text-sm font-semibold">Manual Override</h3>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
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
              className="rounded-md border p-3 text-left text-sm transition-colors"
              style={{ borderColor: pending === action.id ? 'var(--color-warning)' : 'var(--color-border)', background: 'var(--color-surface)', color: disabled ? 'var(--color-muted)' : 'var(--color-text)' }}
            >
              <div className="font-semibold">{pending === action.id ? `Confirm ${action.label}` : action.label}</div>
              <div className="mt-1 text-xs" style={{ color: 'var(--color-muted)' }}>{action.risk}</div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

export default function PodDetailModal({ pod, events = [], agentLog = [], onManualAction, onClose }) {
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
        <header className="flex items-start justify-between gap-4 border-b p-4" style={{ borderColor: 'var(--color-border)' }}>
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <CropIcon crop={pod.crop} className="h-7 w-7" />
              <h2 id="pod-detail-title" className="truncate text-2xl font-semibold">{pod.id}</h2>
              <span className={`status-pill status-${statusText}`}>{statusText}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm" style={{ color: 'var(--color-muted)' }}>
              <span>{pod.crop}</span>
              <span>{pod.zone}</span>
              <span>{pod.reservoir}</span>
              <span>{pod.growth_stage}</span>
              <span>{ageDays} days</span>
              <span>{pod.plant_height_cm} cm</span>
            </div>
          </div>
          <button type="button" className="grid h-9 w-9 shrink-0 place-items-center rounded-md transition-colors hover:bg-[color:var(--color-hover)]" onClick={onClose} aria-label="Close pod detail">
            X
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="grid gap-4 xl:grid-cols-[1.35fr_0.9fr]">
            <div className="space-y-4">
              <section className="grid gap-3 sm:grid-cols-3">
                {['ph', 'ec_ppm', 'water_temp_c', 'humidity', 'water_level', 'light_lux'].map((metric) => <MetricPanel key={metric} pod={pod} metric={metric} />)}
              </section>

              <section className="grid gap-3 lg:grid-cols-3">
                <TrendChart title="pH" data={chartData} dataKey="ph" stroke="var(--color-success)" unit="" />
                <TrendChart title="EC" data={chartData} dataKey="ec_ppm" stroke="var(--color-warning)" unit=" ppm" />
                <TrendChart title="Water Temp" data={chartData} dataKey="water_temp_c" stroke="var(--color-info)" unit=" deg C" />
                <TrendChart title="Humidity" data={chartData} dataKey="humidity" stroke="#8be9d4" unit="%" />
                <TrendChart title="Water Level" data={chartData} dataKey="water_level" stroke="#78d7ff" unit="%" />
                <TrendChart title="Light" data={chartData} dataKey="light_lux" stroke="#f5d66b" unit=" lux" />
              </section>

              <section className="rounded-md border p-4" style={{ borderColor: 'var(--color-border)', background: 'rgba(8, 13, 20, 0.58)' }}>
                <h3 className="text-sm font-semibold">Why did the agent do this?</h3>
                <p className="mt-2 text-sm leading-6" style={{ color: 'var(--color-muted)' }}>
                  {latestEvent
                    ? `${latestEvent.diagnosis}. Evidence was ${latestEvent.evidence}. The selected action was ${latestEvent.action} with ${latestEvent.confidence}% confidence and ${latestEvent.risk.toLowerCase()} operational risk.`
                    : podAgentEntries[0]?.reasoning || 'The pod is stable. The agent is preserving an audit trail and watching for trend deviation before recommending changes.'}
                </p>
              </section>
              <IncidentEvidence podEvents={podEvents} />
            </div>

            <aside className="space-y-4">
              <div className="rounded-md border p-3" style={{ borderColor: 'var(--color-border)', background: 'rgba(8, 13, 20, 0.58)' }}>
                <PlantPreview pod={pod} className="h-64 w-full" />
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs" style={{ color: 'var(--color-muted)' }}>
                  <span>Pump: {pod.pump_status ? 'on' : 'off'}</span>
                  <span>Flow: {pod.flow_rate} L/m</span>
                  <span>DO: {pod.do_mg_l || '--'} mg/L</span>
                  <span>Updated: {timeLabel(pod.timestamp)}</span>
                </div>
              </div>
              <Lifecycle pod={pod} podEvents={podEvents} />
              <ManualControls pod={pod} onManualAction={onManualAction} />
            </aside>
          </div>
        </div>
      </section>
    </div>
  )
}
