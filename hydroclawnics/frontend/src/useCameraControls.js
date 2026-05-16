import { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

const DEFAULT_POS    = new THREE.Vector3(0, 9, 12)
const DEFAULT_TARGET = new THREE.Vector3(0, 0, 0)
const LERP           = 0.08
const SETTLED        = 0.02
const SPEED          = 0.1

export default function useCameraControls() {
  const orbitRef      = useRef(null)
  const modeRef       = useRef('free')
  const focusPosRef   = useRef(null)
  const camTargetRef  = useRef(null)
  const settledRef    = useRef(true)
  const keysRef       = useRef({})
  const hudTimerRef   = useRef(null)
  const [showHud, setShowHud]   = useState(false)
  const [mode, setMode]         = useState('free')

  const selectPod = useCallback((position) => {
    const lookAt = new THREE.Vector3(...position).add(new THREE.Vector3(0, 0.8, 0))
    focusPosRef.current  = lookAt
    camTargetRef.current = lookAt.clone().add(new THREE.Vector3(4, 3.7, 5))
    settledRef.current   = false
    modeRef.current      = 'orbiting'
    setMode('orbiting')
  }, [])

  const resetToCenter = useCallback(() => {
    focusPosRef.current  = null
    camTargetRef.current = DEFAULT_POS.clone()
    settledRef.current   = false
    modeRef.current      = 'free'
    setMode('free')
  }, [])

  const handleBackgroundClick = useCallback(() => {
    if (modeRef.current === 'orbiting') resetToCenter()
  }, [resetToCenter])

  const tick = useCallback(({ camera }) => {
    const controls = orbitRef.current
    if (!controls) return

    if (!settledRef.current) {
      const posTarget = camTargetRef.current || DEFAULT_POS
      const lookTarget = focusPosRef.current || DEFAULT_TARGET
      camera.position.lerp(posTarget, LERP)
      controls.target.lerp(lookTarget, LERP)
      controls.update()
      if (camera.position.distanceTo(posTarget) < SETTLED) {
        settledRef.current = true
      }
      return
    }

    if (modeRef.current !== 'free') return

    const k = keysRef.current
    if (!k.w && !k.a && !k.s && !k.d && !k.space && !k.c) return

    const fwd = new THREE.Vector3()
    camera.getWorldDirection(fwd)
    fwd.y = 0
    fwd.normalize()
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize()

    if (k.w) { camera.position.addScaledVector(fwd, SPEED);    controls.target.addScaledVector(fwd, SPEED) }
    if (k.s) { camera.position.addScaledVector(fwd, -SPEED);   controls.target.addScaledVector(fwd, -SPEED) }
    if (k.a) { camera.position.addScaledVector(right, -SPEED); controls.target.addScaledVector(right, -SPEED) }
    if (k.d) { camera.position.addScaledVector(right, SPEED);  controls.target.addScaledVector(right, SPEED) }
    if (k.space) { camera.position.y += SPEED; controls.target.y += SPEED }
    if (k.c)     { camera.position.y -= SPEED; controls.target.y -= SPEED }
    controls.update()
  }, [])

  useEffect(() => {
    const onDown = (e) => {
      const key = e.key.toLowerCase()
      if (key === ' ') { keysRef.current.space = true; e.preventDefault() }
      else if (['w', 'a', 's', 'd', 'c'].includes(key)) keysRef.current[key] = true
      else return
      setShowHud(true)
      clearTimeout(hudTimerRef.current)
      hudTimerRef.current = setTimeout(() => setShowHud(false), 3000)
    }
    const onUp = (e) => {
      const key = e.key.toLowerCase()
      if (key === ' ') keysRef.current.space = false
      else keysRef.current[key] = false
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      clearTimeout(hudTimerRef.current)
    }
  }, [])

  return { orbitRef, mode, showHud, selectPod, resetToCenter, handleBackgroundClick, tick }
}
