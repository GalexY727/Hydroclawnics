import { useEffect, useMemo, useState } from 'react'
import { Sparklines, SparklinesLine } from 'react-sparklines'

const cropEmoji = {
  basil: '🌱',
  lettuce: '🥬',
  spinach: '🍃',
}

const statusTint = {
  healthy: 'rgba(34, 197, 94, 0.18)',
  warning: 'rgba(250, 204, 21, 0.18)',
  critical: 'rgba(248, 113, 113, 0.18)',
}

const statusBorder = {
  healthy: 'border-emerald-600',
  warning: 'border-amber-500',
  critical: 'border-rose-500',
}

function formatReading(value, digits = 1) {
  return Number(value || 0).toFixed(digits)
}

export default function PodGrid({ pods, onSelect }) {
  const [activePodId, setActivePodId] = useState(null)
  const podList = useMemo(() => Object.values(pods), [pods])
  const activePod = activePodId ? pods[activePodId] : null

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setActivePodId(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {podList.map((pod) => (
          <button
            key={pod.id}
            type="button"
            className={`min-h-36 border p-3 text-left transition hover:-translate-y-0.5 hover:border-cyan-300 ${statusBorder[pod.status] || statusBorder.healthy}`}
            style={{ backgroundColor: statusTint[pod.status] || statusTint.healthy }}
            onClick={() => {
              // # FIX: Keep the selected pod synced with both the grid modal and the parent dashboard state.
              setActivePodId(pod.id)
              onSelect?.(pod.id)
            }}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="font-semibold">{pod.id}</span>
              <span className="rounded bg-slate-950/60 px-2 py-0.5 text-xs uppercase text-slate-200">{pod.status}</span>
            </div>
            <div className="text-sm text-slate-200">
              <span className="mr-1">{cropEmoji[pod.crop] || '🌿'}</span>
              {pod.crop}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div>
                <div className="text-xs uppercase text-slate-400">pH</div>
                <div className="font-semibold">{formatReading(pod.ph, 2)}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-slate-400">EC</div>
                <div className="font-semibold">{formatReading(pod.ec_ppm, 0)} ppm</div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {activePod && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-950/75 p-4" onClick={() => setActivePodId(null)}>
          <div className="w-full max-w-2xl border border-slate-700 bg-slate-900 p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold">{activePod.id}</h3>
                <p className="text-sm text-slate-400">
                  {cropEmoji[activePod.crop] || '🌿'} {activePod.crop} · {activePod.status}
                </p>
              </div>
              <button className="text-xl text-slate-400 hover:text-slate-100" onClick={() => setActivePodId(null)} type="button" aria-label="Close pod detail">
                ×
              </button>
            </div>

            <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div className="bg-slate-950 p-3">
                <div className="text-xs uppercase text-slate-500">pH</div>
                <div className="text-lg font-semibold">{formatReading(activePod.ph, 2)}</div>
              </div>
              <div className="bg-slate-950 p-3">
                <div className="text-xs uppercase text-slate-500">EC</div>
                <div className="text-lg font-semibold">{formatReading(activePod.ec_ppm, 0)} ppm</div>
              </div>
              <div className="bg-slate-950 p-3">
                <div className="text-xs uppercase text-slate-500">Temp</div>
                <div className="text-lg font-semibold">{formatReading(activePod.temp_c, 1)} °C</div>
              </div>
              <div className="bg-slate-950 p-3">
                <div className="text-xs uppercase text-slate-500">Light</div>
                <div className="text-lg font-semibold">{formatReading(activePod.light_lux, 0)} lux</div>
              </div>
              <div className="bg-slate-950 p-3">
                <div className="text-xs uppercase text-slate-500">Age</div>
                <div className="text-lg font-semibold">{formatReading(activePod.age_hours, 1)} hr</div>
              </div>
              <div className="bg-slate-950 p-3">
                <div className="text-xs uppercase text-slate-500">Fault</div>
                <div className="text-lg font-semibold">{activePod.fault_type || 'none'}</div>
              </div>
              <div className="bg-slate-950 p-3">
                <div className="text-xs uppercase text-slate-500">Status</div>
                <div className="text-lg font-semibold">{activePod.status}</div>
              </div>
              <div className="bg-slate-950 p-3">
                <div className="text-xs uppercase text-slate-500">Last sample</div>
                <div className="text-lg font-semibold">{activePod.history?.at(-1)?.timestamp ? new Date(activePod.history.at(-1).timestamp).toLocaleTimeString() : '--:--:--'}</div>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <div className="mb-2 text-sm font-semibold text-slate-300">pH history</div>
                <div className="h-24 bg-slate-950 p-2">
                  <Sparklines data={(activePod.history || []).map((reading) => reading.ph)}>
                    <SparklinesLine color="#38bdf8" />
                  </Sparklines>
                </div>
              </div>
              <div>
                <div className="mb-2 text-sm font-semibold text-slate-300">EC history</div>
                <div className="h-24 bg-slate-950 p-2">
                  <Sparklines data={(activePod.history || []).map((reading) => reading.ec_ppm)}>
                    <SparklinesLine color="#f59e0b" />
                  </Sparklines>
                </div>
              </div>
            </div>

            <p className="mt-4 text-sm italic text-slate-400">Last action: {activePod.last_action || 'No agent action recorded.'}</p>
          </div>
        </div>
      )}
    </>
  )
}
