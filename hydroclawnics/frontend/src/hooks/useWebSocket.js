import { useEffect, useMemo, useRef, useState } from 'react'

const WS_RETRY_MS = 2000
const MAX_HISTORY = 20
const MAX_AGENT_LOG = 50
const MAX_AGENT_CYCLES = 50

function withHistory(podsById, incomingPods) {
  const timestamp = new Date().toISOString()
  return incomingPods.reduce((next, raw) => {
    const pod = {
      id: raw.id,
      crop: raw.crop,
      age_hours: raw.age_hours,
      plant_height_cm: raw.plant_height_cm ?? 10,
      status: raw.plant_status ?? raw.status ?? 'healthy',
      fault_type: raw.fault_type ?? 'none',
      ph: raw.ph,
      ec_ppm: raw.ec_ppm,
      water_temp_c: raw.water_temp_c ?? raw.temp_c,
      air_temp_c: raw.air_temp_c ?? raw.temp_c,
      humidity: raw.relative_humidity_percent ?? raw.humidity,
      water_level: raw.water_level_percent ?? raw.water_level,
      light_lux: raw.light_lux,
      pump_status: raw.pump_status ?? true,
      flow_rate: raw.flow_rate_l_min ?? raw.flow_rate,
      last_action: raw.last_action,
      timestamp: raw.timestamp ?? timestamp,
    }
    const previous = next[pod.id] || {}
    const history = [
      ...(previous.history || []),
      {
        ph: Number(pod.ph || 0),
        ec_ppm: Number(pod.ec_ppm || 0),
        water_temp_c: Number(pod.water_temp_c || 0),
        water_level: Number(pod.water_level || 0),
        light_lux: Number(pod.light_lux || 0),
        timestamp,
      },
    ].slice(-MAX_HISTORY)
    next[pod.id] = { ...previous, ...pod, history }
    return next
  }, { ...podsById })
}

export default function useWebSocket() {
  const [pods, setPods] = useState({})
  const [agentLog, setAgentLog] = useState([])
  const [agentCycles, setAgentCycles] = useState([])
  const [podAgentUpdates, setPodAgentUpdates] = useState([])
  const [connectionStatus, setConnectionStatus] = useState('connecting')
  const reconnectRef = useRef(null)
  const wsRef = useRef(null)

  const wsUrl = useMemo(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    return `${protocol}://${window.location.host}/ws`
  }, [])

  useEffect(() => {
    let mounted = true
    let intentionallyClosed = false

    const connect = () => {
      if (!mounted) {
        return
      }
      setConnectionStatus('connecting')
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        // # FIX: Keep onopen passive so the backend never receives unexpected startup payloads.
        if (mounted) {
          setConnectionStatus('connected')
        }
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          if (message.type === 'pod_update') {
            // # FIX: Store pods by id and append the last 20 sensor readings per pod on every update.
            setPods((prev) => withHistory(prev, message.pods ?? []))
          } else if (message.type === 'agent_decision' && message.entry) {
            // # FIX: Retain only the newest 50 decisions so the feed stays responsive during long demos.
            setAgentLog((prev) => [message.entry, ...prev].slice(0, MAX_AGENT_LOG))
          } else if (message.type === 'agent_cycle_summary') {
            setAgentCycles((prev) => [message, ...prev].slice(0, MAX_AGENT_CYCLES))
          } else if (message.type === 'pod_agent_update') {
            setPodAgentUpdates((prev) => [...prev, message])
          } else if (message.type === 'heartbeat') {
            // # FIX: Accept backend keep-alives without mutating dashboard data.
            setConnectionStatus('connected')
          }
        } catch {
          // ignore malformed payloads
        }
      }

      ws.onerror = () => {
        if (mounted) {
          setConnectionStatus('disconnected')
        }
      }

      ws.onclose = () => {
        if (!mounted) {
          return
        }
        setConnectionStatus('disconnected')
        // # FIX: Reconnect only after unexpected closes; cleanup closes should stay quiet.
        if (!intentionallyClosed) {
          reconnectRef.current = setTimeout(connect, WS_RETRY_MS)
        }
      }
    }

    connect()

    return () => {
      mounted = false
      intentionallyClosed = true
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current)
      }
      if (wsRef.current && wsRef.current.readyState < 2) {
        wsRef.current.close()
      }
    }
  }, [wsUrl])

  return { pods, agentLog, agentCycles, podAgentUpdates, connectionStatus }
}
