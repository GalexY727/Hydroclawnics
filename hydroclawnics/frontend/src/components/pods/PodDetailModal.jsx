import { useEffect, useMemo } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import PlantPreview from '../farm/PlantPreview'

const cropEmoji = {
  basil: '🌱',
  lettuce: '🥬',
  spinach: '🍃',
}

const statusStyles = {
  healthy: { background: 'var(--color-success)', color: 'var(--color-bg)' },
  warning: { background: 'var(--color-warning)', color: 'var(--color-bg)' },
  critical: { background: 'var(--color-critical)', color: 'var(--color-text)' },
}

const statusDotStyles = {
  healthy: 'var(--color-success)',
  warning: 'var(--color-warning)',
  critical: 'var(--color-critical)',
  off: 'var(--color-critical)',
  on: 'var(--color-success)',
}

function colorForAction(action = '') {
  const normalized = action.toLowerCase()
  if (normalized.includes('dose_ph_up') || normalized.includes('dose_ph_down')) return 'var(--color-info)'
  if (normalized.includes('nutrient')) return 'var(--color-warning)'
  if (normalized.includes('heat')) return 'var(--color-critical)'
  if (normalized.includes('alert')) return 'var(--color-neutral)'
  return 'var(--color-muted)'
}

function formatReading(value, digits = 1) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return '--'
  return numeric.toFixed(digits)
}

function formatTime(timestamp) {
  const date = timestamp ? new Date(timestamp) : null
  if (!date || Number.isNaN(date.getTime())) return '--:--'
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function formatRelativeSeconds(seconds) {
  const rounded = Math.round(Number(seconds) || 0)
  if (rounded === 0) return 't+0s'
  return `t${rounded > 0 ? '+' : ''}${rounded}s`
}

function StatusBadge({ status }) {
  const normalized = status || 'healthy'
  return (
    <span className="rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-[0.02em]" style={statusStyles[normalized] || statusStyles.healthy}>
      {normalized}
    </span>
  )
}

function CompactMetric({ label, value, dotColor }) {
  return (
    <div className="min-w-0 rounded-md border px-3 py-2" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}>
      <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.02em]" style={{ color: 'var(--color-muted)' }}>
        {dotColor ? <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: dotColor }} /> : null}
        <span className="truncate">{label}</span>
      </div>
      <div className="truncate font-mono text-sm font-bold" style={{ color: 'var(--color-text)' }}>
        {value}
      </div>
    </div>
  )
}

function SparklinePanel({ title, dataKey, data, stroke, label, digits = 0 }) {
  return (
    <div className="min-h-0">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="truncate text-xs font-semibold" style={{ color: 'var(--color-text)' }}>
          {title}
        </div>
      </div>
      <div className="h-[138px] rounded-md border p-2" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 10, bottom: 0, left: 6 }}>
            <CartesianGrid stroke="rgba(127, 176, 105, 0.08)" vertical={false} />
            <XAxis
              dataKey="secondsFromLatest"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={formatRelativeSeconds}
              tick={{ fill: 'var(--color-muted)', fontSize: 9 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--color-border)' }}
              minTickGap={10}
            />
            <YAxis
              tick={{ fill: 'var(--color-muted)', fontSize: 9 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--color-border)' }}
              width={46}
              domain={['auto', 'auto']}
            />
            <Tooltip
              cursor={{ stroke: 'rgba(229, 244, 224, 0.2)', strokeWidth: 1 }}
              labelFormatter={formatRelativeSeconds}
              formatter={(value) => [formatReading(value, digits), label]}
              contentStyle={{
                background: 'var(--color-surface-2)',
                border: '1px solid var(--color-border)',
                borderRadius: 6,
                color: 'var(--color-text)',
                fontSize: 11,
              }}
            />
            <Legend
              verticalAlign="top"
              align="right"
              height={20}
              iconType="plainline"
              wrapperStyle={{ color: 'var(--color-muted)', fontSize: 10 }}
            />
            <Line
              type="monotone"
              name={label}
              dataKey={dataKey}
              stroke={stroke}
              strokeWidth={2}
              dot={{ r: 2, strokeWidth: 0, fill: stroke }}
              activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--color-bg)', fill: stroke }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function AgentReasoningPanel({ entries }) {
  return (
    <aside className="flex min-h-0 flex-col rounded-md border p-4" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}>
      <div className="mb-3 shrink-0">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
          Agent Reasoning
        </h3>
        <p className="mt-1 text-xs" style={{ color: 'var(--color-muted)' }}>
          Decisions for this plant
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {entries.length === 0 ? (
          <div className="flex h-full min-h-40 items-center justify-center text-center text-xs italic" style={{ color: 'var(--color-muted)' }}>
            No agent reasoning recorded for this pod yet.
          </div>
        ) : (
          entries.map((entry, idx) => (
            <article key={`${entry.timestamp}-${entry.action}-${idx}`} className="border-b py-3 first:pt-0 last:border-b-0" style={{ borderColor: 'var(--color-border)' }}>
              <div className="mb-1.5 flex items-center gap-2 text-xs" style={{ color: 'var(--color-muted)' }}>
                <span>{formatTime(entry.timestamp)}</span>
                <span className="h-1 w-1 rounded-full" style={{ background: 'var(--color-muted)' }} />
                <span>{entry.pod_id || 'pod'}</span>
              </div>
              <div className="text-sm font-bold leading-5" style={{ color: 'var(--color-text)' }}>
                {entry.diagnosis || 'Decision received'}
              </div>
              <div className="mt-1 truncate font-mono text-xs" style={{ color: colorForAction(entry.action) }}>
                {entry.action || 'observe'}
              </div>
              <p className="mt-2 text-xs leading-5" style={{ color: 'var(--color-muted)' }}>
                {entry.reasoning || 'No reasoning supplied.'}
              </p>
            </article>
          ))
        )}
      </div>
    </aside>
  )
}

export default function PodDetailModal({ pod, agentLog = [], onClose }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const chartData = useMemo(() => {
    const history = pod?.history?.length ? pod.history : [{ ...pod, timestamp: new Date().toISOString() }]
    const latestTimestampMs = [...history]
      .reverse()
      .map((reading) => (reading.timestamp ? new Date(reading.timestamp).getTime() : Number.NaN))
      .find((timestampMs) => Number.isFinite(timestampMs))
    const normalized = history.map((reading, index) => ({
      index,
      secondsFromLatest: Number.isFinite(latestTimestampMs) && reading.timestamp
        ? Math.round((new Date(reading.timestamp).getTime() - latestTimestampMs) / 1000)
        : index - history.length + 1,
      ph: Number(reading.ph ?? pod?.ph ?? 0),
      ec_ppm: Number(reading.ec_ppm ?? pod?.ec_ppm ?? 0),
      water_temp_c: Number(reading.water_temp_c ?? pod?.water_temp_c ?? 0),
      light_lux: Number(reading.light_lux ?? pod?.light_lux ?? 0),
    }))
    return normalized.length > 1 ? normalized : [{ ...normalized[0], secondsFromLatest: -1 }, { ...normalized[0], index: normalized[0].index + 1, secondsFromLatest: 0 }]
  }, [pod])

  const podAgentEntries = useMemo(() => agentLog.filter((entry) => entry.pod_id === pod?.id), [agentLog, pod?.id])

  if (!pod) {
    return null
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-3 md:p-5" style={{ background: 'var(--color-overlay)' }} onMouseDown={onClose}>
      <section
        className="modal-enter flex max-h-[92vh] w-full max-w-[1180px] flex-col overflow-hidden rounded-lg border p-4 md:h-[86vh] md:max-h-[760px] md:p-5"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pod-detail-title"
      >
        <div className="mb-4 flex shrink-0 items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-1.5 flex flex-wrap items-center gap-3">
              <h2 id="pod-detail-title" className="truncate text-xl font-semibold tracking-[-0.2px]" style={{ color: 'var(--color-text)' }}>
                {pod.id} {cropEmoji[pod.crop] || '🌱'} {pod.crop}
              </h2>
              <StatusBadge status={pod.status} />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: 'var(--color-muted)' }}>
              <span>{pod.fault_type && pod.fault_type !== 'none' ? `Fault: ${pod.fault_type}` : 'No active fault'}</span>
              <span>Updated {formatTime(pod.timestamp)}</span>
            </div>
          </div>
          <button type="button" className="grid h-9 w-9 shrink-0 place-items-center rounded-md transition-colors hover:bg-[color:var(--color-hover)]" onClick={onClose} aria-label="Close pod detail">
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_320px] lg:overflow-hidden xl:grid-cols-[minmax(0,1fr)_350px]">
          <div className="min-h-0 overflow-visible lg:overflow-hidden">
            <div className="grid gap-4 xl:grid-cols-[250px_minmax(0,1fr)]">
              <div className="min-w-0">
                <PlantPreview pod={pod} className="mb-0 aspect-square h-auto min-h-[220px] w-full xl:min-h-0" />
              </div>

              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <SparklinePanel title="pH" data={chartData} dataKey="ph" label="pH" digits={2} stroke="var(--color-success)" />
                <SparklinePanel title="EC" data={chartData} dataKey="ec_ppm" label="ppm" stroke="var(--color-warning)" />
                <SparklinePanel title="Temp" data={chartData} dataKey="water_temp_c" label="deg C" digits={1} stroke="var(--color-info)" />
                <SparklinePanel title="Light" data={chartData} dataKey="light_lux" label="lux" stroke="#d7c96b" />
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3 xl:grid-cols-5">
              <CompactMetric label="DO" value={pod.do_mg_l ? `${formatReading(pod.do_mg_l, 1)} mg/L` : '--'} />
              <CompactMetric label="Age" value={`${Math.floor(Number(pod.age_hours || 0))}h ${Math.round((Number(pod.age_hours || 0) % 1) * 60)}m`} />
              <CompactMetric label="Height" value={`${formatReading(pod.plant_height_cm, 1)} cm`} />
              <CompactMetric label="Water" value={pod.water_level != null ? `${Math.round(Number(pod.water_level))}%` : '--'} />
              <CompactMetric label="Humidity" value={pod.humidity != null ? `${Math.round(Number(pod.humidity))}%` : '--'} />
              <CompactMetric label="Pump" value={pod.pump_status ? 'On' : 'Off'} dotColor={statusDotStyles[pod.pump_status ? 'on' : 'off']} />
              <CompactMetric label="Flow" value={pod.flow_rate != null ? `${Number(pod.flow_rate).toFixed(1)} L/m` : '--'} />
              <CompactMetric label="Air" value={pod.air_temp_c != null ? `${formatReading(pod.air_temp_c, 1)} deg C` : '--'} />
              <CompactMetric label="Status" value={pod.status || 'healthy'} dotColor={statusDotStyles[pod.status] || statusDotStyles.healthy} />
              <CompactMetric label="Crop" value={pod.crop || '--'} />
            </div>
          </div>

          <AgentReasoningPanel entries={podAgentEntries} />
        </div>
      </section>
    </div>
  )
}
