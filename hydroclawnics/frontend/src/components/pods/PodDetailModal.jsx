import { useEffect, useMemo } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import PlantPreview from '../farm/PlantPreview'

const cropEmoji = {
  basil: '🌱',
  lettuce: '🥬',
  spinach: '🍃',
  tomato: '🍅',
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

function formatMetric(value, suffix = '', digits = 1) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return null
  return `${numeric.toFixed(digits)}${suffix}`
}

function formatWholeMetric(value, suffix = '') {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return null
  return `${Math.round(numeric)}${suffix}`
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
    <span className="rounded-md px-2 py-1 text-[11px] font-medium uppercase tracking-[0.02em]" style={statusStyles[normalized] || statusStyles.healthy}>
      {normalized}
    </span>
  )
}

function MetricValue({ value }) {
  const hasValue = value !== null && value !== undefined && value !== '--'
  return (
    <div
      className={`min-w-0 truncate text-m leading-6 [font-feature-settings:'tnum'] ${hasValue ? 'font-medium' : 'font-light'}`}
      style={{ color: hasValue ? 'var(--color-text)' : 'var(--color-muted)' }}
    >
      {hasValue ? value : '—'}
    </div>
  )
}

function CompactMetric({ label, value, dotColor }) {
  return (
    <div className="min-w-0 rounded-md border px-3 py-2.5" style={{ borderColor: 'var(--color-border)', background: 'rgba(15, 20, 25, 0.72)' }}>
      <div className="mb-1.5 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.02em]" style={{ color: 'var(--color-muted)' }}>
        {dotColor ? <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: dotColor }} aria-hidden="true" /> : null}
        <span className="truncate">{label}</span>
      </div>
      <MetricValue value={value} />
    </div>
  )
}

function SparklinePanel({ title, dataKey, data, stroke, label, digits = 0 }) {
  return (
    <div className="min-h-0">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="truncate text-xs font-medium" style={{ color: 'var(--color-text)' }}>
          {title}
        </div>
      </div>
      <div className="h-40 rounded-md border p-2" style={{ borderColor: 'var(--color-border)', background: 'rgba(15, 20, 25, 0.68)' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 6, right: 10, bottom: 0, left: 4 }}>
            <CartesianGrid stroke="rgba(168, 164, 158, 0.08)" vertical={false} />
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
  const isActive = entries.length > 0

  return (
    <aside className="flex min-h-0 flex-1 flex-col rounded-md border p-4" style={{ borderColor: 'var(--color-border)', background: 'rgba(15, 20, 25, 0.58)' }}>
      <div className="mb-3 flex shrink-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
            Agent Reasoning
          </h3>
          <p className="mt-1 text-xs" style={{ color: 'var(--color-muted)' }}>
            Decisions for this pod
          </p>
        </div>
        <span
          className={`mt-1 h-2 w-2 shrink-0 rounded-full ${isActive ? 'connection-dot' : ''}`}
          style={{ background: isActive ? 'var(--color-success)' : 'var(--color-muted)', opacity: isActive ? 1 : 0.45 }}
          aria-hidden="true"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {entries.length === 0 ? (
          <div className="flex h-full min-h-40 items-center justify-center text-center text-xs italic" style={{ color: 'var(--color-muted)' }}>
            Waiting for agent cycle...
          </div>
        ) : (
          entries.map((entry, idx) => (
            <article key={`${entry.timestamp}-${entry.action}-${idx}`} className="border-b py-3 first:pt-0 last:border-b-0" style={{ borderColor: 'rgba(61, 68, 81, 0.72)' }}>
              <div className="mb-1.5 flex items-center gap-2 text-xs" style={{ color: 'var(--color-muted)' }}>
                <span>{formatTime(entry.timestamp)}</span>
              </div>
              <div className="truncate text-sm font-medium leading-5" style={{ color: 'var(--color-text)' }}>
                {entry.action || entry.diagnosis || 'Decision received'}
              </div>
              <p className="mt-1 line-clamp-3 text-xs leading-5" style={{ color: 'var(--color-muted)' }}>
                {entry.reasoning || entry.diagnosis || 'No reasoning supplied.'}
              </p>
              {entry.action ? <div className="mt-2 h-0.5 w-8 rounded-full" style={{ background: colorForAction(entry.action) }} aria-hidden="true" /> : null}
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

  const ageHours = Number(pod.age_hours || 0)
  const formattedAge = `${Math.floor(ageHours)}h ${Math.round((ageHours % 1) * 60)}m`
  const faultSummary = pod.fault_type && pod.fault_type !== 'none' ? pod.fault_type : 'No active fault'

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-3 md:p-5" style={{ background: 'var(--color-overlay)' }} onMouseDown={onClose}>
      <section
        className="modal-enter flex max-h-[92vh] w-[95vw] max-w-[900px] flex-col overflow-hidden rounded-lg border"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pod-detail-title"
      >
        <div className="flex min-h-16 shrink-0 items-center justify-between gap-4 border-b px-4 py-3" style={{ borderColor: 'var(--color-border)' }}>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex min-w-0 flex-wrap items-center gap-2">
              <h2 id="pod-detail-title" className="truncate text-xl font-medium" style={{ color: 'var(--color-text)' }}>
                {pod.id} {cropEmoji[pod.crop] || '🌱'} {pod.crop}
              </h2>
              <StatusBadge status={pod.status} />
            </div>
            <div className="text-xs" style={{ color: 'var(--color-muted)' }}>
              Updated {formatTime(pod.timestamp)}
            </div>
          </div>
          <div className="flex min-w-0 shrink-0 items-center gap-3">
            <div className="hidden max-w-56 truncate text-right text-xs sm:block" style={{ color: 'var(--color-muted)' }}>
              {faultSummary}
            </div>
            <button type="button" className="grid h-9 w-9 shrink-0 place-items-center rounded-md transition-colors hover:bg-[color:var(--color-hover)]" onClick={onClose} aria-label="Close pod detail">
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,3fr)_minmax(280px,2fr)] grid-rows-[auto_minmax(0,1fr)] gap-4 overflow-y-auto p-4 max-[700px]:grid-cols-1 max-[700px]:grid-rows-none">
          <section className="col-start-2 row-start-1 rounded-md border p-3 max-[700px]:col-start-1 max-[700px]:row-start-1" style={{ borderColor: 'var(--color-border)', background: 'rgba(15, 20, 25, 0.42)' }}>
            <PlantPreview pod={pod} className="mb-2 h-[280px] w-full" />
            <div className="text-center text-xs" style={{ color: 'var(--color-muted)' }}>
              {pod.id}
            </div>
          </section>

          <div className="col-start-1 row-span-2 row-start-1 min-h-0 min-w-0 space-y-4 max-[700px]:row-span-1 max-[700px]:row-start-2">
            <section>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-[0.02em]" style={{ color: 'var(--color-muted)' }}>
                Key Vitals
              </h3>
              <div className="grid grid-cols-3 gap-2 max-[520px]:grid-cols-2">
                <CompactMetric label="pH" value={formatMetric(pod.ph, '', 2)} />
                <CompactMetric label="Temp" value={formatMetric(pod.water_temp_c, ' deg C', 1)} />
                <CompactMetric label="EC" value={formatWholeMetric(pod.ec_ppm, ' ppm')} />
                <CompactMetric label="Water" value={formatWholeMetric(pod.water_level, '%')} />
                <CompactMetric label="Humidity" value={formatWholeMetric(pod.humidity, '%')} />
                <CompactMetric label="DO" value={formatMetric(pod.do_mg_l, ' mg/L', 1)} />
                <CompactMetric label="Pump" value={pod.pump_status ? 'On' : 'Off'} dotColor={statusDotStyles[pod.pump_status ? 'on' : 'off']} />
                <CompactMetric label="Flow" value={formatMetric(pod.flow_rate, ' L/m', 1)} />
                <CompactMetric label="Height" value={formatMetric(pod.plant_height_cm, ' cm', 1)} />
              </div>
            </section>

            <section>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-[0.02em]" style={{ color: 'var(--color-muted)' }}>
                Trend Charts
              </h3>
              <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <SparklinePanel title="pH" data={chartData} dataKey="ph" label="pH" digits={2} stroke="var(--color-success)" />
                <SparklinePanel title="EC" data={chartData} dataKey="ec_ppm" label="ppm" stroke="var(--color-warning)" />
                <SparklinePanel title="Temp" data={chartData} dataKey="water_temp_c" label="deg C" digits={1} stroke="var(--color-info)" />
                <SparklinePanel title="Light" data={chartData} dataKey="light_lux" label="lux" stroke="#d7c96b" />
              </div>
            </section>

            <div className="truncate rounded-md border px-3 py-2 text-xs uppercase tracking-[0.02em]" style={{ borderColor: 'var(--color-border)', background: 'rgba(15, 20, 25, 0.4)', color: 'var(--color-muted)' }}>
              AGE: {formattedAge} &nbsp;·&nbsp; HEIGHT: {formatMetric(pod.plant_height_cm, ' cm', 1) || '—'} &nbsp;·&nbsp; CROP: {pod.crop || '—'} &nbsp;·&nbsp; AIR: {formatMetric(pod.air_temp_c, ' deg C', 1) || '—'}
            </div>
          </div>

          <div className="col-start-2 row-start-2 flex min-h-0 min-w-0 max-[700px]:col-start-1 max-[700px]:row-start-3">
            <AgentReasoningPanel entries={podAgentEntries} />
          </div>
        </div>
      </section>
    </div>
  )
}
