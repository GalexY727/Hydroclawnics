function formatTime(timestamp) {
  const date = timestamp ? new Date(timestamp) : new Date()
  if (Number.isNaN(date.getTime())) return '--:--'
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function EventItem({ event, compact = false }) {
  return (
    <article className="rounded-md border p-3" style={{ borderColor: 'var(--color-border)', background: 'rgba(8, 13, 20, 0.58)' }}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className={`severity-chip severity-${event.severity}`}>{event.severity}</span>
        <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>{formatTime(event.timestamp)}</span>
      </div>
      <div className="text-sm font-semibold">{event.issue}</div>
      <div className="mt-1 text-xs" style={{ color: 'var(--color-muted)' }}>{event.podId} / {event.zone}</div>
      {!compact && (
        <p className="mt-2 text-xs leading-5" style={{ color: 'var(--color-muted)' }}>
          Evidence: {event.evidence}. Action: {event.action}. Result: {event.result}.
        </p>
      )}
      <div className="mt-2 flex items-center justify-between text-[11px]" style={{ color: 'var(--color-muted)' }}>
        <span>{event.lifecycle}</span>
        <span>{event.confidence}% confidence</span>
      </div>
    </article>
  )
}

export default function AgentLog({ entries = [], events = [], pods = {} }) {
  const active = events.filter((event) => ['critical', 'warning'].includes(event.severity) && event.lifecycle !== 'resolved').slice(0, 4)
  const recent = events.filter((event) => event.eventType === 'intervention').slice(0, 4)
  const summaries = events.filter((event) => event.eventType === 'summary' || event.lifecycle === 'stable').slice(0, 3)
  const audit = events.slice(0, 16)
  const stableCount = Object.values(pods).filter((pod) => pod.status === 'healthy').length
  const activeCount = Object.values(pods).length - stableCount

  return (
    <section className="flex h-full min-h-0 flex-col rounded-md border p-4" style={{ borderColor: 'var(--color-border-strong)', background: 'var(--color-surface)' }}>
      <div className="mb-4 shrink-0">
        <h2 className="text-base font-semibold">Operations Feed</h2>
        <p className="mt-1 text-xs" style={{ color: 'var(--color-muted)' }}>
          {Object.values(pods).length} pods scanned. {stableCount} stable. {activeCount} need attention.
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase" style={{ color: 'var(--color-muted)' }}>Now</h3>
          <div className="space-y-2">
            {active.length ? active.map((event) => <EventItem key={event.id} event={event} compact />) : (
              <div className="rounded-md border p-3 text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>
                No active faults. Agent is monitoring drift and verification windows.
              </div>
            )}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase" style={{ color: 'var(--color-muted)' }}>Recent Interventions</h3>
          <div className="space-y-2">
            {recent.map((event) => <EventItem key={event.id} event={event} />)}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase" style={{ color: 'var(--color-muted)' }}>System Summaries</h3>
          <div className="space-y-2">
            {summaries.map((event) => <EventItem key={event.id} event={event} compact />)}
            {entries[0] && (
              <div className="rounded-md border p-3 text-xs leading-5" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>
                Backend agent: {entries[0].diagnosis || entries[0].reasoning || 'Decision received'}
              </div>
            )}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase" style={{ color: 'var(--color-muted)' }}>Audit Log</h3>
          <div className="space-y-2">
            {audit.map((event) => <EventItem key={event.id} event={event} compact />)}
          </div>
        </section>
      </div>
    </section>
  )
}
