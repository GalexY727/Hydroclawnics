import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const TOAST_W = 256
const TOAST_H = 64
const TOAST_POP_MS = 180
const TOAST_HOLD_MS = 4000
const TOAST_FADE_MS = 700
const TOAST_TOTAL_MS = TOAST_POP_MS + TOAST_HOLD_MS + TOAST_FADE_MS
const STACK_GAP = 0.4
const MAX_PER_PLANT = 4
const PLANT_TOP_Y = 2.0

const FAN_VENT_TOOLS = new Set(['turn_fan_on','turn_fan_off','set_fan_speed','open_vent','close_vent'])
const HEAT_COOL_TOOLS = new Set(['turn_heater_on','turn_heater_off','turn_cooler_on','turn_cooler_off'])
const STRESS_TOOLS = new Set(['enter_heat_stress_mode','enter_high_humidity_mode'])
const HUMID_TOOLS = new Set(['turn_humidifier_on','turn_humidifier_off','turn_dehumidifier_on','turn_dehumidifier_off'])

function toolColor(tool) {
  if (FAN_VENT_TOOLS.has(tool))   return '#7aa8c4'
  if (HEAT_COOL_TOOLS.has(tool))  return '#c8a84b'
  if (STRESS_TOOLS.has(tool))     return '#c47a7a'
  if (HUMID_TOOLS.has(tool))      return '#7aad7a'
  return '#f0ede6'
}

const TOOL_LABELS = {
  turn_fan_on:              'Fan on',
  turn_fan_off:             'Fan off',
  set_fan_speed:            (p) => `Fan ${p?.speed_percent ?? '?'}%`,
  open_vent:                'Vent open',
  close_vent:               'Vent closed',
  turn_heater_on:           'Heater on',
  turn_heater_off:          'Heater off',
  turn_cooler_on:           'Cooler on',
  turn_cooler_off:          'Cooler off',
  turn_humidifier_on:       'Humid. on',
  turn_humidifier_off:      'Humid. off',
  turn_dehumidifier_on:     'Dehumid. on',
  turn_dehumidifier_off:    'Dehumid. off',
  set_climate_target:       (p) => `${p?.temp_c ?? '?'}°C / ${p?.humidity_percent ?? '?'}%`,
  enter_heat_stress_mode:   'Heat stress mode',
  enter_high_humidity_mode: 'High humidity mode',
}

function resolveLabel(tool, params) {
  const entry = TOOL_LABELS[tool]
  if (!entry) return tool
  if (typeof entry === 'function') return entry(params)
  return entry
}

function makeSprite(label, color) {
  const canvas = document.createElement('canvas')
  canvas.width = TOAST_W
  canvas.height = TOAST_H
  const ctx = canvas.getContext('2d')

  // background rounded rect
  const r = 10
  ctx.clearRect(0, 0, TOAST_W, TOAST_H)
  ctx.fillStyle = 'rgba(18,18,18,0.82)'
  ctx.beginPath()
  ctx.moveTo(r, 0)
  ctx.lineTo(TOAST_W - r, 0)
  ctx.quadraticCurveTo(TOAST_W, 0, TOAST_W, r)
  ctx.lineTo(TOAST_W, TOAST_H - r)
  ctx.quadraticCurveTo(TOAST_W, TOAST_H, TOAST_W - r, TOAST_H)
  ctx.lineTo(r, TOAST_H)
  ctx.quadraticCurveTo(0, TOAST_H, 0, TOAST_H - r)
  ctx.lineTo(0, r)
  ctx.quadraticCurveTo(0, 0, r, 0)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = color
  ctx.font = 'bold 15px Inter, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, TOAST_W / 2, TOAST_H / 2)

  const texture = new THREE.CanvasTexture(canvas)
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true })
  material.rotation = 0
  const sprite = new THREE.Sprite(material)
  // scale to look reasonable in world units (256x64 canvas → 2x0.5 world units)
  sprite.scale.set(2, 0.5, 1)
  return sprite
}

export default function AgentToasts({ agentEvents, mappedPods, onAutoOrbit }) {
  const { scene } = useThree()
  const processedCount = useRef(0)
  // podId -> [{ sprite, startMs, baseY }]
  const stacks = useRef({})

  // Build a podId -> position map from mappedPods
  const podPositions = useRef({})
  useEffect(() => {
    const map = {}
    for (const p of mappedPods) {
      map[p.pod_id] = p.position
    }
    podPositions.current = map
  }, [mappedPods])

  useEffect(() => {
    const newEvents = agentEvents.slice(processedCount.current)
    processedCount.current = agentEvents.length

    for (const ev of newEvents) {
      if (!ev.pod_id || ev.tool === 'no_op') continue

      const pos = podPositions.current[ev.pod_id]
      if (!pos) continue

      const label = resolveLabel(ev.tool, ev.params)
      const color = toolColor(ev.tool)
      const sprite = makeSprite(label, color)

      const stack = stacks.current[ev.pod_id] ?? []

      // Push existing toasts up
      for (const entry of stack) {
        entry.baseY += STACK_GAP
        entry.sprite.position.y = entry.baseY
      }

      // Remove bottom toast if over max
      if (stack.length >= MAX_PER_PLANT) {
        const removed = stack.shift()
        scene.remove(removed.sprite)
        removed.sprite.material.map?.dispose()
        removed.sprite.material.dispose()
      }

      const baseY = PLANT_TOP_Y
      sprite.position.set(pos[0], baseY, pos[2])
      sprite.scale.set(0, 0, 0)
      scene.add(sprite)

      stack.push({ sprite, startMs: performance.now(), baseY })
      stacks.current[ev.pod_id] = stack

      onAutoOrbit?.(ev.pod_id, pos)
    }
  }, [agentEvents, scene, onAutoOrbit])

  useFrame(() => {
    const now = performance.now()
    for (const [podId, stack] of Object.entries(stacks.current)) {
      const toRemove = []

      for (const entry of stack) {
        const elapsed = now - entry.startMs
        let opacity = 1
        let scale = 1

        if (elapsed < TOAST_POP_MS) {
          // ease-out pop-in: scale 0 → 1
          const t = elapsed / TOAST_POP_MS
          scale = t < 1 ? 1 - Math.pow(1 - t, 3) : 1
          opacity = 1
        } else if (elapsed < TOAST_POP_MS + TOAST_HOLD_MS) {
          scale = 1
          opacity = 1
        } else if (elapsed < TOAST_TOTAL_MS) {
          scale = 1
          opacity = 1 - (elapsed - TOAST_POP_MS - TOAST_HOLD_MS) / TOAST_FADE_MS
        } else {
          toRemove.push(entry)
          continue
        }

        entry.sprite.scale.set(scale * 2, scale * 0.5, 1)
        entry.sprite.material.opacity = opacity
        entry.sprite.position.y = entry.baseY
      }

      if (toRemove.length > 0) {
        for (const entry of toRemove) {
          scene.remove(entry.sprite)
          entry.sprite.material.map?.dispose()
          entry.sprite.material.dispose()
          const idx = stack.indexOf(entry)
          if (idx !== -1) stack.splice(idx, 1)

          // shift remaining stack down
          for (const remaining of stack) {
            remaining.baseY -= STACK_GAP
          }
        }
        if (stack.length === 0) {
          delete stacks.current[podId]
        }
      }
    }
  })

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      for (const stack of Object.values(stacks.current)) {
        for (const entry of stack) {
          scene.remove(entry.sprite)
          entry.sprite.material.map?.dispose()
          entry.sprite.material.dispose()
        }
      }
      stacks.current = {}
    }
  }, [scene])

  return null
}
