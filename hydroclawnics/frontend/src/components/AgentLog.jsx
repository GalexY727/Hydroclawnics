import { useState } from 'react'

function formatTime(timestamp) {
  const date = timestamp ? new Date(timestamp) : new Date()
  if (Number.isNaN(date.getTime())) return '--:--'
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function eventText(event) {
  if (event.lifecycle === 'stable') return event.result || 'Farm scan completed'
  if (event.lifecycle === 'action_applied') return event.action || event.issue
  if (event.lifecycle === 'verifying') return event.result || `Verifying ${event.issue}`
  if (event.lifecycle === 'resolved') return event.result || `${event.issue} resolved`
  return event.issue || event.result || 'Agent activity recorded'
}

function AISentinelFeedItem({ agentStatus, activeIncident, podCount, stableCount }) {
  return (
    <section className="feed-block">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">AI Sentinel</h3>
          <p className="mt-0.5 text-xs leading-5" style={{ color: 'var(--color-muted)' }}>
            Scanning {agentStatus.scanningPodId || '--'} in {agentStatus.scanningZone}. {stableCount} of {podCount} pods stable.
          </p>
        </div>
        <span className="ai-pulse mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: 'var(--color-info)' }} />
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--color-surface-2)' }}>
        <div className="h-full rounded-full" style={{ width: `${agentStatus.cycleProgress}%`, background: 'var(--color-info)' }} />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px]" style={{ color: 'var(--color-muted)' }}>
        <span>Next check <strong style={{ color: 'var(--color-text)' }}>{agentStatus.nextCheckSeconds}s</strong></span>
        <span>Verifying <strong style={{ color: 'var(--color-text)' }}>{agentStatus.pendingVerification}</strong></span>
        <span className="col-span-2 truncate">Current: <strong style={{ color: 'var(--color-text)' }}>{activeIncident?.lifecycle?.replaceAll('_', ' ') || 'routine scan'}</strong></span>
      </div>
    </section>
  )
}

function IncidentFeedCard({ incident, active, expanded, onToggle, onSelect }) {
  const status = incident.lifecycle === 'verifying' ? 'verifying' : incident.severity
  return (
    <article className={`feed-incident ${active ? 'incident-card-active' : ''}`}>
      <button type="button" className="w-full text-left" onClick={() => onSelect?.(incident)}>
        <div className="flex items-center justify-between gap-2">
          <span className={`status-pill status-${status}`}>{incident.lifecycle.replaceAll('_', ' ')}</span>
          <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>{formatTime(incident.timestamp)}</span>
        </div>
        <h4 className="mt-1.5 text-sm font-semibold leading-5">{incident.title}</h4>
        <div className="mt-1 truncate text-xs" style={{ color: 'var(--color-muted)' }}>
          {incident.podId} · {incident.crop} · {incident.zone} · {incident.reservoir}
        </div>
      </button>
      <button type="button" className="mt-2 text-xs font-semibold" style={{ color: 'var(--color-info)' }} onClick={() => onToggle(incident.id)}>
        {expanded ? 'Hide details' : 'Show evidence'}
      </button>
      {expanded && (
        <div className="mt-2 grid gap-1.5 border-t pt-2 text-xs leading-5" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>
          <p><strong style={{ color: 'var(--color-text)' }}>Evidence:</strong> {incident.evidence}</p>
          <p><strong style={{ color: 'var(--color-text)' }}>Action:</strong> {incident.action}</p>
          <p><strong style={{ color: 'var(--color-text)' }}>Verification:</strong> {incident.result}</p>
        </div>
      )}
    </article>
  )
}

function EventRow({ event }) {
  return (
    <div className="event-row">
      <span className="shrink-0 font-mono text-[11px]" style={{ color: 'var(--color-muted)' }}>{formatTime(event.timestamp)}</span>
      <div className="min-w-0">
        <div className="truncate text-xs">{eventText(event)}</div>
        <div className="mt-0.5 truncate text-[11px]" style={{ color: 'var(--color-muted)' }}>
          {event.podId} · {event.zone} · {event.reservoir}
        </div>
      </div>
    </div>
  )
}

function SectionTitle({ children }) {
  return <h3 className="mb-1.5 text-xs font-semibold uppercase" style={{ color: 'var(--color-muted)' }}>{children}</h3>
}

export default function AgentLog({ entries = [], events = [], incidents = [], activeIncident, agentStatus, pods = {}, onIncidentSelect }) {
  const [expanded, setExpanded] = useState({})
  const podList = Object.values(pods)
  const stableCount = podList.filter((pod) => pod.status === 'healthy').length
  const activeIncidents = incidents.filter((incident) => incident.status === 'active')
  const recentResolved = incidents.filter((incident) => incident.status !== 'active').slice(0, 3)
  const recentEvents = [...events].sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0)).slice(0, 8)
  const backendEntry = entries[0]

  const toggle = (id) => setExpanded((current) => ({ ...current, [id]: !current[id] }))

  return (
    <section className="operations-feed flex h-full min-h-0 flex-col rounded-md border" style={{ borderColor: 'var(--color-border-strong)', background: 'var(--color-surface)' }}>
      <header className="shrink-0 border-b p-3" style={{ borderColor: 'var(--color-border)' }}>
        <h2 className="text-base font-semibold">Operations Feed</h2>
        <p className="mt-1 text-xs" style={{ color: 'var(--color-muted)' }}>Live AI activity and incident audit</p>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <section>
          <SectionTitle>Now</SectionTitle>
          <AISentinelFeedItem agentStatus={agentStatus} activeIncident={activeIncident} podCount={podList.length} stableCount={stableCount} />
          {backendEntry && (
            <div className="mt-1.5 rounded-md px-2.5 py-1.5 text-xs leading-5" style={{ background: 'rgba(108, 195, 255, 0.08)', color: 'var(--color-muted)' }}>
              {backendEntry.diagnosis || backendEntry.reasoning || 'Decision received'}
            </div>
          )}
        </section>

        <section>
          <SectionTitle>Active Incidents</SectionTitle>
          <div className="space-y-2">
            {activeIncidents.length ? activeIncidents.map((incident) => (
              <IncidentFeedCard
                key={incident.id}
                incident={incident}
                active={activeIncident?.id === incident.id}
                expanded={Boolean(expanded[incident.id])}
                onToggle={toggle}
                onSelect={onIncidentSelect}
              />
            )) : (
              <div className="feed-empty">No active incidents. Routine scans continue.</div>
            )}
          </div>
        </section>

        <section>
          <SectionTitle>Recent Events</SectionTitle>
          <div className="space-y-1">
            {recentEvents.map((event) => <EventRow key={event.id} event={event} />)}
          </div>
        </section>

        {recentResolved.length > 0 && (
          <section>
            <SectionTitle>Recent Resolved</SectionTitle>
            <div className="space-y-2">
              {recentResolved.map((incident) => (
                <IncidentFeedCard
                  key={incident.id}
                  incident={incident}
                  active={false}
                  expanded={Boolean(expanded[incident.id])}
                  onToggle={toggle}
                  onSelect={onIncidentSelect}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </section>
  )
}
