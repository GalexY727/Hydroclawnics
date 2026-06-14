import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AgentLog from '../components/AgentLog'
import AgentActivityFeed from '../components/automation/AgentActivityFeed'
import Farm3D from '../components/farm/Farm3D'
import Navbar from '../components/layout/Navbar'
import PodDetailModal from '../components/pods/PodDetailModal'
import PodGrid from '../components/pods/PodGrid'
import SettingsPanel from '../components/settings/SettingsPanel'
import useWebSocket from '../hooks/useWebSocket'
import {
  FAULT_TYPES,
  LIFECYCLE_STEPS,
  POLICY_DEFAULTS,
  advanceFaultPod,
  applyFaultToPod,
  buildAnalytics,
  buildIncidents,
  buildMockPods,
  buildSeedEvents,
  makeEvent,
  makeIncidentId,
  mergeLivePods,
  summarizeFarm,
} from '../data/operations'

function HistoryEventsPage({ events, pods, incidents, onIncidentSelect }) {
  const [severity, setSeverity] = useState('all')
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => events.filter((event) => {
    const matchesSeverity = severity === 'all' || event.severity === severity
    const haystack = `${event.podId} ${event.zone} ${event.reservoir} ${event.crop} ${event.issue} ${event.action}`.toLowerCase()
    return matchesSeverity && haystack.includes(query.toLowerCase())
  }), [events, query, severity])

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      <div className="app-panel rounded-md p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold">History / Events</h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--color-muted)' }}>
              Audit trail for readings, anomalies, decisions, manual actions, interventions, and verification results.
            </p>
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter pod, crop, zone, reservoir"
            className="min-h-10 w-full rounded-md border px-3 text-sm sm:w-72"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
          />
          <select
            value={severity}
            onChange={(event) => setSeverity(event.target.value)}
            className="min-h-10 rounded-md border px-3 text-sm"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
          >
            {['all', 'critical', 'warning', 'info', 'normal'].map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-md border" style={{ borderColor: 'var(--color-border)' }}>
        {incidents.length > 0 && (
          <div className="grid gap-3 border-b p-4 lg:grid-cols-2" style={{ borderColor: 'var(--color-border)', background: 'rgba(8, 13, 20, 0.7)' }}>
            {incidents.slice(0, 4).map((incident) => (
              <button
                key={incident.id}
                type="button"
                onClick={() => onIncidentSelect?.(incident)}
                className="rounded-md border p-3 text-left"
                style={{ borderColor: incident.status === 'active' ? 'var(--color-info)' : 'var(--color-border)', background: 'var(--color-surface)' }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`severity-chip severity-${incident.severity}`}>{incident.severity}</span>
                  <span className="text-xs" style={{ color: 'var(--color-muted)' }}>{incident.lifecycle}</span>
                </div>
                <div className="mt-2 text-sm font-semibold">{incident.title}</div>
                <div className="mt-1 text-xs" style={{ color: 'var(--color-muted)' }}>{incident.podId} / {incident.zone} / {incident.reservoir}</div>
              </button>
            ))}
          </div>
        )}
        {filtered.map((event) => {
          const pod = pods[event.podId]
          return (
            <article key={event.id} className="grid gap-3 border-b p-4 md:grid-cols-[150px_1fr_150px]" style={{ borderColor: 'var(--color-border)', background: 'rgba(16, 24, 34, 0.72)' }}>
              <div className="text-xs" style={{ color: 'var(--color-muted)' }}>
                <div>{new Date(event.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
                <div className="mt-2 font-mono">{event.lifecycle}</div>
              </div>
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                  <span className={`severity-chip severity-${event.severity}`}>{event.severity}</span>
                  <span style={{ color: 'var(--color-muted)' }}>{event.podId} / {event.zone} / {event.reservoir}</span>
                </div>
                <h2 className="text-sm font-semibold">{event.issue}</h2>
                <p className="mt-1 text-sm leading-6" style={{ color: 'var(--color-muted)' }}>
                  Evidence: {event.evidence}. Diagnosis: {event.diagnosis}. Action: {event.action}. Result: {event.result}.
                </p>
              </div>
              <div className="text-xs md:text-right" style={{ color: 'var(--color-muted)' }}>
                <div>{pod?.crop || event.crop}</div>
                <div className="mt-2">Confidence {event.confidence}%</div>
                <div>Risk {event.risk}</div>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}

function AnalyticsPage({ pods, events, incidents }) {
  const computed = useMemo(() => buildAnalytics(pods, events), [events, pods])

  return (
    <div className="h-full overflow-y-auto">
      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="app-panel rounded-md p-4">
          <h1 className="text-xl font-semibold">Analytics</h1>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[
              ['Farm health', `${computed.healthScore}%`],
              ['Active faults', computed.activeFaults],
              ['Incidents', computed.incidentCount],
              ['Resolved', computed.resolved],
              ['Avg recovery', `${computed.avgRecoveryMin} min`],
              ['Success rate', `${computed.successRate}%`],
              ['Sensor reliability', `${computed.sensorReliability}%`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md border p-4" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
                <div className="text-xs uppercase" style={{ color: 'var(--color-muted)' }}>{label}</div>
                <div className="mt-2 text-2xl font-semibold">{value}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="app-panel rounded-md p-4">
          <h2 className="text-base font-semibold">Recurring Patterns</h2>
          <div className="mt-4 space-y-3">
            {[
              `${incidents.filter((incident) => incident.status === 'active').length} incident(s) currently active`,
              'pH drift clusters in tomato reservoir R-01',
              'Humidity lows repeat after afternoon venting',
            ].map((item, index) => (
              <div key={item} className="flex items-center gap-3 rounded-md border p-3" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
                <span className="grid h-8 w-8 place-items-center rounded-md font-mono text-sm" style={{ background: 'var(--color-surface-2)', color: 'var(--color-info)' }}>{index + 1}</span>
                <span className="text-sm" style={{ color: 'var(--color-muted)' }}>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="app-panel rounded-md p-4 xl:col-span-2">
          <h2 className="text-base font-semibold">Stability By Crop</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {computed.byCrop.map((row) => (
              <div key={row.crop} className="rounded-md border p-3" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
                <div className="capitalize">{row.crop}</div>
                <div className="mt-3 space-y-2 text-sm" style={{ color: 'var(--color-muted)' }}>
                  <div className="flex justify-between"><span>Avg pH</span><strong>{row.ph}</strong></div>
                  <div className="flex justify-between"><span>Avg EC</span><strong>{row.ec}</strong></div>
                  <div className="flex justify-between"><span>Faults</span><strong>{row.faults}</strong></div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

export default function App() {
  const { pods: livePods, agentLog, agentCycles, podAgentUpdates, connectionStatus } = useWebSocket()
  const [tab, setTab] = useState('overview')
  const [detailPodId, setDetailPodId] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(true)
  const [autoTrackingPodId, setAutoTrackingPodId] = useState(null)
  const [pods, setPods] = useState(() => buildMockPods())
  const [policy, setPolicy] = useState(POLICY_DEFAULTS)
  const [events, setEvents] = useState(() => buildSeedEvents(buildMockPods()))
  const [simulationMessage, setSimulationMessage] = useState('Ready')
  const [activeIncidentId, setActiveIncidentId] = useState(null)
  const [agentTick, setAgentTick] = useState(0)
  const timersRef = useRef([])

  useEffect(() => {
    setPods((current) => mergeLivePods(current, livePods))
  }, [livePods])

  useEffect(() => () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer))
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => setAgentTick((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const podList = useMemo(() => Object.values(pods), [pods])

  const farmSummary = useMemo(() => summarizeFarm(pods, events), [events, pods])
  const healthSummary = farmSummary.counts
  const incidents = useMemo(() => buildIncidents(events, pods), [events, pods])
  const activeIncident = useMemo(
    () => incidents.find((incident) => incident.id === activeIncidentId) || incidents.find((incident) => incident.status === 'active') || incidents[0] || null,
    [activeIncidentId, incidents],
  )
  const agentStatus = useMemo(() => {
    const list = podList.length ? podList : []
    const index = list.length ? agentTick % list.length : 0
    const scanningPod = list[index] || null
    const pendingVerification = incidents.filter((incident) => incident.lifecycle === 'verifying').length
    return {
      scanningPodId: scanningPod?.id || null,
      scanningZone: scanningPod?.zone || 'No zone',
      cycleProgress: list.length ? Math.round(((index + 1) / list.length) * 100) : 0,
      nextCheckSeconds: 12 - (agentTick % 12),
      pendingVerification,
      activePolicy: policy.requireApproval ? 'Human approval for severe actions' : 'Autonomous within limits',
      lastResult: incidents[0]?.result || 'No interventions in current cycle',
    }
  }, [agentTick, incidents, podList, policy.requireApproval])

  const handleAutoOrbitPodId = useCallback((podId) => {
    setAutoTrackingPodId(podId)
  }, [])

  const handleIncidentSelect = useCallback((incident) => {
    if (!incident) return
    setActiveIncidentId(incident.id)
    setDetailPodId(incident.podId)
    setAutoTrackingPodId(incident.podId)
  }, [])

  const injectFault = useCallback((faultId, podId) => {
    const fault = FAULT_TYPES.find((item) => item.id === faultId) || FAULT_TYPES[0]
    const candidates = podList.filter((pod) => pod.id !== 'pod_00')
    const target = pods[podId] || candidates[Math.floor(Math.random() * candidates.length)] || podList[0]
    if (!target) return

    const incidentId = makeIncidentId(target, fault)
    const detectedPod = applyFaultToPod(target, fault, 'detected')
    setPods((current) => ({ ...current, [target.id]: detectedPod }))
    setEvents((current) => [makeEvent({ pod: detectedPod, fault, lifecycle: 'detected', incidentId }), ...current].slice(0, 120))
    setActiveIncidentId(incidentId)
    setAutoTrackingPodId(target.id)
    setDetailPodId(target.id)
    setSimulationMessage(`${fault.label} injected on ${target.id}`)

    const lifecycle = LIFECYCLE_STEPS.slice(1)
    lifecycle.forEach((step, index) => {
      const timer = window.setTimeout(() => {
        let eventToAdd = null
        setPods((current) => {
          const active = current[target.id]
          if (!active) return current
          const nextPod = advanceFaultPod(active, fault, step)
          eventToAdd = makeEvent({
            pod: nextPod,
            fault,
            lifecycle: step,
            incidentId,
            action: step === 'diagnosing' ? 'Cross-checking reservoir and sensor trend' : fault.action,
            result: step === 'resolved' ? 'Verified back inside target range' : 'Lifecycle progressing',
          })
          return { ...current, [target.id]: nextPod }
        })
        if (eventToAdd) {
          setEvents((existing) => [eventToAdd, ...existing].slice(0, 120))
        }
      }, (index + 1) * 1900)
      timersRef.current.push(timer)
    })
  }, [podList, pods])

  const isFarmTab = tab === 'farm'
  const isAutomationTab = tab === 'automation'

  // Farm3D is always mounted to preserve the WebGL context.
  const farmStyle = isFarmTab
    ? { flex: 1, minHeight: 0, padding: 16 }
    : isAutomationTab
      ? { flex: '1 1 58%', minHeight: 0, padding: 16 }
      : { position: 'fixed', left: -9999, top: 0, width: 1, height: 1, overflow: 'hidden', pointerEvents: 'none' }

  return (
    <div className="flex h-screen flex-col overflow-hidden" style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
      <Navbar
        connectionStatus={connectionStatus}
        healthSummary={healthSummary}
        farmSummary={farmSummary}
        tab={tab}
        onTabChange={(t) => { setTab(t); if (t !== 'automation') setAutoTrackingPodId(null) }}
        drawerOpen={drawerOpen}
        onDrawerToggle={() => setDrawerOpen(o => !o)}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden max-xl:flex-col">
        {/* Farm3D — always mounted, CSS-positioned per tab */}
        <div style={farmStyle}>
          <Farm3D
            pods={pods}
            onPodSelect={setDetailPodId}
            onClose={() => setTab('overview')}
            agentEvents={podAgentUpdates}
            events={events}
            activeIncident={activeIncident}
            scanPodId={agentStatus.scanningPodId}
            isAutomationTab={isAutomationTab}
            autoTrackingPodId={autoTrackingPodId}
            onAutoOrbitPodId={handleAutoOrbitPodId}
          />
        </div>

        {/* Overview / Settings content */}
        {!isAutomationTab && !isFarmTab && (
          <main className="min-h-0 flex-1 overflow-hidden p-4">
            {tab === 'overview' && (
              <div key="overview" className="tab-enter h-full">
                <PodGrid
                  pods={pods}
                  events={events}
                  summary={farmSummary}
                  connectionStatus={connectionStatus}
                  onSelect={setDetailPodId}
                  onSimulateFault={injectFault}
                  simulationMessage={simulationMessage}
                  policy={policy}
                  incidents={incidents}
                  activeIncident={activeIncident}
                  agentStatus={agentStatus}
                  onIncidentSelect={handleIncidentSelect}
                />
              </div>
            )}
            {tab === 'history' && (
              <div key="history" className="tab-enter h-full">
                <HistoryEventsPage events={events} pods={pods} incidents={incidents} onIncidentSelect={handleIncidentSelect} />
              </div>
            )}
            {tab === 'analytics' && (
              <div key="analytics" className="tab-enter h-full">
                <AnalyticsPage pods={pods} events={events} incidents={incidents} />
              </div>
            )}
            {tab === 'settings' && (
              <div key="settings" className="tab-enter h-full overflow-y-auto">
                <SettingsPanel pods={pods} connectionStatus={connectionStatus} policy={policy} setPolicy={setPolicy} />
              </div>
            )}
          </main>
        )}

        {/* Automation right panel (40%) */}
        {isAutomationTab && (
          <div
            className="automation-side shrink-0 overflow-y-auto p-4"
            style={{ flex: '0 0 42%', minHeight: 0, borderLeft: '1px solid var(--color-border-strong)', background: 'var(--color-panel)' }}
          >
            <AgentActivityFeed
              agentCycles={agentCycles}
              connectionStatus={connectionStatus}
              pods={pods}
              events={events}
              incidents={incidents}
              activeIncident={activeIncident}
              agentStatus={agentStatus}
              policy={policy}
              setPolicy={setPolicy}
              onSimulateFault={injectFault}
              simulationMessage={simulationMessage}
            />
          </div>
        )}

        {/* AgentLog drawer — hidden on automation tab */}
        {drawerOpen && !isAutomationTab && (
          <aside
            className="drawer-open hidden shrink-0 border-l p-4 lg:block"
            style={{ width: 340, borderColor: 'var(--color-border-strong)', background: 'var(--color-panel)' }}
          >
            <AgentLog
              entries={agentLog}
              events={events}
              incidents={incidents}
              activeIncident={activeIncident}
              agentStatus={agentStatus}
              connectionStatus={connectionStatus}
              pods={pods}
              onIncidentSelect={handleIncidentSelect}
            />
          </aside>
        )}
      </div>

      <PodDetailModal
        pod={detailPodId ? pods[detailPodId] : null}
        agentLog={agentLog}
        events={events}
        onManualAction={(action) => {
          const pod = pods[detailPodId]
          if (!pod) return
          setEvents((current) => [makeEvent({ pod, lifecycle: 'manual_action', action, result: 'Awaiting operator confirmation' }), ...current].slice(0, 120))
        }}
        onClose={() => setDetailPodId(null)}
      />
    </div>
  )
}
