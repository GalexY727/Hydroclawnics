import { useMemo, useState } from 'react'
import AgentLog from './AgentLog'
import Farm3D from './Farm3D'
import Navbar from './Navbar'
import PodDetailModal from './PodDetailModal'
import PodGrid from './PodGrid'
import SettingsPanel from './SettingsPanel'
import useWebSocket from './useWebSocket'

export default function App() {
  const { pods, agentLog, connectionStatus } = useWebSocket()
  const [tab, setTab] = useState('overview')
  const [detailPodId, setDetailPodId] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(true)

  const podList = useMemo(() => Object.values(pods), [pods])

  const healthSummary = useMemo(() =>
    podList.reduce(
      (s, pod) => { s[pod.status] = (s[pod.status] || 0) + 1; return s },
      { healthy: 0, warning: 0, critical: 0 },
    ), [podList])

  return (
    <div className="flex h-screen flex-col overflow-hidden" style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
      <Navbar
        connectionStatus={connectionStatus}
        healthSummary={healthSummary}
        tab={tab}
        onTabChange={setTab}
        drawerOpen={drawerOpen}
        onDrawerToggle={() => setDrawerOpen(o => !o)}
      />

      <div className="flex min-h-0 flex-1">
        <main className="min-h-0 flex-1 overflow-hidden p-3">
          {tab === 'overview' && (
            <div key="overview" className="tab-enter h-full">
              <PodGrid pods={pods} onSelect={setDetailPodId} />
            </div>
          )}
          {tab === 'farm' && (
            <div key="farm" className="tab-enter h-full">
              <Farm3D pods={pods} onPodSelect={setDetailPodId} onClose={() => setTab('overview')} />
            </div>
          )}
          {tab === 'settings' && (
            <div key="settings" className="tab-enter h-full overflow-y-auto">
              <SettingsPanel pods={pods} connectionStatus={connectionStatus} />
            </div>
          )}
        </main>

        {drawerOpen && (
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
