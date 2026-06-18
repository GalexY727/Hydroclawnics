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

function AuditLog({ events, pods, incidents, onIncidentSelect }) {
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
            <h1 className="text-xl font-semibold">Audit Log</h1>
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

function ChatText({ text }) {
  const blocks = text.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean)
  if (!blocks.length) return null

  return (
    <div className="mt-2 space-y-3 text-sm leading-6">
      {blocks.map((block, blockIndex) => {
        const lines = block.split('\n').map((line) => line.trim()).filter(Boolean)
        const isList = lines.length > 1 && lines.every((line) => /^[-*]\s+/.test(line) || /^\d+[.)]\s+/.test(line))
        if (isList) {
          return (
            <ul key={`${blockIndex}-${block}`} className="list-disc space-y-1 pl-5">
              {lines.map((line) => (
                <li key={line}>{line.replace(/^[-*]\s+/, '').replace(/^\d+[.)]\s+/, '')}</li>
              ))}
            </ul>
          )
        }
        return <p key={`${blockIndex}-${block}`} className="whitespace-pre-wrap">{block}</p>
      })}
    </div>
  )
}

function ChatBubble({ message }) {
  const isUser = message.role === 'user'
  return (
    <article className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className="max-w-[min(780px,92%)] rounded-md border px-4 py-3 shadow-sm"
        style={{
          borderColor: isUser ? 'rgba(108, 195, 255, 0.42)' : 'var(--color-border)',
          background: isUser ? 'rgba(108, 195, 255, 0.1)' : 'var(--color-surface)',
        }}
      >
        <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase" style={{ color: isUser ? 'var(--color-info)' : 'var(--color-muted)' }}>
          <span>{isUser ? 'You' : 'Supervisor'}</span>
          {message.model && <span className="normal-case" style={{ color: 'var(--color-muted)' }}>{message.model}</span>}
        </div>
        <ChatText text={message.content} />
      </div>
    </article>
  )
}

function AnalyticsPage({ pods, events, incidents }) {
  const computed = useMemo(() => buildAnalytics(pods, events), [events, pods])
  const cropStability = useMemo(() => computed.byCrop.map((row) => {
    const cropIncidents = incidents.filter((incident) => incident.crop === row.crop && incident.status === 'active')
    const activeProblem = cropIncidents[0]
    const state = row.faults > 0 || activeProblem ? 'attention' : 'healthy'
    return {
      ...row,
      state,
      summary: state === 'healthy'
        ? `Healthy. Average pH ${row.ph}, average EC ${row.ec}, and no active crop faults.`
        : `${row.faults} pod(s) need attention${activeProblem ? `: ${activeProblem.title} on ${activeProblem.podId}` : ''}.`,
    }
  }), [computed.byCrop, incidents])
  const patterns = useMemo(() => {
    const activeCount = incidents.filter((incident) => incident.status === 'active').length
    const reservoirCounts = incidents.reduce((acc, incident) => {
      const key = `${incident.crop} / ${incident.reservoir}`
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})
    const recurringReservoir = Object.entries(reservoirCounts)
      .sort((a, b) => b[1] - a[1])
      .find(([, count]) => count > 1)
    const items = [
      `${activeCount} incident(s) currently active`,
      recurringReservoir ? `${recurringReservoir[0]} has repeated incident history` : 'No reservoir has more than one recent incident',
      incidents.some((incident) => incident.title.toLowerCase().includes('ph')) ? 'pH drift appears in recent incident evidence' : 'pH is not the leading recent pattern',
      incidents.some((incident) => incident.title.toLowerCase().includes('humidity')) ? 'Humidity recovery is under verification' : 'Humidity is not showing repeated incident pressure',
    ]
    return items
  }, [incidents])
  const chatContext = useMemo(() => ({
    analytics: computed,
    patterns,
    cropStability,
    incidents: incidents.slice(0, 6).map((incident) => ({
      title: incident.title,
      podId: incident.podId,
      crop: incident.crop,
      zone: incident.zone,
      reservoir: incident.reservoir,
      status: incident.status,
      lifecycle: incident.lifecycle,
      severity: incident.severity,
      evidence: incident.evidence,
      action: incident.action,
      result: incident.result,
    })),
  }), [computed, cropStability, incidents, patterns])
  const exampleQuestions = useMemo(() => {
    const activeIncident = incidents.find((incident) => incident.status === 'active')
    const recentIncident = incidents[0]
    return [
      activeIncident
        ? `What is the likely cause of ${activeIncident.title} on ${activeIncident.podId}?`
        : 'Do any recent incidents suggest a hidden problem?',
      'Which recurring pattern should I fix first?',
      'Are any crop groups unhealthy right now?',
      recentIncident
        ? `Could ${recentIncident.title} be a sensor error?`
        : 'Do the trends look like sensor error or real crop stress?',
    ]
  }, [incidents])
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [chatError, setChatError] = useState('')
  const [modelLabel, setModelLabel] = useState('Supervisor agent')
  const transcriptRef = useRef(null)
  const draftRef = useRef(null)
  const hasUserMessage = messages.some((message) => message.role === 'user')

  useEffect(() => {
    let mounted = true
    fetch('/agent/status')
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (mounted && data?.supervisor_model) {
          setModelLabel(`Supervisor agent / ${data.supervisor_model}`)
        }
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    const transcript = transcriptRef.current
    if (!transcript) return
    window.requestAnimationFrame(() => {
      transcript.scrollTo({ top: transcript.scrollHeight, behavior: 'smooth' })
    })
  }, [messages, isSending])

  const sendQuestion = useCallback(async (question) => {
    const text = question.trim()
    if (!text || isSending) return
    const userMessage = { id: `${Date.now()}-user`, role: 'user', content: text }
    setMessages((current) => [...current, userMessage])
    setDraft('')
    setChatError('')
    setIsSending(true)
    try {
      const response = await fetch('/api/analytics/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: text,
          context: chatContext,
          history: messages.map(({ role, content }) => ({ role, content })),
        }),
      })
      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}))
        throw new Error(errorPayload.detail || 'Supervisor chat request failed')
      }
      const data = await response.json()
      setModelLabel(data.model ? `Supervisor agent / ${data.model}` : 'Supervisor agent')
      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-assistant`,
          role: 'assistant',
          content: data.reply || 'I could not produce an answer from the current analytics context.',
          model: data.model,
        },
      ])
    } catch (error) {
      setChatError(error.message || 'The supervisor chat is unavailable.')
    } finally {
      setIsSending(false)
      window.requestAnimationFrame(() => draftRef.current?.focus())
    }
  }, [chatContext, isSending, messages])

  const handleSubmit = useCallback((event) => {
    event.preventDefault()
    sendQuestion(draft)
  }, [draft, sendQuestion])

  const handleDraftKeyDown = useCallback((event) => {
    event.stopPropagation()
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      sendQuestion(draft)
    }
  }, [draft, sendQuestion])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <section className="app-panel flex min-h-0 flex-1 flex-col rounded-md">
        <header className="border-b p-4" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold">Analytics Chat</h1>
              <p className="mt-1 text-sm" style={{ color: 'var(--color-muted)' }}>{modelLabel}</p>
            </div>
            <div className="rounded-md border px-3 py-2 text-sm" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
              Health {computed.healthScore}% / {computed.activeFaults} active fault(s)
            </div>
          </div>
        </header>

        <div ref={transcriptRef} className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="mx-auto flex max-w-5xl flex-col gap-4">
            <article className="max-w-4xl rounded-md border p-4 shadow-sm" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase" style={{ color: 'var(--color-info)' }}>
                <span>Supervisor</span>
                <span style={{ color: 'var(--color-muted)' }}>current analytics snapshot</span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ['Farm health', `${computed.healthScore}%`],
                  ['Active faults', computed.activeFaults],
                  ['Incidents', computed.incidentCount],
                  ['Avg recovery', `${computed.avgRecoveryMin} min`],
                ].map(([label, value]) => (
                  <div key={label} className="border-l-2 pl-3" style={{ borderColor: 'var(--color-info)' }}>
                    <div className="text-xs uppercase" style={{ color: 'var(--color-muted)' }}>{label}</div>
                    <div className="mt-1 text-xl font-semibold">{value}</div>
                  </div>
                ))}
              </div>
              <div className="mt-5 space-y-5 text-sm leading-6" style={{ color: 'var(--color-muted)' }}>
                <section>
                  <div className="font-semibold" style={{ color: 'var(--color-text)' }}>Snapshot</div>
                  <p>
                    {computed.resolved} resolved incident(s), {computed.successRate}% intervention success, and {computed.sensorReliability}% sensor reliability.
                  </p>
                </section>
                <section>
                  <div className="font-semibold" style={{ color: 'var(--color-text)' }}>Recurring patterns</div>
                  <ul className="mt-2 space-y-1">
                    {patterns.map((pattern) => <li key={pattern}>{pattern}</li>)}
                  </ul>
                </section>
                <section>
                  <div className="font-semibold" style={{ color: 'var(--color-text)' }}>Crop stability summary</div>
                  <div className="mt-2 divide-y" style={{ borderColor: 'var(--color-border)' }}>
                    {cropStability.map((crop) => (
                      <div key={crop.crop} className="py-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="capitalize font-semibold" style={{ color: 'var(--color-text)' }}>{crop.crop}</span>
                          <span className={`severity-chip severity-${crop.state === 'healthy' ? 'normal' : 'warning'}`}>{crop.state}</span>
                        </div>
                        <p className="mt-2">{crop.summary}</p>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </article>

            {messages.map((message) => <ChatBubble key={message.id} message={message} />)}

            {isSending && (
              <article className="flex justify-start">
                <div className="max-w-[min(780px,92%)] rounded-md border px-4 py-3 text-sm" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-muted)' }}>
                  Supervisor is reading the latest analytics context...
                </div>
              </article>
            )}
          </div>
        </div>

        <footer className="border-t p-4" style={{ borderColor: 'var(--color-border)' }}>
          <div className="mx-auto max-w-5xl">
            {!hasUserMessage && (
            <div className="mb-3 flex flex-wrap gap-2">
              {exampleQuestions.map((question) => (
                <button
                  key={question}
                  type="button"
                  onClick={() => sendQuestion(question)}
                  disabled={isSending}
                  className="rounded-md border px-3 py-2 text-left text-sm"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)' }}
                >
                  {question}
                </button>
              ))}
            </div>
            )}
            <form onSubmit={handleSubmit} className="flex gap-2">
              <textarea
                ref={draftRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleDraftKeyDown}
                placeholder="Ask about trends, possible errors, or crop stability"
                rows={1}
                className="max-h-32 min-h-11 flex-1 resize-none rounded-md border px-3 py-3 text-sm leading-5"
                style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
              />
              <button
                type="submit"
                disabled={isSending || !draft.trim()}
                className="min-h-11 rounded-md border px-4 text-sm font-semibold"
                style={{ borderColor: 'var(--color-info)', background: 'rgba(108, 195, 255, 0.14)', color: 'var(--color-text)' }}
              >
                Send
              </button>
            </form>
            {chatError && <p className="mt-2 text-xs" style={{ color: 'var(--color-warning)' }}>{chatError}</p>}
          </div>
        </footer>
      </section>
    </div>
  )
}

const FEED_WIDTH_KEY = 'hydroclawnics.operationsFeedWidth'
const FEED_MIN = 292
const FEED_MAX = 620

function initialFeedWidth() {
  if (typeof window === 'undefined') return 360
  const stored = Number(window.localStorage.getItem(FEED_WIDTH_KEY))
  return Number.isFinite(stored) ? Math.max(FEED_MIN, Math.min(FEED_MAX, stored)) : 360
}

function ResizableDashboardLayout({ children, drawerOpen, feed }) {
  const shellRef = useRef(null)
  const [feedWidth, setFeedWidth] = useState(initialFeedWidth)

  const startResize = useCallback((event) => {
    event.preventDefault()
    const shell = shellRef.current
    if (!shell) return
    const rect = shell.getBoundingClientRect()

    const onPointerMove = (moveEvent) => {
      const availableMax = Math.min(FEED_MAX, Math.round(rect.width * 0.42))
      const next = Math.round(rect.right - moveEvent.clientX)
      setFeedWidth(Math.max(FEED_MIN, Math.min(availableMax, next)))
    }

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      const width = shellRef.current?.querySelector('[data-feed-pane]')?.getBoundingClientRect().width
      if (width) window.localStorage.setItem(FEED_WIDTH_KEY, `${Math.round(width)}`)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }, [])

  return (
    <div ref={shellRef} className="relative flex min-h-0 flex-1 overflow-hidden">
      <main className="min-w-0 flex-1 overflow-hidden p-3">
        {children}
      </main>

      {drawerOpen && (
        <aside
          data-feed-pane
          className="operations-feed-pane hidden shrink-0 border-l p-3 lg:block"
          style={{ width: feedWidth, borderColor: 'var(--color-border-strong)', background: 'var(--color-panel)' }}
        >
          <button type="button" className="feed-resize-handle" onPointerDown={startResize} aria-label="Resize operations feed" title="Resize operations feed" />
          {feed}
        </aside>
      )}

      {drawerOpen && (
        <aside
          className="fixed inset-x-3 bottom-3 top-[76px] z-20 border p-3 shadow-2xl lg:hidden"
          style={{ borderColor: 'var(--color-border-strong)', background: 'var(--color-panel)' }}
        >
          {feed}
        </aside>
      )}
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
          <ResizableDashboardLayout
            drawerOpen={drawerOpen}
            feed={(
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
            )}
          >
            {tab === 'overview' && (
              <div key="overview" className="tab-enter h-full">
                <PodGrid
                  pods={pods}
                  events={events}
                  onSelect={setDetailPodId}
                  onSimulateFault={injectFault}
                  simulationMessage={simulationMessage}
                  incidents={incidents}
                  activeIncident={activeIncident}
                  agentStatus={agentStatus}
                  onIncidentSelect={handleIncidentSelect}
                />
              </div>
            )}
            {tab === 'auditlog' && (
              <div key="auditlog" className="tab-enter h-full">
                <AuditLog events={events} pods={pods} incidents={incidents} onIncidentSelect={handleIncidentSelect} />
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
          </ResizableDashboardLayout>
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
