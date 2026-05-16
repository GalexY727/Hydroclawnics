import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import PodMesh from './PodMesh'
import { deriveStage, deriveHealth } from './useFarm3D'

function PreviewScene({ pod }) {
  const mockMappedPod = {
    pod_id: pod.id,
    status: pod.status,
    age_hours: Number(pod.age_hours) || 0,
    stage: deriveStage(pod.age_hours),
    health: deriveHealth(pod.status),
    position: [0, 0, 0],
  }
  return (
    <>
      <ambientLight intensity={0.9} />
      <directionalLight position={[-3, 6, 4]} intensity={1.1} />
      <PodMesh pod={mockMappedPod} />
      <OrbitControls autoRotate autoRotateSpeed={1.5} enableZoom={false} />
    </>
  )
}

export default function PlantPreview({ pod }) {
  if (!pod) return null
  return (
    <div
      className="mb-5 overflow-hidden rounded-md border"
      style={{ height: 160, borderColor: 'var(--color-border)', background: '#0f1419' }}
    >
      <Suspense fallback={
        <div className="flex h-full items-center justify-center text-xs italic" style={{ color: 'var(--color-muted)' }}>
          Loading preview...
        </div>
      }>
        <Canvas camera={{ position: [3, 3, 4], fov: 45 }}>
          <PreviewScene pod={pod} />
        </Canvas>
      </Suspense>
    </div>
  )
}
