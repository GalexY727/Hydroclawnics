import CropIcon from '../CropIcon'

const statusStyles = {
  healthy: { background: 'var(--color-success)', color: 'var(--color-bg)' },
  warning: { background: 'var(--color-warning)', color: 'var(--color-bg)' },
  critical: { background: 'var(--color-critical)', color: 'var(--color-text)' },
}

const metricRanges = {
  ph: { min: 6.0, max: 7.0, scaleMin: 4.5, scaleMax: 8.0 },
  ec: { min: 0.8, max: 1.2, scaleMin: 0.2, scaleMax: 2.0 },
  temp: { min: 18, max: 24, scaleMin: 10, scaleMax: 32 },
}

function formatNumber(value, digits = 1) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return '--'
  return numeric.toFixed(digits)
}

function statusForMetric(value, min, max) {
  if (value >= min && value <= max) return 'ok'
  return 'warn'
}

function MetricRow({ label, value, displayValue, rangeText, range, accent = 'var(--color-success)' }) {
  const numeric = Number(value)
  const safeValue = Number.isFinite(numeric) ? numeric : range.min
  const percentage = ((safeValue - range.scaleMin) / (range.scaleMax - range.scaleMin)) * 100
  const clamped = Math.max(0, Math.min(100, percentage))
  const metricStatus = statusForMetric(safeValue, range.min, range.max)

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-1 flex-1 min-w-0">
          <span className="text-xs font-medium flex-shrink-0" style={{ color: 'var(--color-muted)' }}>
            {label}
          </span>
          <span className="font-mono text-base font-bold" style={{ color: 'var(--color-text)' }}>
            {displayValue}
          </span>
        </div>
        <span className="text-[10px] flex-shrink-0" style={{ color: metricStatus === 'ok' ? 'var(--color-success)' : 'var(--color-warning)' }}>
          {metricStatus === 'ok' ? '✓' : '×'}
        </span>
      </div>
      <div className="text-[11px] leading-tight" style={{ color: 'var(--color-muted)' }}>
        {rangeText}
      </div>
      <div className="h-[3px] overflow-hidden rounded-full" style={{ background: 'var(--color-surface-2)' }}>
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${clamped}%`, background: metricStatus === 'ok' ? accent : 'var(--color-warning)' }} />
      </div>
    </div>
  )
}

export default function PhysicalPot({ pods }) {
  const pod = pods.pod_00 || Object.values(pods)[0]
  const status = pod?.status || 'healthy'
  const ecMs = Number(pod?.ec_ppm || 0) / 1000

  return (
    <div className="h-full rounded-lg border p-3" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium" style={{ color: 'var(--color-muted)' }}>
            Pot Alpha (Physical)
          </h2>
          {pod ? (
            <p className="mt-1 flex items-center gap-1.5 text-xs capitalize" style={{ color: 'var(--color-muted)' }}>
              <span>{pod.id}</span>
              <span>·</span>
              <CropIcon crop={pod.crop} className="h-4 w-4" />
              <span>{pod.crop}</span>
            </p>
          ) : (
            <p className="mt-1 text-xs" style={{ color: 'var(--color-muted)' }}>
              Waiting for live pod data
            </p>
          )}
        </div>
        {pod && (
          <span className="rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-[0.02em]" style={statusStyles[status] || statusStyles.healthy}>
            {status}
          </span>
        )}
      </div>

      {pod ? (
        <div className="grid gap-3 lg:grid-cols-3">
          <MetricRow label="pH" value={pod.ph} displayValue={formatNumber(pod.ph, 2)} rangeText="[range 6.0-7.0]" range={metricRanges.ph} />
          <MetricRow label="EC" value={ecMs} displayValue={`${formatNumber(ecMs, 1)} ppm`} rangeText="[range 0.8-1.2]" range={metricRanges.ec} accent="var(--color-info)" />
          <MetricRow label="Temp" value={pod.water_temp_c} displayValue={`${formatNumber(pod.water_temp_c, 0)}°C`} rangeText="[range 18-24]" range={metricRanges.temp} accent="var(--color-warning)" />
        </div>
      ) : (
        <div className="flex min-h-32 items-center justify-center rounded-md border text-sm italic" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>
          No sensor data available
        </div>
      )}

      <p className="mt-3 truncate text-xs italic" style={{ color: 'var(--color-muted)' }}>
        {pod?.last_action || 'No physical intervention logged yet'}
      </p>
    </div>
  )
}
