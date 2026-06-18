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
  const islands = Array.from(mappedPods.reduce((acc, pod) => {
    const key = pod.islandId || pod.group || pod.zone || 'Farm'
    if (!acc.has(key)) {
      acc.set(key, {
        id: key,
        center: pod.islandCenter || [pod.position[0], 0, pod.position[2]],
        width: pod.islandWidth || 5,
        depth: pod.islandDepth || 3.2,
        zone: pod.zone || pod.group || 'Zone',
        reservoirs: new Set(),
        rows: new Map(),
        hasAlert: false,
      })
    }
    const island = acc.get(key)
    if (pod.reservoir) island.reservoirs.add(pod.reservoir)
    if (pod.status === 'critical' || pod.status === 'warning') island.hasAlert = true
    const rowKey = pod.rowInIsland ?? 0
    if (!island.rows.has(rowKey)) island.rows.set(rowKey, [])
    island.rows.get(rowKey).push(pod)
    return acc
  }, new Map()).values()).map((island) => ({
    ...island,
    reservoirs: Array.from(island.reservoirs),
    rows: Array.from(island.rows.entries()).map(([rowIndex, pods]) => ({ rowIndex, pods })),
  }))

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.04, 0]}>
        <planeGeometry args={[width + 5, depth + 5]} />
        <meshStandardMaterial color="#0b111b" roughness={0.95} />
      </mesh>

      {islands.map((island) => {
        const [x, , z] = island.center
        const borderColor = island.hasAlert ? '#f5b85b' : '#315f7a'
        const label = `${island.zone}${island.reservoirs.length === 1 ? ` · ${island.reservoirs[0]}` : ''}`

        return (
          <group key={island.id}>
            <mesh position={[x, 0, z]}>
              <boxGeometry args={[island.width, 0.045, island.depth]} />
              <meshStandardMaterial color="#101a27" roughness={0.9} metalness={0.08} opacity={0.88} transparent />
            </mesh>
            <mesh position={[x, 0.04, z - island.depth / 2]}>
              <boxGeometry args={[island.width, 0.045, 0.055]} />
              <meshStandardMaterial color={borderColor} roughness={0.68} metalness={0.12} />
            </mesh>
            <mesh position={[x, 0.04, z + island.depth / 2]}>
              <boxGeometry args={[island.width, 0.045, 0.055]} />
              <meshStandardMaterial color={borderColor} roughness={0.68} metalness={0.12} />
            </mesh>
            <mesh position={[x - island.width / 2, 0.04, z]}>
              <boxGeometry args={[0.055, 0.045, island.depth]} />
              <meshStandardMaterial color={borderColor} roughness={0.68} metalness={0.12} />
            </mesh>
            <mesh position={[x + island.width / 2, 0.04, z]}>
              <boxGeometry args={[0.055, 0.045, island.depth]} />
              <meshStandardMaterial color={borderColor} roughness={0.68} metalness={0.12} />
            </mesh>
            <Text
              position={[x - island.width / 2 + 0.34, 0.09, z - island.depth / 2 + 0.34]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.18}
              color="#dcefff"
              anchorX="left"
              anchorY="middle"
            >
              {label}
            </Text>
            {island.rows.map((row) => {
              const rowZ = row.pods[0]?.position[2] || z
              const rowWidth = Math.max(2.5, (row.pods.length - 1) * 1.85 + 1.55)
              return (
                <group key={`${island.id}-${row.rowIndex}`}>
                  <mesh position={[x, 0.025, rowZ]}>
                    <boxGeometry args={[rowWidth, 0.045, 0.18]} />
                    <meshStandardMaterial color="#26394e" roughness={0.82} metalness={0.12} opacity={0.68} transparent />
                  </mesh>
                  {showFlowLines && (
                    <mesh position={[x, 0.055, rowZ - 0.55]}>
                      <boxGeometry args={[rowWidth, 0.035, 0.045]} />
                      <meshStandardMaterial color="#6cc3ff" emissive="#1d6f9f" emissiveIntensity={0.16} opacity={0.72} transparent />
                    </mesh>
                  )}
                </group>
              )
            })}
          </group>
        )
      })}
    </group>
  )
}

function Scene({ mappedPods, onPodSelect, onViewFullPod, onPodHover, onClearSelection, controls, agentEvents, activePodId, selectedPodId, scanPodId, showFlowLines, searchTerm, onAutoOrbitPodId }) {
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
          onViewFullPod={onViewFullPod}
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

function SearchPanel({ value, matchCount, totalCount, statusText, onChange, onClear }) {
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
      <div className="farm-search-status">{statusText}</div>
    </div>
  )
}

function ContextPanel({ mode, pod, mappedPods, activeFaults, latestEvent, scanPodId, latestPodEvent, latestPodNote, fullPodInView, onViewFullPod, onClearSelection }) {
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
            {!fullPodInView && <button type="button" className="farm-action-button" onClick={() => onViewFullPod(pod.pod_id)}>View Pod Info</button>}
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

export default function Farm3D({ pods, detailPodId, onPodSelect, onClose, agentEvents, events = [], activeIncident, scanPodId, isAutomationTab, autoTrackingPodId, onAutoOrbitPodId }) {
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
  const trackingStatus = autoTrackingPodId ? `Auto-tracking: ${autoTrackingPodId}` : controls.mode === 'free' ? 'Free camera' : 'Pod focus'
  const showSelectedPodAction = selectedPod && !detailPodId
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
          onViewFullPod={onPodSelect}
          scanPodId={scanPodId}
          showFlowLines={showFlowLines}
          searchTerm={searchTerm}
          onAutoOrbitPodId={onAutoOrbitPodId}
        />
      </Canvas>

      <div className="farm-left-stack absolute left-4 top-4 max-w-md">
        <ContextPanel
          mode={contextMode}
          pod={contextPod}
          mappedPods={mappedPods}
          activeFaults={activeFaults}
          latestEvent={latestEvent}
          scanPodId={scanPodId}
          latestPodEvent={contextEvent}
          latestPodNote={contextNote}
          fullPodInView={Boolean(detailPodId)}
          onViewFullPod={onPodSelect}
          onClearSelection={clearSelectedPod}
        />
      </div>

      <div className="farm-right-stack absolute right-3 top-3">
        <div className="farm-controls flex flex-wrap justify-end gap-2">
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
        <SearchPanel
          value={searchTerm}
          matchCount={searchMatchCount}
          totalCount={mappedPods.length}
          statusText={trackingStatus}
          onChange={setSearchTerm}
          onClear={() => setSearchTerm('')}
        />
      </div>

      {controls.showHud && (
        <div className={`hud-chip absolute ${showSelectedPodAction ? 'bottom-20' : 'bottom-4'} left-1/2 -translate-x-1/2 rounded-md border px-3 py-1 text-xs`} style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>
          Free camera active
        </div>
      )}

      {showSelectedPodAction && (
        <button type="button" className="pod-selected-action farm-selected-action-bar absolute bottom-4 left-1/2 -translate-x-1/2" onClick={() => onPodSelect(selectedPod.pod_id)}>
            View Pod Info
        </button>
      )}
    </div>
  )
}
