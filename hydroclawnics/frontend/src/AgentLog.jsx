import { useState } from 'react'

const REASONING_PREVIEW_CHARS = 150

const actionBorder = {
  dose_ph_up: 'border-blue-400',
  dose_ph_down: 'border-blue-400',
  nutrient: 'border-orange-400',
  heat: 'border-red-400',
  alert: 'border-purple-400',
  default: 'border-slate-500',
}

function borderForAction(action = '') {
  const normalized = action.toLowerCase()
  if (normalized.includes('dose_ph_up')) return actionBorder.dose_ph_up
  if (normalized.includes('dose_ph_down')) return actionBorder.dose_ph_down
  if (normalized.includes('nutrient')) return actionBorder.nutrient
  if (normalized.includes('heat')) return actionBorder.heat
  if (normalized.includes('alert')) return actionBorder.alert
  return actionBorder.default
}

function formatTime(timestamp) {
  const date = timestamp ? new Date(timestamp) : new Date()
  if (Number.isNaN(date.getTime())) {
    return `${timestamp || ''}`.slice(0, 8) || '--:--:--'
  }
  return date.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function AgentLog({ entries }) {
  const [expanded, setExpanded] = useState({})

  return (
    <section className="flex h-full min-h-[720px] flex-col border border-slate-700 bg-slate-900 p-4">
      <h2 className="mb-3 text-xl font-semibold">Agent Reasoning Feed</h2>
      <div className="space-y-3 overflow-y-auto pr-1">
        {entries.map((entry, idx) => {
          const key = `${entry.timestamp}-${entry.pod_id}-${idx}`
          const reasoning = `${entry.reasoning || ''}`
          const isExpanded = Boolean(expanded[key])
          const shouldTruncate = reasoning.length > REASONING_PREVIEW_CHARS
          const visibleReasoning = isExpanded || !shouldTruncate ? reasoning : `${reasoning.slice(0, REASONING_PREVIEW_CHARS)}...`

          return (
            <article key={key} className={`border-l-4 bg-slate-800/70 p-3 ${borderForAction(entry.action)}`}>
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span>{formatTime(entry.timestamp)}</span>
                <span className="rounded bg-slate-950 px-2 py-0.5 font-semibold text-cyan-200">{entry.pod_id || 'pod'}</span>
              </div>
              <div className="text-sm font-bold text-slate-100">{entry.diagnosis || 'Decision received'}</div>
              <div className="mt-2 inline-flex max-w-full rounded bg-slate-950 px-2 py-1 font-mono text-xs text-orange-200">
                {entry.action || 'observe'}
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-300">
                {/* # FIX: Animate only the newest reasoning text so older log cards remain readable. */}
                <span className={idx === 0 ? 'typewriter' : ''}>{visibleReasoning}</span>
              </p>
              {shouldTruncate && (
                <button
                  type="button"
                  className="mt-1 text-xs font-semibold text-cyan-300 hover:text-cyan-100"
                  onClick={() => setExpanded((prev) => ({ ...prev, [key]: !isExpanded }))}
                >
                  {isExpanded ? 'Show less' : 'Expand'}
                </button>
              )}
            </article>
          )
        })}
        {entries.length === 0 && (
          <div className="flex min-h-48 items-center justify-center text-sm text-slate-500">
            <span className="subtle-pulse">Waiting for agent decisions...</span>
          </div>
        )}
      </div>
    </section>
  )
}
