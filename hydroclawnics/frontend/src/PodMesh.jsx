import { useRef } from 'react'
import { Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'

function stageGeometry(ageHours) {
  if (ageHours < 12)  return { stemH: 0.4,  stemR: 0.5, foliageR: 0.20, foliageY: 0.70 }
  if (ageHours < 36)  return { stemH: 0.6,  stemR: 0.5, foliageR: 0.30, foliageY: 1.00 }
  if (ageHours < 60)  return { stemH: 0.65, stemR: 0.5, foliageR: 0.45, foliageY: 1.10 }
  return               { stemH: 0.65, stemR: 0.5, foliageR: 0.60, foliageY: 1.20 }
}

export default function PodMesh({ pod, onPodSelect }) {
  const foliageRef = useRef()
  const { stemH, stemR, foliageR, foliageY } = stageGeometry(pod.age_hours)
  const isAlerted = pod.status === 'warning' || pod.status === 'critical'

  useFrame(({ clock }) => {
    if (!foliageRef.current || !isAlerted) return
    foliageRef.current.emissiveIntensity = 0.05 + 0.10 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * Math.PI))
  })

  return (
    <group
      position={pod.position}
      onClick={(e) => { e.stopPropagation(); onPodSelect?.(pod.pod_id, pod.position) }}
    >
      <mesh position={[0, stemH / 2, 0]}>
        <cylinderGeometry args={[stemR, stemR, stemH, 32]} />
        <meshStandardMaterial color="#6a6a6a" roughness={0.85} metalness={0.05} />
      </mesh>

      <mesh position={[0, foliageY, 0]} scale={pod.heightScale}>
        <sphereGeometry args={[foliageR, 32, 32]} />
        <meshStandardMaterial
          ref={foliageRef}
          color={pod.color}
          roughness={0.6}
          metalness={0}
          emissive={pod.color}
          emissiveIntensity={isAlerted ? 0.08 : 0}
        />
      </mesh>

      {pod.age_hours >= 60 && (
        <mesh position={[0.3, foliageY + 0.3, 0.1]} scale={pod.heightScale * 0.55}>
          <sphereGeometry args={[foliageR, 24, 24]} />
          <meshStandardMaterial color={pod.color} roughness={0.65} metalness={0} emissive={pod.color} emissiveIntensity={0.04} />
        </mesh>
      )}

      <Text
        position={[0, -0.08, stemR + 0.05]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.28}
        color="#f5f1de"
        anchorX="center"
        anchorY="middle"
      >
        {pod.pod_id}
      </Text>
    </group>
  )
}
