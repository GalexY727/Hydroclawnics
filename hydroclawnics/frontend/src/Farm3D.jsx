import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import PodMesh from './PodMesh'
import useFarm3D from './useFarm3D'

function CameraRig({ focus }) {
  const controlsRef = useRef(null)
  const { camera } = useThree()
  const focusVector = useMemo(() => new THREE.Vector3(), [])
  const cameraTarget = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    if (!focus || !controlsRef.current) {
      return
    }
    focusVector.set(focus[0], focus[1] + 0.8, focus[2])
    cameraTarget.set(focus[0] + 4, focus[1] + 4.5, focus[2] + 5)
    // # FIX: Smoothly lerp the camera and OrbitControls target to the clicked pod.
    camera.position.lerp(cameraTarget, 0.08)
    controlsRef.current.target.lerp(focusVector, 0.08)
    controlsRef.current.update()
  })

  return <OrbitControls ref={controlsRef} autoRotate autoRotateSpeed={0.5} />
}

export default function Farm3D({ pods, onPodSelect }) {
  const mappedPods = useFarm3D(pods)
  const [focus, setFocus] = useState(null)

  return (
    <div className="h-[420px] w-full overflow-hidden border border-slate-700 bg-slate-900">
      <Canvas camera={{ position: [0, 9, 12], fov: 50 }}>
        <ambientLight intensity={0.65} />
        <directionalLight position={[5, 10, 6]} intensity={1.1} />
        <mesh rotation-x={-Math.PI / 2} position={[0, -0.01, 0]}>
          <planeGeometry args={[20, 15]} />
          <meshStandardMaterial color="#1a3a1a" />
        </mesh>

        {mappedPods.map((pod) => (
          <PodMesh
            key={pod.pod_id}
            pod={pod}
            onPodSelect={(podId, position) => {
              setFocus(position)
              onPodSelect?.(podId)
            }}
          />
        ))}

        <CameraRig focus={focus} />
      </Canvas>
    </div>
  )
}
