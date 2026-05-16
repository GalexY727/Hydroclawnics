import { useState } from 'react'

const REASONING_PREVIEW_CHARS = 150

function colorForAction(action = '') {
  const normalized = action.toLowerCase()
  if (normalized.includes('dose_ph_up') || normalized.includes('dose_ph_down')) return 'var(--color-info)'
  if (normalized.includes('nutrient')) return 'var(--color-warning)'
  if (normalized.includes('heat')) return 'var(--color-critical)'
  if (normalized.includes('alert')) return 'var(--color-neutral)'
  return 'var(--color-muted)'
}

function formatTime(timestamp) {
  const date = timestamp ? new Date(timestamp) : new Date()
  if (Number.isNaN(date.getTime())) return `${timestamp || ''}`.slice(0, 8) || '--:--'
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

const STATUS_DOT_COLOR = { healthy: 'var(--color-success)', warning: 'var(--color-warning)', critical: 'var(--color-critical)' }

export default function AgentLog({ entries, pods = {} }) {
  const [expanded, setExpanded] = useState({})

  return (
    <section className="flex h-full min-h-0 flex-col rounded-lg border p-3" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
      <h2 className="mb-3 shrink-0 text-sm font-medium" style={{ color: 'var(--color-muted)' }}>
        Agent Reasoning Feed
      </h2>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {entries.length === 0 ? (
          <div className="flex min-h-64 items-center justify-center text-center text-xs italic" style={{ color: 'var(--color-muted)' }}>
            Waiting for agent decisions...
          </div>
        ) : (
          entries.map((entry, idx) => {
            const key = `${entry.timestamp}-${entry.pod_id}-${idx}`
            const reasoning = `${entry.reasoning || ''}`
            const isExpanded = Boolean(expanded[key])
            const shouldTruncate = reasoning.length > REASONING_PREVIEW_CHARS
            const visibleReasoning = isExpanded || !shouldTruncate ? reasoning : `${reasoning.slice(0, REASONING_PREVIEW_CHARS)}`

            return (
              <article key={key} className="log-entry border-b py-3 first:pt-0 last:border-b-0" style={{ borderColor: 'var(--color-border)' }}>
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  {(() => {
                    const podStatus = entry.pod_id ? pods[entry.pod_id]?.status : null
                    return podStatus ? (
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: STATUS_DOT_COLOR[podStatus] || STATUS_DOT_COLOR.healthy }} />
                    ) : null
                  })()}
                  <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
                    {formatTime(entry.timestamp)}
                  </span>
                  <span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: 'var(--color-surface-2)', color: 'var(--color-muted)' }}>
                    {entry.pod_id || 'pod'}
                  </span>
                </div>

                <div className="text-[13px] font-bold leading-5" style={{ color: 'var(--color-text)' }}>
                  {entry.diagnosis || 'Decision received'}
                </div>

                <div className="mt-1.5 max-w-full truncate font-mono text-xs" style={{ color: colorForAction(entry.action) }}>
                  {entry.action || 'observe'}
                </div>

                <p className="mt-1.5 text-xs leading-5" style={{ color: 'var(--color-muted)' }}>
                  <span className={idx === 0 ? 'typewriter' : ''}>{visibleReasoning || 'No reasoning supplied.'}</span>
                  {shouldTruncate && !isExpanded ? (
                    <>
                      <span>...</span>{' '}
                      <button type="button" className="font-semibold" style={{ color: 'var(--color-info)' }} onClick={() => setExpanded((prev) => ({ ...prev, [key]: true }))}>
                        more
                      </button>
                    </>
                  ) : null}
                </p>

                {shouldTruncate && isExpanded ? (
                  <button type="button" className="mt-1 text-xs font-semibold" style={{ color: 'var(--color-info)' }} onClick={() => setExpanded((prev) => ({ ...prev, [key]: false }))}>
                    less
                  </button>
                ) : null}
              </article>
            )
          })
        )}
      </div>
    </section>
  )
}
