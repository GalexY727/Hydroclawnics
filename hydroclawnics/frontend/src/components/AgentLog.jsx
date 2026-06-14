import { useState } from 'react'
import { INCIDENT_STAGES } from '../data/operations'

function formatTime(timestamp) {
  const date = timestamp ? new Date(timestamp) : new Date()
  if (Number.isNaN(date.getTime())) return '--:--'
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function IncidentTimeline({ incident }) {
  return (
    <div className="mt-3 grid grid-cols-7 gap-1">
      {INCIDENT_STAGES.map((stage, index) => {
        const complete = incident.lifecycle === 'resolved' || index <= incident.stageIndex || incident.completedStages.has(stage.id)
        return (
          <div key={stage.id} className="min-w-0">
            <div className="h-1.5 rounded-full" style={{ background: complete ? 'var(--color-info)' : 'var(--color-border)' }} />
            <div className="mt-1 truncate text-[9px]" style={{ color: complete ? 'var(--color-text)' : 'var(--color-muted)' }}>
              {stage.label}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function IncidentCard({ incident, active, expanded, onToggle, onSelect }) {
  return (
    <article
      className={`incident-card rounded-md border p-3 ${active ? 'incident-card-active' : ''}`}
      style={{ borderColor: active ? 'var(--color-info)' : 'var(--color-border)', background: 'rgba(8, 13, 20, 0.68)' }}
    >
      <button type="button" className="w-full text-left" onClick={() => onSelect?.(incident)}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className={`severity-chip severity-${incident.severity}`}>{incident.severity}</span>
          <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>{formatTime(incident.timestamp)}</span>
        </div>
        <div className="text-sm font-semibold leading-5">{incident.title}</div>
        <div className="mt-1 text-xs" style={{ color: 'var(--color-muted)' }}>
          {incident.podId} / {incident.crop} / {incident.zone} / {incident.reservoir}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 text-[11px]" style={{ color: 'var(--color-muted)' }}>
          <span className="capitalize">{incident.lifecycle.replaceAll('_', ' ')}</span>
          <span>{incident.confidence}% confidence</span>
        </div>
        <IncidentTimeline incident={incident} />
      </button>

      <div className="mt-3 grid gap-2 text-xs leading-5" style={{ color: 'var(--color-muted)' }}>
        <p><strong style={{ color: 'var(--color-text)' }}>Evidence:</strong> {incident.evidence}</p>
        <p><strong style={{ color: 'var(--color-text)' }}>Action:</strong> {incident.action}</p>
        <p><strong style={{ color: 'var(--color-text)' }}>Verification:</strong> {incident.result}</p>
      </div>

      <button type="button" className="mt-3 text-xs font-semibold" style={{ color: 'var(--color-info)' }} onClick={() => onToggle(incident.id)}>
        {expanded ? 'Hide audit events' : `${incident.events.length} audit events`}
      </button>

      {expanded && (
        <div className="mt-3 space-y-2 border-t pt-3" style={{ borderColor: 'var(--color-border)' }}>
          {incident.events.map((event) => (
            <div key={event.id} className="rounded-md px-2 py-1.5 text-xs" style={{ background: 'rgba(255, 255, 255, 0.035)', color: 'var(--color-muted)' }}>
              <span className="font-mono">{formatTime(event.timestamp)}</span> / {event.lifecycle} / {event.result}
            </div>
          ))}
        </div>
      )}
    </article>
  )
}

function SentinelPanel({ agentStatus, activeIncident, podCount, stableCount }) {
  return (
    <section className="rounded-md border p-3" style={{ borderColor: 'var(--color-border)', background: 'rgba(8, 13, 20, 0.68)' }}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">AI Sentinel</h3>
          <p className="mt-1 text-xs" style={{ color: 'var(--color-muted)' }}>
            {podCount} pods scanned. {stableCount} stable. {activeIncident ? `1 incident ${activeIncident.lifecycle}.` : 'No active incident.'}
          </p>
        </div>
        <span className="ai-pulse h-3 w-3 rounded-full" style={{ background: 'var(--color-info)' }} />
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--color-surface-2)' }}>
        <div className="h-full rounded-full" style={{ width: `${agentStatus.cycleProgress}%`, background: 'linear-gradient(90deg, var(--color-info), var(--color-success))' }} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]" style={{ color: 'var(--color-muted)' }}>
        <span>Scanning <strong style={{ color: 'var(--color-text)' }}>{agentStatus.scanningPodId || '--'}</strong></span>
        <span>Zone <strong style={{ color: 'var(--color-text)' }}>{agentStatus.scanningZone}</strong></span>
        <span>Next check <strong style={{ color: 'var(--color-text)' }}>{agentStatus.nextCheckSeconds}s</strong></span>
        <span>Verify <strong style={{ color: 'var(--color-text)' }}>{agentStatus.pendingVerification}</strong></span>
      </div>
    </section>
  )
}

export default function AgentLog({ entries = [], incidents = [], activeIncident, agentStatus, pods = {}, onIncidentSelect }) {
  const [expanded, setExpanded] = useState({})
  const podList = Object.values(pods)
  const stableCount = podList.filter((pod) => pod.status === 'healthy').length
  const activeIncidents = incidents.filter((incident) => incident.status === 'active')
  const recentResolved = incidents.filter((incident) => incident.status !== 'active').slice(0, 3)

  const toggle = (id) => setExpanded((current) => ({ ...current, [id]: !current[id] }))

  return (
    <section className="flex h-full min-h-0 flex-col rounded-md border p-4" style={{ borderColor: 'var(--color-border-strong)', background: 'var(--color-surface)' }}>
      <div className="mb-4 shrink-0">
        <h2 className="text-base font-semibold">Operations Feed</h2>
        <p className="mt-1 text-xs" style={{ color: 'var(--color-muted)' }}>Incident-centered agent audit stream</p>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        <SentinelPanel agentStatus={agentStatus} activeIncident={activeIncident} podCount={podList.length} stableCount={stableCount} />

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase" style={{ color: 'var(--color-muted)' }}>Active Incidents</h3>
          <div className="space-y-2">
            {activeIncidents.length ? activeIncidents.map((incident) => (
              <IncidentCard
                key={incident.id}
                incident={incident}
                active={activeIncident?.id === incident.id}
                expanded={Boolean(expanded[incident.id])}
                onToggle={toggle}
                onSelect={onIncidentSelect}
              />
            )) : (
              <div className="rounded-md border p-3 text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>
                No active incidents. Normal scans are summarized below.
              </div>
            )}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase" style={{ color: 'var(--color-muted)' }}>System Summary</h3>
          <div className="rounded-md border p-3 text-sm leading-6" style={{ borderColor: 'var(--color-border)', background: 'rgba(8, 13, 20, 0.58)', color: 'var(--color-muted)' }}>
            {podList.length} pods scanned. {stableCount} stable. {activeIncidents.length} incident{activeIncidents.length === 1 ? '' : 's'} active. Last result: {agentStatus.lastResult}
          </div>
        </section>

        {recentResolved.length > 0 && (
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase" style={{ color: 'var(--color-muted)' }}>Recent Resolved</h3>
            <div className="space-y-2">
              {recentResolved.map((incident) => (
                <IncidentCard
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

        {entries[0] && (
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase" style={{ color: 'var(--color-muted)' }}>Backend Agent</h3>
            <div className="rounded-md border p-3 text-xs leading-5" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>
              {entries[0].diagnosis || entries[0].reasoning || 'Decision received'}
            </div>
          </section>
        )}
      </div>
    </section>
  )
}
