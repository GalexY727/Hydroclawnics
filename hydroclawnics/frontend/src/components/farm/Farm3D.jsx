import { useCallback, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Text } from '@react-three/drei'
import PodMesh from './PodMesh'
import AgentToasts from './AgentToasts'
import useCameraControls from '../../hooks/useCameraControls'
import useFarm3D from '../../hooks/useFarm3D'

const AUTO_ORBIT_COOLDOWN_MS = 8000
const MANUAL_CLICK_GUARD_MS = 30000

function compactValue(value, suffix = '') {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return '--'
  if (numeric === 0) return `0${suffix}`
  return `${Number.isInteger(numeric) ? numeric : Number(numeric.toFixed(2))}${suffix}`
}

function titleCase(value) {
  return `${value || ''}`.replaceAll('_', ' ').replace(/\b\w/g, (match) => match.toUpperCase())
}

function normalizeSearch(value) {
  return `${value || ''}`.trim().toLowerCase()
}

function eventForPod(events, podId) {
  return events.find((event) => event.podId === podId) || null
}

function agentNoteForPod(agentEvents = [], podId) {
  const event = [...agentEvents].reverse().find((item) => item.pod_id === podId || item.podId === podId)
  if (!event) return ''
  const tool = event.tool ? titleCase(event.tool) : 'AI update'
  return event.reason || event.reasoning || `${tool} recorded`
}

function podMatchesSearch(pod, query) {
  const needle = normalizeSearch(query)
  if (!needle) return true
  const haystack = [
    pod.pod_id,
    pod.crop,
    pod.zone,
    pod.reservoir,
    pod.group,
    pod.status,
    pod.lifecycle,
    pod.fault_type,
    `ph ${compactValue(pod.ph)}`,
    `ec ${compactValue(pod.ec_ppm)}`,
    `water ${compactValue(pod.water_level)}`,
  ].join(' ').toLowerCase()
  return haystack.includes(needle)
}

function FarmInfrastructure({ mappedPods, showFlowLines }) {
  const bounds = useMemo(() => {
    if (mappedPods.length === 0) return { minX: -4, maxX: 4, minZ: -4, maxZ: 4 }
    return mappedPods.reduce((acc, pod) => ({
      minX: Math.min(acc.minX, pod.position[0]),
      maxX: Math.max(acc.maxX, pod.position[0]),
      minZ: Math.min(acc.minZ, pod.position[2]),
      maxZ: Math.max(acc.maxZ, pod.position[2]),
    }), { minX: 0, maxX: 0, minZ: 0, maxZ: 0 })
  }, [mappedPods])
  const width = Math.max(8, bounds.maxX - bounds.minX + 3)
  const depth = Math.max(7, bounds.maxZ - bounds.minZ + 3)
  const rows = Array.from(mappedPods.reduce((acc, pod) => {
    const z = pod.position[2]
    if (!acc.has(z)) acc.set(z, [])
    acc.get(z).push(pod)
    return acc
  }, new Map()).entries()).map(([z, pods]) => ({
    z,
    zone: pods[0]?.zone || pods[0]?.group || 'Zone',
    reservoirs: [...new Set(pods.map((pod) => pod.reservoir).filter(Boolean))],
  }))

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.04, 0]}>
        <planeGeometry args={[width + 5, depth + 5]} />
        <meshStandardMaterial color="#0b111b" roughness={0.95} />
      </mesh>

      {rows.map((row) => (
        <group key={row.z}>
          <mesh position={[0, 0.02, row.z]}>
            <boxGeometry args={[width, 0.08, 0.16]} />
            <meshStandardMaterial color="#31516b" roughness={0.72} metalness={0.15} />
          </mesh>
          {showFlowLines && (
            <mesh position={[0, 0.03, row.z - 0.72]}>
              <boxGeometry args={[width, 0.06, 0.06]} />
              <meshStandardMaterial color="#6cc3ff" emissive="#1d6f9f" emissiveIntensity={0.22} />
            </mesh>
          )}
          <Text position={[bounds.minX - 1.28, 0.14, row.z + 0.22]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.16} color="#9fb1c7" anchorX="left">
            {row.zone}{row.reservoirs.length === 1 ? ` · ${row.reservoirs[0]}` : ''}
          </Text>
        </group>
      ))}
    </group>
  )
}

function Scene({ mappedPods, onPodSelect, onPodHover, onClearSelection, controls, agentEvents, activePodId, selectedPodId, scanPodId, showFlowLines, searchTerm, onAutoOrbitPodId }) {
  const { orbitRef, tick, autoRotateEnabled, mode, resetToCenter } = controls
  const lastAutoOrbitMs = useRef(0)

  useFrame((state) => tick(state))

  const handleAutoOrbit = useCallback((podId, pos) => {
    const now = Date.now()
    if (now - controls.lastManualClickMs.current < MANUAL_CLICK_GUARD_MS) return
    if (now - lastAutoOrbitMs.current < AUTO_ORBIT_COOLDOWN_MS) return
    lastAutoOrbitMs.current = now
    controls.selectPod(pos)
    onAutoOrbitPodId?.(podId)
  }, [controls, onAutoOrbitPodId])

  return (
    <>
      <color attach="background" args={['#070d15']} />
      <fog attach="fog" args={['#070d15', 14, 36]} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[-6, 10, 7]} intensity={1.15} />
      <pointLight position={[5, 4, -5]} color="#6cc3ff" intensity={0.7} />

      <FarmInfrastructure mappedPods={mappedPods} showFlowLines={showFlowLines} />

      <mesh
        rotation-x={-Math.PI / 2}
        position={[0, -0.01, 0]}
        onPointerDown={() => { window.__planeClickStart = Date.now() }}
        onPointerUp={() => {
          const isDrag = window.__planeClickStart && (Date.now() - window.__planeClickStart >= 500)
          window.__planeClickStart = null
          if (!isDrag) {
            onClearSelection?.()
            if (mode === 'orbiting') resetToCenter()
          }
        }}
      >
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#08101a" roughness={0.95} />
      </mesh>

      {mappedPods.map((pod) => (
        <PodMesh
          key={pod.pod_id}
          pod={pod}
          podIndex={pod.podIndex}
          active={activePodId === pod.pod_id}
          selected={selectedPodId === pod.pod_id}
          scanning={scanPodId === pod.pod_id}
          showFlowLines={showFlowLines}
          dimmed={!podMatchesSearch(pod, searchTerm)}
          onPodHover={onPodHover}
          onPodSelect={(podId, position) => {
            controls.lastManualClickMs.current = Date.now()
            controls.selectPod(position)
            onPodSelect?.(podId)
          }}
        />
      ))}

      {agentEvents && (
        <AgentToasts
          agentEvents={agentEvents}
          mappedPods={mappedPods}
          onAutoOrbit={handleAutoOrbit}
        />
      )}

      <OrbitControls ref={orbitRef} autoRotate={autoRotateEnabled} autoRotateSpeed={0.22} />
    </>
  )
}

function SearchPanel({ value, matchCount, totalCount, onChange, onClear }) {
  return (
    <div className="farm-search-panel">
      <label htmlFor="farm-3d-search">Search</label>
      <div className="farm-search-input-row">
        <input
          id="farm-3d-search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => event.stopPropagation()}
          onKeyUp={(event) => event.stopPropagation()}
          placeholder="Pod, crop, zone, group"
        />
        {value && (
          <button type="button" onClick={onClear} aria-label="Clear 3D search">
            Clear
          </button>
        )}
      </div>
      <div>{value ? `${matchCount} of ${totalCount} shown` : 'Optional focus filter'}</div>
    </div>
  )
}

function ContextPanel({ mode, pod, mappedPods, activeFaults, latestEvent, scanPodId, latestPodEvent, latestPodNote, onViewFullPod, onClearSelection }) {
  if (pod) {
    const selected = mode === 'selected'
    return (
      <div className="farm-context-card rounded-md border p-3 backdrop-blur" style={{ borderColor: selected ? 'rgba(108, 195, 255, 0.62)' : 'var(--color-border)', background: 'rgba(8, 13, 20, 0.78)' }}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs uppercase" style={{ color: 'var(--color-muted)' }}>{selected ? 'Selected Pod' : 'Pod Preview'}</div>
            <div className="mt-1 truncate text-lg font-semibold">{pod.pod_id}</div>
          </div>
          <span className={`status-pill status-${pod.status}`}>{pod.status}</span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs" style={{ color: 'var(--color-muted)' }}>
          <span>{titleCase(pod.crop)}</span>
          <span>{pod.zone}</span>
          {selected && <span>{pod.reservoir}</span>}
          <span>{titleCase(pod.lifecycle)}</span>
          <span>pH {compactValue(pod.ph)}</span>
          <span>EC {compactValue(pod.ec_ppm, ' ppm')}</span>
          <span>Water {compactValue(pod.water_level, '%')}</span>
          <span>Flow {compactValue(pod.flow_rate, ' L/m')}</span>
        </div>
        {(latestPodNote || latestPodEvent) && (
          <div className="mt-2 text-xs leading-5" style={{ color: 'var(--color-info)' }}>
            {latestPodNote || `${latestPodEvent.issue || latestPodEvent.lifecycle}: ${latestPodEvent.result || latestPodEvent.action}`}
          </div>
        )}
        {selected && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="farm-action-button" onClick={() => onViewFullPod(pod.pod_id)}>View Full Pod</button>
            <button type="button" className="farm-action-button farm-action-button-muted" onClick={onClearSelection}>Clear</button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="farm-context-card rounded-md border p-3 backdrop-blur" style={{ borderColor: 'var(--color-border)', background: 'rgba(8, 13, 20, 0.72)' }}>
      <div className="text-xs uppercase" style={{ color: 'var(--color-muted)' }}>Digital Twin</div>
      <div className="mt-1 text-lg font-semibold">Hydroclawnics farm model</div>
      <div className="mt-2 text-xs" style={{ color: 'var(--color-muted)' }}>
        {mappedPods.length} pods mapped. {activeFaults.length} active spatial alerts.
      </div>
      {latestEvent && <div className="mt-2 text-xs" style={{ color: 'var(--color-info)' }}>{latestEvent.podId}: {latestEvent.lifecycle}</div>}
      {scanPodId && <div className="mt-1 text-xs" style={{ color: 'var(--color-success)' }}>AI scan target: {scanPodId}</div>}
    </div>
  )
}

export default function Farm3D({ pods, onPodSelect, onClose, agentEvents, events = [], activeIncident, scanPodId, isAutomationTab, autoTrackingPodId, onAutoOrbitPodId }) {
  const mappedPods = useFarm3D(pods)
  const controls = useCameraControls()
  const [selectedPodId, setSelectedPodId] = useState(null)
  const [hoveredPodId, setHoveredPodId] = useState(null)
  const [showFlowLines, setShowFlowLines] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const activeFaults = mappedPods.filter((pod) => pod.status === 'critical' || pod.status === 'warning')
  const latestEvent = activeIncident?.latest || events[0]
  const activePodId = activeIncident?.podId || autoTrackingPodId
  const searchMatchCount = mappedPods.filter((pod) => podMatchesSearch(pod, searchTerm)).length
  const selectedPod = mappedPods.find((pod) => pod.pod_id === selectedPodId) || null
  const hoveredPod = mappedPods.find((pod) => pod.pod_id === hoveredPodId) || null
  const contextPod = selectedPod || hoveredPod
  const contextMode = selectedPod ? 'selected' : hoveredPod ? 'hover' : 'default'
  const contextEvent = contextPod ? eventForPod(events, contextPod.pod_id) : null
  const contextNote = contextPod ? agentNoteForPod(agentEvents, contextPod.pod_id) : ''
  const clearSelectedPod = useCallback(() => {
    setSelectedPodId(null)
    setHoveredPodId(null)
  }, [setHoveredPodId, setSelectedPodId])

  return (
    <div className="relative h-full overflow-hidden rounded-md border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}>
      <Canvas camera={{ position: [0, 9, 12], fov: 50 }} gl={{ antialias: true }}>
        <Scene
          mappedPods={mappedPods}
          onPodSelect={setSelectedPodId}
          onPodHover={setHoveredPodId}
          onClearSelection={clearSelectedPod}
          controls={controls}
          agentEvents={agentEvents}
          activePodId={activePodId}
          selectedPodId={selectedPodId}
          scanPodId={scanPodId}
          showFlowLines={showFlowLines}
          searchTerm={searchTerm}
          onAutoOrbitPodId={onAutoOrbitPodId}
        />
      </Canvas>

      <div className="absolute left-4 top-4 max-w-md">
        <ContextPanel
          mode={contextMode}
          pod={contextPod}
          mappedPods={mappedPods}
          activeFaults={activeFaults}
          latestEvent={latestEvent}
          scanPodId={scanPodId}
          latestPodEvent={contextEvent}
          latestPodNote={contextNote}
          onViewFullPod={onPodSelect}
          onClearSelection={clearSelectedPod}
        />
      </div>

      <div className="farm-controls absolute right-3 top-3 flex flex-wrap justify-end gap-2">
        <div className="farm-control-group">
          <span>View</span>
          {['top', 'angled'].map((preset) => (
            <button key={preset} type="button" onClick={() => controls.setViewPreset(preset)}>{titleCase(preset)}</button>
          ))}
        </div>
        <div className="farm-control-group">
          <span>Overlays</span>
          <button type="button" onClick={() => controls.setViewPreset('fault')}>Faults</button>
          <button type="button" className={showFlowLines ? 'farm-control-active' : ''} onClick={() => setShowFlowLines((value) => !value)}>Flow lines</button>
        </div>
        <button type="button" className="farm-reset-button" onClick={() => controls.setViewPreset('reset')}>Reset</button>
        {!isAutomationTab && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="farm-close-button"
            aria-label="Close 3D view"
            title="Close 3D view"
          >
            X
          </button>
        )}
      </div>

      <div className="absolute bottom-3 right-3">
        <SearchPanel
          value={searchTerm}
          matchCount={searchMatchCount}
          totalCount={mappedPods.length}
          onChange={setSearchTerm}
          onClear={() => setSearchTerm('')}
        />
      </div>

      <div className="absolute bottom-3 left-3 rounded-md border px-3 py-2 text-xs backdrop-blur" style={{ background: 'rgba(8, 13, 20, 0.72)', borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>
        {autoTrackingPodId ? `Auto-tracking: ${autoTrackingPodId}` : controls.mode === 'free' ? 'Free camera' : 'Pod focus'}
      </div>

      {controls.showHud && (
        <div className="hud-chip absolute bottom-4 left-1/2 -translate-x-1/2 rounded-md border px-3 py-1 text-xs" style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>
          Free camera active
        </div>
      )}
    </div>
  )
}
