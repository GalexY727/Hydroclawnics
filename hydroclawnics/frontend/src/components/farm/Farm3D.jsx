import { useCallback, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import PodMesh from './PodMesh'
import AgentToasts from './AgentToasts'
import useCameraControls from '../../hooks/useCameraControls'
import useFarm3D from '../../hooks/useFarm3D'

const AUTO_ORBIT_COOLDOWN_MS = 8000
const MANUAL_CLICK_GUARD_MS = 30000

function Scene({ mappedPods, onPodSelect, controls, agentEvents, onAutoOrbitPodId }) {
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
      <color attach="background" args={['#0f1419']} />
      <ambientLight intensity={0.85} />
      <directionalLight position={[-5, 9, 6]} intensity={1.05} />

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
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#1a1f2e" roughness={0.95} />
      </mesh>

      {mappedPods.map((pod) => (
        <PodMesh
          key={pod.pod_id}
          pod={pod}
          podIndex={pod.podIndex}
          onPodSelect={(podId, position) => {
            controls.lastManualClickMs.current = Date.now()
            controls.selectPod(position)
            window.setTimeout(() => onPodSelect?.(podId), 420)
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

      <OrbitControls ref={orbitRef} autoRotate={autoRotateEnabled} autoRotateSpeed={0.4} />
    </>
  )
}

export default function Farm3D({ pods, onPodSelect, onClose, agentEvents, isAutomationTab, autoTrackingPodId, onAutoOrbitPodId }) {
  const mappedPods = useFarm3D(pods)
  const controls = useCameraControls()

  return (
    <div
      className="relative h-full overflow-hidden rounded-lg border"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}
    >
      <Canvas camera={{ position: [0, 9, 12], fov: 50 }} gl={{ antialias: true }}>
        <Scene
          mappedPods={mappedPods}
          onPodSelect={onPodSelect}
          controls={controls}
          agentEvents={agentEvents}
          onAutoOrbitPodId={onAutoOrbitPodId}
        />
      </Canvas>

      {!isAutomationTab && onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-md border transition-all hover:scale-105"
          style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
          aria-label="Close 3D view"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      )}

      {controls.showHud && controls.mode === 'free' && (
        <div
          className="hud-chip absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border px-3 py-1 text-xs"
          style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
        >
          Free camera · WASD / Space / C
        </div>
      )}

      {isAutomationTab && (
        <div
          className="absolute bottom-3 left-3 text-xs"
          style={{ color: 'var(--color-muted)', pointerEvents: 'none' }}
        >
          {autoTrackingPodId ? `Auto-tracking: ${autoTrackingPodId}` : 'Free camera'}
        </div>
      )}
    </div>
  )
}
