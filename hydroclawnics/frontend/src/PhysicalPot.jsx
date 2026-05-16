import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'

const statusClasses = {
  healthy: 'border-emerald-500',
  warning: 'border-amber-400',
  critical: 'border-rose-500',
}

function Gauge({ label, value, min, max, suffix, color, greenZone }) {
  const percentage = ((value - min) / (max - min)) * 100
  const clampedPercentage = Math.max(0, Math.min(100, percentage))
  
  // Determine color based on green zone
  let displayColor = color
  if (value < greenZone[0] || value > greenZone[1]) {
    displayColor = '#ef4444' // red for out of range
  }

  const data = [
    { name: 'value', value: clampedPercentage },
    { name: 'empty', value: 100 - clampedPercentage },
  ]

  return (
    <div className="rounded bg-slate-950 p-4 flex flex-col items-center">
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            startAngle={180}
            endAngle={0}
            innerRadius={60}
            outerRadius={80}
            paddingAngle={0}
            dataKey="value"
          >
            <Cell fill={displayColor} />
            <Cell fill="#1f2937" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="text-center mt-2">
        <p className="text-2xl font-semibold text-slate-100">
          {value.toFixed(1)}{suffix}
        </p>
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-xs text-slate-500 mt-1">
          {min}-{max} ({greenZone[0]}-{greenZone[1]} ideal)
        </p>
      </div>
    </div>
  )
}

export default function PhysicalPot({ pods }) {
  // # FIX: The physical pot is pinned to pod_00 when present, otherwise it follows the first live pod from FastAPI.
  const pod = pods.pod_00 || Object.values(pods)[0]

  return (
    <section className={`border-2 ${statusClasses[pod?.status] || statusClasses.healthy} bg-slate-900 p-4`}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">Pot Alpha (Physical)</h2>
          <p className="text-sm text-slate-400">{pod ? `${pod.id} · ${pod.crop}` : 'Waiting for live pod data'}</p>
        </div>
        {pod && <span className="rounded bg-slate-800 px-2 py-1 text-xs uppercase text-slate-300">{pod.status}</span>}
      </div>

      {pod ? (
        <div className="grid gap-3 lg:grid-cols-3">
          <Gauge label="pH" value={pod.ph ?? 0} min={0} max={14} suffix="" color="#38bdf8" greenZone={[6, 7]} />
          <Gauge label="EC ppm" value={(pod.ec_ppm ?? 0) / 1000} min={0} max={3} suffix="" color="#22c55e" greenZone={[0.8, 1.6]} />
          <Gauge label="Temp °C" value={pod.temp_c ?? 0} min={10} max={35} suffix="°C" color="#f97316" greenZone={[18, 24]} />
        </div>
      ) : (
        <div className="flex items-center justify-center rounded bg-slate-800 py-12 text-slate-400">No sensor data available</div>
      )}

      <p className="mt-3 text-sm italic text-slate-400">
        Last action: {pod?.last_action || 'No physical intervention logged yet.'}
      </p>
    </section>
  )
}
