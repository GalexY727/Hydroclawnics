import { Suspense, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import PodMesh from './PodMesh'
import { deriveStage, deriveHealth } from '../../hooks/useFarm3D'

function podIndexFromId(id) {
  if (!id) return 0
  const m = id.match(/(\d+)/)
  if (m) return parseInt(m[1], 10) - 1
  const c = id.match(/([A-Z])/i)
  if (c) return c[1].toUpperCase().charCodeAt(0) - 65
  return 0
}

function PreviewScene({ pod, autoRotate, onOrbitStart }) {
  const podIndex = podIndexFromId(pod.id)
  const mockMappedPod = {
    pod_id: pod.id,
    crop: pod.crop,
    status: pod.status,
    age_hours: Number(pod.age_hours) || 0,
    stage: deriveStage(pod.age_hours),
    health: deriveHealth(pod.status),
    position: [0, 0, 0],
  }
  return (
    <>
      <ambientLight intensity={1.1} />
      <directionalLight position={[-2, 4, 3]} intensity={1.4} />
      <directionalLight position={[2, 2, -2]} intensity={0.4} />
      <PodMesh pod={mockMappedPod} podIndex={podIndex} preview />
      <OrbitControls
        autoRotate={autoRotate}
        autoRotateSpeed={0.25}
        enableZoom={false}
        onStart={onOrbitStart}
        target={[0, 0.18, 0]}
      />
    </>
  )
}

export default function PlantPreview({ pod, className = 'mb-5 h-[180px]' }) {
  const [autoRotate, setAutoRotate] = useState(true)

  if (!pod) return null
  return (
    <div
      className={`overflow-hidden rounded-md border ${className}`}
      style={{ borderColor: 'var(--color-border)', background: '#0a1018' }}
    >
      <Suspense fallback={
        <div className="flex h-full items-center justify-center text-xs italic" style={{ color: 'var(--color-muted)' }}>
          Loading preview...
        </div>
      }>
        <Canvas camera={{ position: [1.4, 0.9, 2.3], fov: 32 }} onPointerDown={() => setAutoRotate(false)}>
          <PreviewScene pod={pod} autoRotate={autoRotate} onOrbitStart={() => setAutoRotate(false)} />
        </Canvas>
      </Suspense>
    </div>
  )
}
