import { FAULT_TYPES, TARGET_RANGES } from '../../data/operations'

const MODES = ['Observe Only', 'Recommend', 'Auto-fix Low Risk', 'Supervised Autopilot']

function Field({ label, children }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
      <span style={{ color: 'var(--color-muted)' }}>{label}</span>
      {children}
    </label>
  )
}

function EventRow({ event }) {
  return (
    <article className="rounded-md border p-3" style={{ borderColor: 'var(--color-border)', background: 'rgba(8, 13, 20, 0.58)' }}>
      <div className="flex items-center justify-between gap-2">
        <span className={`severity-chip severity-${event.severity}`}>{event.severity}</span>
        <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>{event.lifecycle}</span>
      </div>
      <div className="mt-2 text-sm font-semibold">{event.action}</div>
      <p className="mt-1 text-xs leading-5" style={{ color: 'var(--color-muted)' }}>{event.podId} / {event.result}</p>
    </article>
  )
}

export default function AgentActivityFeed({ connectionStatus, events, policy, setPolicy, onSimulateFault, simulationMessage }) {
  const set = (key, value) => setPolicy((current) => ({ ...current, [key]: value }))
  const setAllowed = (faultId) => setPolicy((current) => ({
    ...current,
    allowedActions: { ...current.allowedActions, [faultId]: !current.allowedActions[faultId] },
  }))

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Automation</h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--color-muted)' }}>Policy-based agent operation with auditable safety limits.</p>
          </div>
          <span className="rounded-md border px-3 py-2 text-xs capitalize" style={{ borderColor: 'var(--color-border)', color: connectionStatus === 'connected' ? 'var(--color-success)' : 'var(--color-warning)' }}>
            {connectionStatus}
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
        <section className="app-panel rounded-md p-4">
          <h2 className="text-base font-semibold">Agent Mode</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => set('mode', mode)}
                className="rounded-md border p-3 text-left text-sm font-semibold"
                style={{
                  borderColor: policy.mode === mode ? 'var(--color-info)' : 'var(--color-border)',
                  background: policy.mode === mode ? 'rgba(108, 195, 255, 0.14)' : 'var(--color-surface)',
                }}
              >
                {mode}
              </button>
            ))}
          </div>
        </section>

        <section className="app-panel rounded-md p-4">
          <h2 className="text-base font-semibold">Safety Limits</h2>
          <div className="mt-3 space-y-2">
            <Field label="Human approval for severe interventions">
              <input type="checkbox" checked={policy.requireApproval} onChange={(event) => set('requireApproval', event.target.checked)} />
            </Field>
            <Field label="Max dosing per hour">
              <input
                type="number"
                min="0"
                max="80"
                value={policy.maxDosePerHour}
                onChange={(event) => set('maxDosePerHour', Number(event.target.value))}
                className="w-20 rounded-md border px-2 py-1 text-right"
                style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
              />
            </Field>
            <Field label="Sensor calibration schedule">
              <select
                value={policy.calibrationCadence}
                onChange={(event) => set('calibrationCadence', event.target.value)}
                className="rounded-md border px-2 py-1"
                style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
              >
                {['Every 24 hours', 'Every 72 hours', 'Weekly'].map((item) => <option key={item}>{item}</option>)}
              </select>
            </Field>
          </div>
        </section>

        <section className="app-panel rounded-md p-4">
          <h2 className="text-base font-semibold">Allowed Actions By Fault</h2>
          <div className="mt-3 grid gap-2">
            {FAULT_TYPES.map((fault) => (
              <label key={fault.id} className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
                <span>
                  <span className="font-semibold">{fault.label}</span>
                  <span className="ml-2 text-xs" style={{ color: 'var(--color-muted)' }}>{fault.action}</span>
                </span>
                <input type="checkbox" checked={Boolean(policy.allowedActions[fault.id])} onChange={() => setAllowed(fault.id)} />
              </label>
            ))}
          </div>
        </section>

        <section className="app-panel rounded-md p-4">
          <h2 className="text-base font-semibold">Crop Targets</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {['ph', 'ec_ppm', 'water_temp_c', 'humidity'].map((metric) => {
              const range = TARGET_RANGES[metric]
              return (
                <div key={metric} className="rounded-md border p-3" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
                  <div className="text-sm font-semibold">{range.label}</div>
                  <div className="mt-1 text-xs" style={{ color: 'var(--color-muted)' }}>
                    Target {range.min}-{range.max}{range.unit}
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section className="app-panel rounded-md p-4">
          <h2 className="text-base font-semibold">Fault Simulation</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {FAULT_TYPES.slice(0, 6).map((fault) => (
              <button
                key={fault.id}
                type="button"
                onClick={() => onSimulateFault(fault.id)}
                className="rounded-md border p-3 text-left text-sm"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
              >
                <div className="font-semibold">{fault.label}</div>
                <div className="mt-1 text-xs" style={{ color: 'var(--color-muted)' }}>{fault.issue}</div>
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs" style={{ color: 'var(--color-warning)' }}>{simulationMessage}</p>
        </section>

        <section className="app-panel rounded-md p-4">
          <h2 className="text-base font-semibold">Recent Automation Outcomes</h2>
          <div className="mt-3 space-y-2">
            {events.slice(0, 8).map((event) => <EventRow key={event.id} event={event} />)}
          </div>
        </section>
      </div>
    </div>
  )
}
