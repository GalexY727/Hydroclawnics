import { useCallback, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Text } from '@react-three/drei'
import PodMesh from './PodMesh'
import AgentToasts from './AgentToasts'
import useCameraControls from '../../hooks/useCameraControls'
import useFarm3D from '../../hooks/useFarm3D'

const AUTO_ORBIT_COOLDOWN_MS = 8000
const MANUAL_CLICK_GUARD_MS = 30000

function FarmInfrastructure({ mappedPods }) {
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
  const rows = [...new Set(mappedPods.map((pod) => pod.position[2]))]

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.04, 0]}>
        <planeGeometry args={[width + 5, depth + 5]} />
        <meshStandardMaterial color="#0b111b" roughness={0.95} />
      </mesh>

      {rows.map((z) => (
        <group key={z}>
          <mesh position={[0, 0.02, z]}>
            <boxGeometry args={[width, 0.08, 0.16]} />
            <meshStandardMaterial color="#31516b" roughness={0.72} metalness={0.15} />
          </mesh>
          <mesh position={[0, 0.03, z - 0.72]}>
            <boxGeometry args={[width, 0.06, 0.06]} />
            <meshStandardMaterial color="#6cc3ff" emissive="#1d6f9f" emissiveIntensity={0.22} />
          </mesh>
        </group>
      ))}

      <group position={[bounds.minX - 2.2, 0.38, bounds.minZ - 1.2]}>
        <mesh>
          <cylinderGeometry args={[0.65, 0.65, 0.75, 32]} />
          <meshStandardMaterial color="#18384b" metalness={0.2} roughness={0.42} />
        </mesh>
        <mesh position={[0, 0.18, 0]}>
          <cylinderGeometry args={[0.58, 0.58, 0.18, 32]} />
          <meshStandardMaterial color="#6cc3ff" opacity={0.36} transparent />
        </mesh>
        <Text position={[0, 0.7, 0]} fontSize={0.2} color="#dcefff" anchorX="center">
          R-01
        </Text>
      </group>
    </group>
  )
}

function Scene({ mappedPods, onPodSelect, controls, agentEvents, activePodId, scanPodId, onAutoOrbitPodId }) {
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

      <FarmInfrastructure mappedPods={mappedPods} />

      <mesh
        rotation-x={-Math.PI / 2}
        position={[0, -0.01, 0]}
        onPointerDown={() => { window.__planeClickStart = Date.now() }}
        onPointerUp={() => {
          const isDrag = window.__planeClickStart && (Date.now() - window.__planeClickStart >= 500)
          window.__planeClickStart = null
          if (mode === 'orbiting' && !isDrag) resetToCenter()
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
          scanning={scanPodId === pod.pod_id}
          onPodSelect={(podId, position) => {
            controls.lastManualClickMs.current = Date.now()
            controls.selectPod(position)
            window.setTimeout(() => onPodSelect?.(podId), 250)
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

export default function Farm3D({ pods, onPodSelect, onClose, agentEvents, events = [], activeIncident, scanPodId, isAutomationTab, autoTrackingPodId, onAutoOrbitPodId }) {
  const mappedPods = useFarm3D(pods)
  const controls = useCameraControls()
  const activeFaults = mappedPods.filter((pod) => pod.status === 'critical' || pod.status === 'warning')
  const latestEvent = activeIncident?.latest || events[0]
  const activePodId = activeIncident?.podId || autoTrackingPodId

  return (
    <div className="relative h-full overflow-hidden rounded-md border" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}>
      <Canvas camera={{ position: [0, 9, 12], fov: 50 }} gl={{ antialias: true }}>
        <Scene
          mappedPods={mappedPods}
          onPodSelect={onPodSelect}
          controls={controls}
          agentEvents={agentEvents}
          activePodId={activePodId}
          scanPodId={scanPodId}
          onAutoOrbitPodId={onAutoOrbitPodId}
        />
      </Canvas>

      <div className="pointer-events-none absolute left-4 top-4 max-w-md">
        <div className="rounded-md border p-3 backdrop-blur" style={{ borderColor: 'var(--color-border)', background: 'rgba(8, 13, 20, 0.72)' }}>
          <div className="text-xs uppercase" style={{ color: 'var(--color-muted)' }}>Digital Twin</div>
          <div className="mt-1 text-lg font-semibold">Hydroclawnics farm model</div>
          <div className="mt-2 text-xs" style={{ color: 'var(--color-muted)' }}>
            {mappedPods.length} pods mapped. {activeFaults.length} active spatial alerts.
          </div>
          {latestEvent && <div className="mt-2 text-xs" style={{ color: 'var(--color-info)' }}>{latestEvent.podId}: {latestEvent.lifecycle}</div>}
          {scanPodId && <div className="mt-1 text-xs" style={{ color: 'var(--color-success)' }}>AI scan target: {scanPodId}</div>}
        </div>
      </div>

      <div className="absolute right-3 top-3 flex flex-wrap justify-end gap-2">
        {[
          ['top', 'Top'],
          ['angled', 'Angled'],
          ['fault', 'Fault'],
          ['reset', 'Reset'],
        ].map(([preset, label]) => (
          <button
            key={preset}
            type="button"
            onClick={() => controls.setViewPreset(preset)}
            className="rounded-md border px-3 py-2 text-xs font-semibold backdrop-blur"
            style={{ background: 'rgba(8, 13, 20, 0.78)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
          >
            {label}
          </button>
        ))}
        {!isAutomationTab && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-md border backdrop-blur"
            style={{ background: 'rgba(8, 13, 20, 0.78)', borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
            aria-label="Close 3D view"
          >
            X
          </button>
        )}
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
