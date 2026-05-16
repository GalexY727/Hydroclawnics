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

function ReadingCard({ label, value }) {
  return (
    <div className="rounded-md border p-3" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}>
      <div className="mb-1 text-xs" style={{ color: 'var(--color-muted)' }}>
        {label}
      </div>
      <div className="font-mono text-lg font-bold" style={{ color: 'var(--color-text)' }}>
        {value}
      </div>
    </div>
  )
}

function SparklinePanel({ title, dataKey, data, stroke, label }) {
  return (
    <div>
      <div className="mb-2 text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
        {title}
      </div>
      <div className="h-[170px] rounded-md border p-2" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 12, bottom: 0, left: 8 }}>
            <CartesianGrid stroke="rgba(127, 176, 105, 0.08)" vertical={false} />
            <XAxis
              dataKey="secondsFromLatest"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={formatRelativeSeconds}
              tick={{ fill: 'var(--color-muted)', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--color-border)' }}
              minTickGap={12}
            />
            <YAxis
              tick={{ fill: 'var(--color-muted)', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: 'var(--color-border)' }}
              width={48}
              domain={['auto', 'auto']}
            />
            <Tooltip
              cursor={{ stroke: 'rgba(229, 244, 224, 0.2)', strokeWidth: 1 }}
              labelFormatter={formatRelativeSeconds}
              formatter={(value) => [formatReading(value, dataKey === 'ph' ? 2 : 0), label]}
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
              height={24}
              iconType="plainline"
              wrapperStyle={{ color: 'var(--color-muted)', fontSize: 11 }}
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

export default function PodDetailModal({ pod, agentLog = [], onClose }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const chartData = useMemo(() => {
    const history = pod?.history?.length ? pod.history : [{ ph: pod?.ph, ec_ppm: pod?.ec_ppm, timestamp: new Date().toISOString() }]
    const latestTimestampMs = [...history]
      .reverse()
      .map((reading) => (reading.timestamp ? new Date(reading.timestamp).getTime() : Number.NaN))
      .find((timestampMs) => Number.isFinite(timestampMs))
    const normalized = history.map((reading, index) => ({
      index,
      secondsFromLatest: Number.isFinite(latestTimestampMs) && reading.timestamp
        ? Math.round((new Date(reading.timestamp).getTime() - latestTimestampMs) / 1000)
        : index - history.length + 1,
      ph: Number(reading.ph || 0),
      ec_ppm: Number(reading.ec_ppm || 0),
    }))
    return normalized.length > 1 ? normalized : [{ ...normalized[0], secondsFromLatest: -1 }, { ...normalized[0], index: normalized[0].index + 1, secondsFromLatest: 0 }]
  }, [pod])

  const latestEntry = useMemo(() => agentLog.find((entry) => entry.pod_id === pod?.id), [agentLog, pod?.id])
  const lastAction = pod?.last_action || latestEntry?.action
  const lastActionTime = latestEntry?.timestamp ? ` at ${formatTime(latestEntry.timestamp)}` : ''

  if (!pod) {
    return null
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4" style={{ background: 'var(--color-overlay)' }} onMouseDown={onClose}>
      <section
        className="modal-enter max-h-[92vh] w-full max-w-[600px] overflow-y-auto rounded-lg border p-6 md:p-8"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pod-detail-title"
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-3">
              <h2 id="pod-detail-title" className="text-xl font-semibold tracking-[-0.2px]" style={{ color: 'var(--color-text)' }}>
                {pod.id} {cropEmoji[pod.crop] || '🌱'} {pod.crop}
              </h2>
              <StatusBadge status={pod.status} />
            </div>
            {pod.fault_type && pod.fault_type !== 'none' && (
              <p className="mb-1 text-xs font-semibold" style={{ color: pod.status === 'critical' ? 'var(--color-critical)' : 'var(--color-warning)' }}>
                Fault: {pod.fault_type}
              </p>
            )}
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
              Full pod sensor detail
            </p>
          </div>
          <button type="button" className="grid h-9 w-9 shrink-0 place-items-center rounded-md transition-colors hover:bg-[color:var(--color-hover)]" onClick={onClose} aria-label="Close pod detail">
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <PlantPreview pod={pod} />

        <div className="grid grid-cols-2 gap-3">
          <ReadingCard label="pH" value={formatReading(pod.ph, 2)} />
          <ReadingCard label="EC" value={`${formatReading(pod.ec_ppm, 0)} ppm`} />
          <ReadingCard label="Temp" value={`${formatReading(pod.water_temp_c, 1)}°C`} />
          <ReadingCard label="Light" value={`${formatReading(pod.light_lux, 0)} lux`} />
          <ReadingCard label="DO" value={pod.do_mg_l ? `${formatReading(pod.do_mg_l, 1)} mg/L` : '--'} />
          <ReadingCard label="Age" value={`${Math.floor(Number(pod.age_hours || 0))}h ${Math.round((Number(pod.age_hours || 0) % 1) * 60)}m`} />
          <ReadingCard label="Water" value={pod.water_level != null ? `${Math.round(Number(pod.water_level))}%` : '--'} />
          <ReadingCard label="Humidity" value={pod.humidity != null ? `${Math.round(Number(pod.humidity))}%` : '--'} />
          <ReadingCard label="Pump" value={pod.pump_status ? 'On' : 'Off'} />
          <ReadingCard label="Flow" value={pod.flow_rate != null ? `${Number(pod.flow_rate).toFixed(1)} L/m` : '--'} />
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <SparklinePanel title="pH history" data={chartData} dataKey="ph" label="pH" stroke="var(--color-success)" />
          <SparklinePanel title="EC history" data={chartData} dataKey="ec_ppm" label="EC ppm" stroke="var(--color-warning)" />
        </div>

        <p className="mt-6 text-xs" style={{ color: 'var(--color-muted)' }}>
          Last agent action: {lastAction ? `Agent ${lastAction}${lastActionTime}` : 'No agent action recorded yet'}
        </p>
      </section>
    </div>
  )
}
