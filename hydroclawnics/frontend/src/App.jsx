import { useMemo, useState } from 'react'
import AgentLog from './AgentLog'
import Farm3D from './Farm3D'
import PhysicalPot from './PhysicalPot'
import PodGrid from './PodGrid'
import useWebSocket from './useWebSocket'

export default function App() {
  const { pods, agentLog, connectionStatus } = useWebSocket()
  const [selectedPodId, setSelectedPodId] = useState('pod_01')
  const [viewMode, setViewMode] = useState('grid')

  const podList = useMemo(() => Object.values(pods), [pods])

  const selectedPod = useMemo(
    () => pods[selectedPodId] || podList[0],
    [podList, pods, selectedPodId],
  )

  const healthSummary = useMemo(() => {
    return podList.reduce(
      (summary, pod) => {
        summary[pod.status] = (summary[pod.status] || 0) + 1
        return summary
      },
      { healthy: 0, warning: 0, critical: 0 },
    )
  }, [podList])

  const statusStyles = {
    connected: 'bg-emerald-400',
    connecting: 'bg-amber-300',
    disconnected: 'bg-rose-500',
  }

  return (
    <div className="min-h-screen p-4 md:p-6">
      <header className="mb-4 flex flex-col gap-3 border-b border-slate-800 pb-4 md:flex-row md:items-center md:justify-between">
        <div className="text-2xl font-bold text-cyan-200">Hydroclawnics 🌿</div>
        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-300">
          <div className="flex items-center gap-2 capitalize">
            {/* # FIX: Expose live socket state in the navbar so proxy/backend failures are visible immediately. */}
            <span className={`h-3 w-3 rounded-full ${statusStyles[connectionStatus]}`} />
            {connectionStatus}
          </div>
          <div>
            {healthSummary.healthy} healthy / {healthSummary.warning} warning / {healthSummary.critical} critical
          </div>
        </div>
      </header>

      <main className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(360px,2fr)]">
        <section className="space-y-4">
          <PhysicalPot pods={pods} selectedPod={selectedPod} />

          <div className="inline-flex overflow-hidden rounded-md border border-slate-700 bg-slate-900 p-1">
            <button type="button" onClick={() => setViewMode('grid')} className={`rounded px-3 py-1.5 text-sm ${viewMode === 'grid' ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800'}`}>
              2D Grid
            </button>
            <button type="button" onClick={() => setViewMode('farm')} className={`rounded px-3 py-1.5 text-sm ${viewMode === 'farm' ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800'}`}>
              3D Farm
            </button>
          </div>

          {viewMode === 'grid' ? (
            <PodGrid pods={pods} onSelect={setSelectedPodId} />
          ) : (
            <Farm3D pods={pods} onPodSelect={setSelectedPodId} />
          )}
        </section>

        <section className="min-h-[720px]">
          <AgentLog entries={agentLog} connectionStatus={connectionStatus} />
        </section>
      </main>
    </div>
  )
}
