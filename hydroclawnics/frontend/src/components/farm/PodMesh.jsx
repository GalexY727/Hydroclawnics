import { useRef, useMemo } from 'react'
import { Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { createPlantMesh, PLANT_TYPES } from '../../lib/plantMesh'
import { normalizeCropName } from '../../lib/cropAssets'

export default function PodMesh({ pod, onPodSelect, podIndex = 0 }) {
  const plantRef = useRef()
  const isAlerted = pod.status === 'warning' || pod.status === 'critical'
  const stage = pod.stage ?? 1
  const health = pod.health ?? 0.8
  const cropType = normalizeCropName(pod.crop)
  const plantType = PLANT_TYPES.includes(cropType) ? cropType : PLANT_TYPES[podIndex % PLANT_TYPES.length]

  const plantGroup = useMemo(() => {
    const group = createPlantMesh(stage, health, plantType)
    const alertMats = []

    if (isAlerted) {
      const emissiveColor = new THREE.Color(
        pod.status === 'critical' ? '#c9566b' : '#d4a373'
      )
      group.traverse((child) => {
        if (child instanceof THREE.Mesh && child.userData.isFoliage) {
          const cloned = child.material.clone()
          cloned.emissive = emissiveColor
          cloned.emissiveIntensity = 0.02
          child.material = cloned
          alertMats.push(cloned)
        }
      })
    }

    group.userData.alertMaterials = alertMats
    return group
  }, [stage, health, plantType, isAlerted, pod.status])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const phase = podIndex * 1.3

    if (plantRef.current) {
      plantRef.current.rotation.x = Math.sin(t * 0.55 + phase) * 0.13
      plantRef.current.rotation.z = Math.cos(t * 0.42 + phase) * 0.09
      plantRef.current.position.y = Math.sin(t * 0.9 + phase) * 0.018
    }

    const alertMaterials = plantRef.current?.userData.alertMaterials || []
    if (isAlerted && alertMaterials.length > 0) {
      const intensity = 0.05 + 0.08 * (0.5 + 0.5 * Math.sin(t * 1.4))
      for (const mat of alertMaterials) {
        mat.emissiveIntensity = intensity
      }
    }
  })

  return (
    <group
      position={pod.position}
      onClick={(e) => { e.stopPropagation(); onPodSelect?.(pod.pod_id, pod.position) }}
    >
      {/* Tray — never rotates */}
      <group>
        <mesh position={[0, 0.04, 0]}>
          <boxGeometry args={[1.2, 0.08, 1.2]} />
          <meshLambertMaterial color="#8B7355" />
        </mesh>
        <mesh position={[0, 0.07, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.0, 1.0]} />
          <meshLambertMaterial color="#5b8fa8" opacity={0.5} transparent />
        </mesh>
        <Text
          position={[0, 0.085, 0.55]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.18}
          color="#f5f1de"
          anchorX="center"
          anchorY="middle"
        >
          {pod.pod_id}
        </Text>
      </group>

      {/* Plant — sways with wind */}
      <primitive ref={plantRef} object={plantGroup} />
    </group>
  )
}
