import { useEffect, useMemo, useRef, useState } from 'react'
import { Html, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { createPlantMesh, PLANT_TYPES } from '../../lib/plantMesh'
import { normalizeCropName } from '../../lib/cropAssets'

const STATUS_COLOR = {
  healthy: '#58d68d',
  warning: '#f5b85b',
  critical: '#ff5c7a',
  recovering: '#f5b85b',
  verifying: '#6cc3ff',
}

function displayStatus(value) {
  return `${value || 'stable'}`.replaceAll('_', ' ')
}

export default function PodMesh({ pod, onPodSelect, onPodHover, podIndex = 0, active = false, selected = false, scanning = false, showFlowLines = false, dimmed = false }) {
  const plantRef = useRef()
  const ringRef = useRef()
  const activeRingRef = useRef()
  const selectedRingRef = useRef()
  const hoverRingRef = useRef()
  const scanRef = useRef()
  const flowRef = useRef()
  const [hovered, setHovered] = useState(false)
  const isAlerted = pod.status === 'warning' || pod.status === 'critical' || pod.status === 'recovering' || pod.status === 'verifying'
  const stage = pod.stage ?? 1
  const health = pod.health ?? 0.8
  const statusColor = STATUS_COLOR[pod.status] || STATUS_COLOR.healthy
  const cropType = normalizeCropName(pod.crop)
  const plantType = PLANT_TYPES.includes(cropType) ? cropType : PLANT_TYPES[podIndex % PLANT_TYPES.length]

  const plantGroup = useMemo(() => {
    const group = createPlantMesh(stage, health, plantType)
    const alertMats = []
    if (isAlerted) {
      const emissiveColor = new THREE.Color(statusColor)
      group.traverse((child) => {
        if (child instanceof THREE.Mesh && child.userData.isFoliage) {
          const cloned = child.material.clone()
          cloned.emissive = emissiveColor
          cloned.emissiveIntensity = 0.03
          child.material = cloned
          alertMats.push(cloned)
        }
      })
    }
    group.userData.alertMaterials = alertMats
    return group
  }, [stage, health, plantType, isAlerted, statusColor])

  useEffect(() => {
    const opacity = dimmed ? 0.24 : 1
    plantGroup.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const materials = Array.isArray(child.material) ? child.material : [child.material]
        materials.forEach((material) => {
          material.transparent = opacity < 1
          material.opacity = opacity
          material.needsUpdate = true
        })
      }
    })
  }, [dimmed, plantGroup])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const phase = podIndex * 1.3
    if (plantRef.current) {
      plantRef.current.rotation.x = Math.sin(t * 0.55 + phase) * 0.1
      plantRef.current.rotation.z = Math.cos(t * 0.42 + phase) * 0.07
      plantRef.current.position.y = Math.sin(t * 0.9 + phase) * 0.018
    }
    if (ringRef.current) {
      ringRef.current.rotation.z = t * (pod.status === 'critical' ? 1.4 : 0.7)
      ringRef.current.scale.setScalar(isAlerted ? 1 + Math.sin(t * 2.2) * 0.05 : 1)
    }
    if (activeRingRef.current) {
      activeRingRef.current.rotation.z = -t * 0.9
      activeRingRef.current.scale.setScalar(1 + Math.sin(t * 2.8) * 0.08)
    }
    if (selectedRingRef.current) {
      selectedRingRef.current.rotation.z = -t * 0.45
    }
    if (hoverRingRef.current) {
      hoverRingRef.current.visible = hovered && !selected
    }
    if (scanRef.current) {
      scanRef.current.rotation.z = t * 2.2
      scanRef.current.visible = scanning
    }
    if (flowRef.current) {
      flowRef.current.position.x = ((t * 0.9 + podIndex * 0.2) % 1.6) - 0.8
      flowRef.current.visible = showFlowLines && pod.pump_status !== false
    }
    const alertMaterials = plantRef.current?.userData.alertMaterials || []
    for (const mat of alertMaterials) {
      mat.emissiveIntensity = 0.04 + 0.12 * (0.5 + 0.5 * Math.sin(t * 1.8))
    }
  })

  return (
    <group
      position={pod.position}
      onClick={(event) => { event.stopPropagation(); onPodSelect?.(pod.pod_id, pod.position) }}
      onPointerOver={(event) => { event.stopPropagation(); setHovered(true); onPodHover?.(pod.pod_id) }}
      onPointerOut={() => { setHovered(false); onPodHover?.(null) }}
    >
      <group>
        <mesh position={[0, 0.04, 0]}>
          <boxGeometry args={[1.34, 0.08, 1.06]} />
          <meshStandardMaterial color={dimmed ? '#111a26' : '#233247'} opacity={dimmed ? 0.42 : 1} transparent={dimmed} roughness={0.82} metalness={0.18} />
        </mesh>
        <mesh position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.18, 0.82]} />
          <meshStandardMaterial color="#5ec7ff" opacity={dimmed ? 0.06 : 0.2} transparent roughness={0.35} />
        </mesh>
        {showFlowLines && (
          <mesh ref={flowRef} position={[0, 0.14, -0.48]}>
            <sphereGeometry args={[0.045, 12, 12]} />
            <meshStandardMaterial color="#6cc3ff" emissive="#6cc3ff" emissiveIntensity={0.7} />
          </mesh>
        )}
        <mesh ref={ringRef} position={[0, 0.16, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.66, 0.72, 48]} />
          <meshBasicMaterial color={dimmed ? '#6f7d8d' : statusColor} transparent opacity={dimmed ? 0.12 : isAlerted ? 0.72 : 0.22} />
        </mesh>
        <mesh ref={hoverRingRef} visible={hovered && !selected} position={[0, 0.175, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.77, 0.8, 56]} />
          <meshBasicMaterial color="#dcefff" transparent opacity={0.42} />
        </mesh>
        <mesh ref={activeRingRef} visible={active} position={[0, 0.18, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.84, 0.91, 64]} />
          <meshBasicMaterial color="#6cc3ff" transparent opacity={0.72} />
        </mesh>
        <mesh ref={selectedRingRef} visible={selected} position={[0, 0.21, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.98, 1.03, 72]} />
          <meshBasicMaterial color="#f5f7fb" transparent opacity={0.78} />
        </mesh>
        <mesh ref={scanRef} visible={scanning} position={[0, 0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.94, 0.97, 64]} />
          <meshBasicMaterial color="#58d68d" transparent opacity={0.55} />
        </mesh>
        <Text
          position={[0, 0.19, 0.56]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.14}
          color="#f5f7fb"
          fillOpacity={dimmed ? 0.28 : 1}
          anchorX="center"
          anchorY="middle"
        >
          {pod.pod_id}
        </Text>
      </group>

      <primitive ref={plantRef} object={plantGroup} />

      {hovered && (
        <Html position={[0, 1.85, 0]} center distanceFactor={8}>
          <div className="pod-tooltip">
            <strong>{pod.pod_id}</strong>
            <span>{pod.crop} · {pod.zone}</span>
            <span>{displayStatus(pod.status)} · {displayStatus(pod.lifecycle)}</span>
            <span>pH {Number(pod.ph || 0).toFixed(2)} · EC {Math.round(Number(pod.ec_ppm || 0))} ppm</span>
          </div>
        </Html>
      )}
    </group>
  )
}
