import { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

const DEFAULT_POS    = new THREE.Vector3(0, 9, 12)
const DEFAULT_TARGET = new THREE.Vector3(0, 0, 0)
const LERP           = 0.08
const SETTLED        = 0.02
const SPEED          = 0.075
const AUTO_ROTATE_IDLE_MS = 5000
const DRAG_THRESHOLD_MS = 500

export default function useCameraControls() {
  const orbitRef          = useRef(null)
  const modeRef           = useRef('free')
  const focusPosRef       = useRef(null)
  const camTargetRef      = useRef(null)
  const settledRef        = useRef(true)
  const keysRef           = useRef({})
  const hudTimerRef       = useRef(null)
  const idleTimerRef      = useRef(null)
  const lastInputTimeRef  = useRef(Date.now())
  const mouseDownTimeRef  = useRef(null)
  const lastManualClickMs = useRef(0)
  const [showHud, setShowHud] = useState(false)
  const [mode, setMode] = useState('free')
  const [autoRotateEnabled, setAutoRotateEnabled] = useState(true)

  const resetIdleTimer = useCallback(() => {
    lastInputTimeRef.current = Date.now()
    clearTimeout(idleTimerRef.current)
    if (modeRef.current === 'free') {
      idleTimerRef.current = setTimeout(() => {
        setAutoRotateEnabled(true)
      }, AUTO_ROTATE_IDLE_MS)
    }
  }, [])

  const selectPod = useCallback((position) => {
    const lookAt = new THREE.Vector3(...position).add(new THREE.Vector3(0, 0.8, 0))
    focusPosRef.current  = lookAt
    camTargetRef.current = lookAt.clone().add(new THREE.Vector3(4, 3.7, 5))
    settledRef.current   = false
    modeRef.current      = 'orbiting'
    setMode('orbiting')
    setAutoRotateEnabled(false)
    clearTimeout(idleTimerRef.current)
  }, [])

  const resetToCenter = useCallback(() => {
    focusPosRef.current  = null
    camTargetRef.current = DEFAULT_POS.clone()
    settledRef.current   = false
    modeRef.current      = 'free'
    setMode('free')
    resetIdleTimer()
  }, [resetIdleTimer])

  const handleBackgroundClick = useCallback((isDrag = false) => {
    if (modeRef.current === 'orbiting') {
      // Quick click: reset to center
      // Long drag: stay focused on plant
      if (!isDrag) {
        resetToCenter()
      }
    }
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
    const onKeyDown = (e) => {
      const key = e.key.toLowerCase()
      const wasIdle = autoRotateEnabled
      
      // ESC: reset to center from focused plant
      if (key === 'escape') {
        resetToCenter()
        return
      }
      
      if (key === ' ') { keysRef.current.space = true; e.preventDefault() }
      else if (['w', 'a', 's', 'd', 'c'].includes(key)) keysRef.current[key] = true
      else return
      
      // Disable auto-rotate on any input
      if (wasIdle && modeRef.current === 'free') {
        setAutoRotateEnabled(false)
      }
      
      setShowHud(true)
      resetIdleTimer()
      clearTimeout(hudTimerRef.current)
      hudTimerRef.current = setTimeout(() => setShowHud(false), 3000)
    }
    
    const onKeyUp = (e) => {
      const key = e.key.toLowerCase()
      if (key === ' ') keysRef.current.space = false
      else keysRef.current[key] = false
    }
    
    const onMouseDown = () => {
      mouseDownTimeRef.current = Date.now()
      resetIdleTimer()
      if (autoRotateEnabled && modeRef.current === 'free') {
        setAutoRotateEnabled(false)
      }
    }
    
    const onMouseUp = () => {
      if (mouseDownTimeRef.current) {
        const duration = Date.now() - mouseDownTimeRef.current
        const isDrag = duration >= DRAG_THRESHOLD_MS
        // Background click is handled by the canvas, but we track drag duration here
        // The canvas click handler will call handleBackgroundClick with isDrag info
        window.__lastMouseWasDrag = isDrag
      }
      mouseDownTimeRef.current = null
    }
    
    const onMouseMove = () => {
      resetIdleTimer()
    }
    
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('mousemove', onMouseMove)
    
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('mousemove', onMouseMove)
      clearTimeout(hudTimerRef.current)
      clearTimeout(idleTimerRef.current)
    }
  }, [resetIdleTimer, autoRotateEnabled, resetToCenter])

  return { orbitRef, mode, showHud, autoRotateEnabled, selectPod, resetToCenter, handleBackgroundClick, tick, lastManualClickMs }
}
