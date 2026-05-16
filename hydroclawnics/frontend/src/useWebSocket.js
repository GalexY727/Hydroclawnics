import { useEffect, useMemo, useRef, useState } from 'react'

const WS_RETRY_MS = 2000
const MAX_HISTORY = 20
const MAX_AGENT_LOG = 50

function withHistory(podsById, incomingPods) {
  const timestamp = new Date().toISOString()
  return incomingPods.reduce((next, pod) => {
    const previous = next[pod.id] || {}
    const history = [
      ...(previous.history || []),
      {
        ph: Number(pod.ph || 0),
        ec_ppm: Number(pod.ec_ppm || 0),
        temp_c: Number(pod.temp_c || 0),
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
  const [connectionStatus, setConnectionStatus] = useState('connecting')
  const reconnectRef = useRef(null)
  const wsRef = useRef(null)

  const wsUrl = useMemo(() => {
    // # FIX: Use the FastAPI socket directly in Vite dev, and the current host after production build.
    if (import.meta.env.DEV) {
      return 'ws://localhost:8000/ws'
    }
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

  return { pods, agentLog, connectionStatus }
}
