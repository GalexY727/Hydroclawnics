import { useMemo, useState, useCallback } from 'react'
import AgentLog from '../components/AgentLog'
import AgentActivityFeed from '../components/automation/AgentActivityFeed'
import Farm3D from '../components/farm/Farm3D'
import Navbar from '../components/layout/Navbar'
import PodDetailModal from '../components/pods/PodDetailModal'
import PodGrid from '../components/pods/PodGrid'
import SettingsPanel from '../components/settings/SettingsPanel'
import useWebSocket from '../hooks/useWebSocket'

export default function App() {
  const { pods, agentLog, agentCycles, podAgentUpdates, connectionStatus } = useWebSocket()
  const [tab, setTab] = useState('overview')
  const [detailPodId, setDetailPodId] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(true)
  const [autoTrackingPodId, setAutoTrackingPodId] = useState(null)

  const podList = useMemo(() => Object.values(pods), [pods])

  const healthSummary = useMemo(() =>
    podList.reduce(
      (s, pod) => { s[pod.status] = (s[pod.status] || 0) + 1; return s },
      { healthy: 0, warning: 0, critical: 0 },
    ), [podList])

  const handleAutoOrbitPodId = useCallback((podId) => {
    setAutoTrackingPodId(podId)
  }, [])

  const isFarmTab = tab === 'farm'
  const isAutomationTab = tab === 'automation'

  // Farm3D is always mounted to preserve the WebGL context.
  const farmStyle = isFarmTab
    ? { flex: 1, minHeight: 0, padding: 12 }
    : isAutomationTab
      ? { width: '60%', flexShrink: 0, minHeight: 0, padding: 12 }
      : { position: 'fixed', left: -9999, top: 0, width: 1, height: 1, overflow: 'hidden', pointerEvents: 'none' }

  return (
    <div className="flex h-screen flex-col overflow-hidden" style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
      <Navbar
        connectionStatus={connectionStatus}
        healthSummary={healthSummary}
        tab={tab}
        onTabChange={(t) => { setTab(t); if (t !== 'automation') setAutoTrackingPodId(null) }}
        drawerOpen={drawerOpen}
        onDrawerToggle={() => setDrawerOpen(o => !o)}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Farm3D — always mounted, CSS-positioned per tab */}
        <div style={farmStyle}>
          <Farm3D
            pods={pods}
            onPodSelect={setDetailPodId}
            onClose={() => setTab('overview')}
            agentEvents={podAgentUpdates}
            isAutomationTab={isAutomationTab}
            autoTrackingPodId={autoTrackingPodId}
            onAutoOrbitPodId={handleAutoOrbitPodId}
          />
        </div>

        {/* Overview / Settings content */}
        {!isAutomationTab && !isFarmTab && (
          <main className="min-h-0 flex-1 overflow-hidden p-3">
            {tab === 'overview' && (
              <div key="overview" className="tab-enter h-full">
                <PodGrid pods={pods} onSelect={setDetailPodId} />
              </div>
            )}
            {tab === 'settings' && (
              <div key="settings" className="tab-enter h-full overflow-y-auto">
                <SettingsPanel pods={pods} connectionStatus={connectionStatus} />
              </div>
            )}
          </main>
        )}

        {/* Automation right panel (40%) */}
        {isAutomationTab && (
          <div
            className="shrink-0 overflow-y-auto p-3"
            style={{ width: '40%', minHeight: 0, borderLeft: '1px solid var(--color-border)' }}
          >
            <AgentActivityFeed agentCycles={agentCycles} connectionStatus={connectionStatus} />
          </div>
        )}

        {/* AgentLog drawer — hidden on automation tab */}
        {drawerOpen && !isAutomationTab && (
          <aside
            className="drawer-open hidden shrink-0 border-l p-3 lg:block"
            style={{ width: 280, borderColor: 'var(--color-border)' }}
          >
            <AgentLog entries={agentLog} connectionStatus={connectionStatus} pods={pods} />
          </aside>
        )}
      </div>

      <PodDetailModal
        pod={detailPodId ? pods[detailPodId] : null}
        agentLog={agentLog}
        onClose={() => setDetailPodId(null)}
      />
    </div>
  )
}
