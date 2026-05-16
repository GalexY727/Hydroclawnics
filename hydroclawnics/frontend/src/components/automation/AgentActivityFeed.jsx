import { useState } from 'react'

const TOOL_LABELS = {
  turn_fan_on:          'Fan on',
  turn_fan_off:         'Fan off',
  set_fan_speed:        (p) => `Fan ${p?.speed_percent ?? '?'}%`,
  open_vent:            'Vent open',
  close_vent:           'Vent closed',
  turn_heater_on:       'Heater on',
  turn_heater_off:      'Heater off',
  turn_cooler_on:       'Cooler on',
  turn_cooler_off:      'Cooler off',
  turn_humidifier_on:   'Humid. on',
  turn_humidifier_off:  'Humid. off',
  turn_dehumidifier_on: 'Dehumid. on',
  turn_dehumidifier_off:'Dehumid. off',
  set_climate_target:   (p) => `${p?.temp_c ?? '?'}°C / ${p?.humidity_percent ?? '?'}%`,
  enter_heat_stress_mode:   'Heat stress mode',
  enter_high_humidity_mode: 'High humidity mode',
}

function toolLabel(tool, params) {
  const entry = TOOL_LABELS[tool]
  if (!entry) return tool
  if (typeof entry === 'function') return entry(params)
  return entry
}

function borderColor(cycle) {
  if (cycle.critical_zones?.length) return '#c47a7a'
  if (cycle.warning_zones?.length)  return '#c8a84b'
  if (cycle.actions_taken === 0)    return '#7aad7a'
  return 'var(--color-border)'
}

function formatTs(ts) {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return ts ?? ''
  }
}

function CycleCard({ cycle }) {
  const [expanded, setExpanded] = useState(false)
  const actions = cycle.actions ?? []

  return (
    <div
      className="rounded-lg border cursor-pointer select-none"
      style={{
        background: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
        borderLeft: `3px solid ${borderColor(cycle)}`,
        padding: '10px 12px',
      }}
      onClick={() => setExpanded(e => !e)}
    >
      <div className="flex items-center justify-between mb-1">
        <span style={{ color: 'var(--color-muted)', fontSize: 11 }}>{formatTs(cycle.ts)}</span>
        <span style={{ color: 'var(--color-muted)', fontSize: 11 }}>{cycle.duration_ms != null ? `${cycle.duration_ms}ms` : ''}</span>
      </div>

      <p style={{ fontWeight: 500, fontSize: 13, color: 'var(--color-text)', marginBottom: 6, lineHeight: 1.45 }}>
        {cycle.summary_text ?? 'No summary'}
      </p>

      {((cycle.critical_zones?.length ?? 0) + (cycle.warning_zones?.length ?? 0)) > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {(cycle.critical_zones ?? []).map(z => (
            <span key={z} style={{ background: '#c47a7a22', color: '#c47a7a', border: '1px solid #c47a7a55', borderRadius: 99, fontSize: 10, padding: '1px 7px' }}>
              {z}
            </span>
          ))}
          {(cycle.warning_zones ?? []).map(z => (
            <span key={z} style={{ background: '#c8a84b22', color: '#c8a84b', border: '1px solid #c8a84b55', borderRadius: 99, fontSize: 10, padding: '1px 7px' }}>
              {z}
            </span>
          ))}
        </div>
      )}

      {expanded && actions.length > 0 && (
        <div className="flex flex-col gap-2 mt-2 pt-2" style={{ borderTop: '1px solid var(--color-border)' }}>
          {actions.map((a, i) => (
            <div key={i} className="flex items-start gap-2">
              <span style={{ background: 'var(--color-surface-2)', color: 'var(--color-info)', border: '1px solid var(--color-border)', borderRadius: 99, fontSize: 10, padding: '1px 7px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {a.pod_id}
              </span>
              <div>
                <span style={{ color: 'var(--color-text)', fontSize: 12, fontWeight: 500 }}>
                  {toolLabel(a.tool, a.params)}
                </span>
                {a.reason && (
                  <p style={{ color: 'var(--color-muted)', fontSize: 11, marginTop: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {a.reason}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {expanded && actions.length === 0 && (
        <p style={{ color: 'var(--color-muted)', fontSize: 11, fontStyle: 'italic', marginTop: 6 }}>No actions this cycle</p>
      )}
    </div>
  )
}

export default function AgentActivityFeed({ agentCycles, connectionStatus }) {
  const isRunning = connectionStatus === 'connected'

  return (
    <div className="flex flex-col h-full" style={{ minHeight: 0 }}>
      <div className="flex items-center gap-2 mb-3 shrink-0">
        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text)' }}>Agent Activity</span>
        {isRunning && (
          <span className="agent-pulse-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: '#7aad7a', flexShrink: 0 }} />
        )}
      </div>

      <div className="flex flex-col gap-2 overflow-y-auto flex-1" style={{ minHeight: 0 }}>
        {agentCycles.length === 0 ? (
          <div className="flex items-center justify-center flex-1">
            <p style={{ color: 'var(--color-muted)', fontStyle: 'italic', fontSize: 13, textAlign: 'center' }}>
              Waiting for first agent cycle...
            </p>
          </div>
        ) : (
          agentCycles.map((cycle, i) => (
            <CycleCard key={cycle.cycle_id ?? i} cycle={cycle} />
          ))
        )}
      </div>
    </div>
  )
}
