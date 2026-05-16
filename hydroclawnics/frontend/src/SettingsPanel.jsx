import { useEffect, useState } from 'react'

const THRESHOLD_KEY = 'hydro_thresholds'

const DEFAULT_THRESHOLDS = {
  ph_min: 6.0,
  ph_max: 7.0,
  water_warning: 40,
  water_critical: 20,
}

function loadThresholds() {
  try {
    return { ...DEFAULT_THRESHOLDS, ...JSON.parse(localStorage.getItem(THRESHOLD_KEY) || '{}') }
  } catch {
    return DEFAULT_THRESHOLDS
  }
}

function SectionCard({ title, children }) {
  return (
    <div
      className="mb-4 overflow-hidden rounded-lg border"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
    >
      <div className="border-b px-4 py-2.5" style={{ borderColor: 'var(--color-info)', borderBottomWidth: 2, background: 'var(--color-surface-2)' }}>
        <h3 className="text-sm font-semibold tracking-[-0.3px]" style={{ color: 'var(--color-text)' }}>{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function Field({ label, value, onChange, type = 'number', step = '0.1' }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <label className="text-sm" style={{ color: 'var(--color-muted)' }}>{label}</label>
      <input
        type={type}
        step={step}
        value={value}
        onChange={e => onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
        className="w-24 rounded-md border px-2 py-1 text-right text-sm font-mono font-semibold"
        style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
      />
    </div>
  )
}

export default function SettingsPanel({ pods = {}, connectionStatus }) {
  const podList = Object.values(pods)
  const [thresholds, setThresholds] = useState(loadThresholds)

  useEffect(() => {
    localStorage.setItem(THRESHOLD_KEY, JSON.stringify(thresholds))
  }, [thresholds])

  const set = (key) => (val) => setThresholds(prev => ({ ...prev, [key]: val }))

  const wouldWarn = podList.filter(p =>
    Number(p.water_level) < thresholds.water_warning ||
    Number(p.ph) < thresholds.ph_min ||
    Number(p.ph) > thresholds.ph_max
  ).length
  const wouldCrit = podList.filter(p => Number(p.water_level) < thresholds.water_critical).length

  const wsUrl = typeof window !== 'undefined'
    ? (import.meta.env?.DEV ? 'ws://localhost:8000/ws' : `ws://${window.location.host}/ws`)
    : '—'

  return (
    <div className="mx-auto max-w-xl py-4">
      <SectionCard title="Farm Config">
        <div className="space-y-1.5 text-sm">
          {[
            ['Total pods', podList.length],
            ['WebSocket', wsUrl],
            ['Connection', connectionStatus || 'disconnected'],
          ].map(([label, val]) => (
            <div key={label} className="flex justify-between">
              <span style={{ color: 'var(--color-muted)' }}>{label}</span>
              <span className="font-mono font-semibold" style={{ color: 'var(--color-text)' }}>{val}</span>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Alert Thresholds">
        <Field label="pH min" value={thresholds.ph_min} onChange={set('ph_min')} />
        <Field label="pH max" value={thresholds.ph_max} onChange={set('ph_max')} />
        <Field label="Water warning (%)" value={thresholds.water_warning} onChange={set('water_warning')} step="1" />
        <Field label="Water critical (%)" value={thresholds.water_critical} onChange={set('water_critical')} step="1" />
        <p className="mt-3 text-xs" style={{ color: 'var(--color-muted)' }}>
          At current thresholds: <span style={{ color: 'var(--color-warning)' }}>{wouldWarn} pods</span> would show warning,{' '}
          <span style={{ color: 'var(--color-critical)' }}>{wouldCrit} pods</span> would show critical.
        </p>
      </SectionCard>

      <SectionCard title="Display Preferences">
        <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
          Grid page size and sort order are saved automatically when changed in the Farm Overview tab.
        </p>
      </SectionCard>
    </div>
  )
}
