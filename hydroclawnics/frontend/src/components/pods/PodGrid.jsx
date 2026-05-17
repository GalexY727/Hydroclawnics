import { useMemo, useState } from 'react'
import PhysicalPot from './PhysicalPot'
import usePodGrid from '../../hooks/usePodGrid'
import CropIcon from '../CropIcon'

const SORT_OPTIONS = [
  { value: 'status',     label: 'Status (critical first)' },
  { value: 'crop',       label: 'Plant type' },
  { value: 'water_asc',  label: 'Water level ↑' },
  { value: 'age_newest', label: 'Age (newest)' },
  { value: 'modified',   label: 'Last modified' },
  { value: 'id',         label: 'Pod ID' },
]


const SIMULATION_FAULTS = [
  { id: 'ph_crash', label: 'pH crash' },
  { id: 'nutrient_spike', label: 'Nutrient spike' },
  { id: 'nutrient_low', label: 'Nutrient low' },
]

const STATUS_BORDER = {
  healthy:  'var(--color-success)',
  warning:  'var(--color-warning)',
  critical: 'var(--color-critical)',
}

const STATUS_BG = {
  critical: '#1c1620',
}

function PodCard({ pod, onSelect }) {
  const borderColor = STATUS_BORDER[pod.status] || STATUS_BORDER.healthy
  const bg = STATUS_BG[pod.status] || 'var(--color-surface)'
  const hasFault = pod.fault_type && pod.fault_type !== 'none'

  return (
    <button
      type="button"
      onClick={() => onSelect?.(pod.id)}
      className="min-w-0 rounded-md border text-left transition-all duration-200 hover:brightness-110"
      style={{
        background: bg,
        borderColor: 'var(--color-border)',
        borderLeftColor: borderColor,
        borderLeftWidth: 4,
      }}
    >
      <div className="p-3.5">
        <div className="mb-1 flex min-w-0 items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: 'var(--color-muted)' }}>
          {pod.crop ? (
            <>
              <CropIcon crop={pod.crop} className="h-5 w-5" />
              <span className="truncate">{pod.crop}</span>
            </>
          ) : '—'}
        </div>
        <div className="mb-2.5 flex items-baseline justify-between gap-2">
          <span className="text-base font-bold leading-none" style={{ color: 'var(--color-text)' }}>
            {pod.id}
          </span>
          {hasFault && (
            <span
              className="truncate text-[11px] font-bold leading-none"
              style={{ color: pod.status === 'critical' ? 'var(--color-critical)' : 'var(--color-warning)' }}
            >
              {pod.fault_type}
            </span>
          )}
        </div>

        <div className="grid grid-cols-[auto_1fr_auto_1fr] items-baseline gap-x-2 gap-y-1">
          {([
            ['pH',  (Number(pod.ph) || 0).toFixed(2)],
            ['EC',  `${Math.round(Number(pod.ec_ppm) || 0)}`],
            ['°C',  (Number(pod.air_temp_c) || 0).toFixed(1)],
            ['RH',  `${Math.round(Number(pod.humidity) || 0)}%`],
          ]).map(([label, val]) => (
            <div key={label} className="contents">
              <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>{label}</span>
              <span className="text-right font-mono text-xs font-semibold" style={{ color: 'var(--color-text)' }}>{val}</span>
            </div>
          ))}
        </div>

        
      </div>
    </button>
  )
}

function Toolbar({ grid, cropTypes, simulation }) {
  const { statusFilter, setStatusFilter, cropFilter, setCropFilter, sort, setSort, total, counts } = grid

  const toggleCrop = (crop) => {
    setCropFilter(prev =>
      prev.includes(crop) ? prev.filter(c => c !== crop) : [...prev, crop]
    )
  }

  const totalAll = Object.values(counts).reduce((a, b) => a + b, 0)

  return (
    <div
      className="mb-4 flex flex-wrap items-center gap-2.5 rounded-lg border px-4 py-3"
      style={{ background: 'var(--color-panel)', borderColor: 'var(--color-border-strong)' }}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {([
          { id: 'all',      label: `All (${totalAll})`,              color: 'var(--color-info)' },
          { id: 'critical', label: `Critical (${counts.critical})`,  color: 'var(--color-critical)' },
          { id: 'warning',  label: `Warning (${counts.warning})`,    color: 'var(--color-warning)' },
          { id: 'healthy',  label: `Healthy (${counts.healthy})`,    color: 'var(--color-success)' },
        ]).map(({ id, label, color }) => (
          <button
            key={id}
            type="button"
            onClick={() => setStatusFilter(id)}
            className="rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-150"
            style={{
              background: statusFilter === id ? color : 'var(--color-surface-2)',
              color: statusFilter === id ? 'var(--color-bg)' : 'var(--color-muted)',
              borderColor: statusFilter === id ? color : 'var(--color-border)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {cropTypes.length > 0 && (
        <div className="h-5 w-px" style={{ background: 'var(--color-border)' }} />
      )}

      {cropTypes.map(crop => (
        <button
          key={crop}
          type="button"
          onClick={() => toggleCrop(crop)}
          className="rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-150 capitalize"
          style={{
            background: cropFilter.includes(crop) ? 'var(--color-info)' : 'var(--color-surface-2)',
            color: cropFilter.includes(crop) ? 'var(--color-bg)' : 'var(--color-muted)',
            borderColor: cropFilter.includes(crop) ? 'var(--color-info)' : 'var(--color-border)',
          }}
        >
          <span className="inline-flex items-center gap-1.5">
            <CropIcon crop={crop} className="h-5 w-5" />
            <span>{crop}</span>
          </span>
        </button>
      ))}

      <div className="h-5 w-px" style={{ background: 'var(--color-border)' }} />
      <select
        value={sort}
        onChange={e => setSort(e.target.value)}
        className="rounded-md border px-3 py-1.5 text-xs font-semibold"
        style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
      >
        {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      <span className="ml-auto text-xs" style={{ color: 'var(--color-muted)' }}>
        {total} pod{total !== 1 ? 's' : ''}
      </span>

      <button
        type="button"
        onClick={simulation.onInjectFault}
        disabled={simulation.busy || simulation.disabled}
        className="rounded-md border px-3 py-1.5 text-xs font-bold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50"
        style={{
          background: 'rgba(201, 86, 107, 0.18)',
          borderColor: 'var(--color-critical)',
          color: 'var(--color-text)',
        }}
      >
        {simulation.busy ? 'Injecting...' : 'Simulate fault'}
      </button>

      {simulation.message && (
        <span className="text-xs font-medium" style={{ color: simulation.error ? 'var(--color-critical)' : 'var(--color-warning)' }}>
          {simulation.message}
        </span>
      )}
    </div>
  )
}

function Pagination({ page, totalPages, setPage, perPage, setPerPage, total }) {
  const start = (page - 1) * perPage + 1
  const end = Math.min(page * perPage, total)

  const pages = useMemo(() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1)
    if (page <= 3) return [1, 2, 3, 4, '…', totalPages]
    if (page >= totalPages - 2) return [1, '…', totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
    return [1, '…', page - 1, page, page + 1, '…', totalPages]
  }, [page, totalPages])

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3" style={{ background: 'var(--color-panel)', borderColor: 'var(--color-border)' }}>
      <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
        Pods <strong style={{ color: 'var(--color-text)' }}>{start}–{end}</strong> of <strong style={{ color: 'var(--color-text)' }}>{total}</strong>
      </span>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
          className="grid h-8 w-8 place-items-center rounded-md border text-base transition-colors disabled:opacity-30"
          style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
        >‹</button>

        {pages.map((p, i) =>
          p === '…'
            ? <span key={`e${i}`} className="px-1 text-sm" style={{ color: 'var(--color-muted)' }}>…</span>
            : (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                className="grid h-8 w-8 place-items-center rounded-md border text-sm font-semibold transition-colors"
                style={{
                  background: page === p ? 'var(--color-info)' : 'var(--color-surface-2)',
                  color: page === p ? 'var(--color-bg)' : 'var(--color-muted)',
                  borderColor: page === p ? 'var(--color-info)' : 'var(--color-border)',
                }}
              >{p}</button>
            )
        )}

        <button
          type="button"
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
          className="grid h-8 w-8 place-items-center rounded-md border text-base transition-colors disabled:opacity-30"
          style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
        >›</button>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="text-xs" style={{ color: 'var(--color-muted)' }}>Per page</span>
        <select
          value={perPage}
          onChange={e => setPerPage(Number(e.target.value))}
          className="rounded-md border px-3 py-1.5 text-xs"
          style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
        >
          {[12, 24, 48].map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
    </div>
  )
}

export default function PodGrid({ pods, onSelect }) {
  const grid = usePodGrid(pods)
  const physicalPod = pods.pod_00 || Object.values(pods)[0] || null
  const cropTypes = grid.cropTypes
  const [simulationBusy, setSimulationBusy] = useState(false)
  const [simulationMessage, setSimulationMessage] = useState('')
  const [simulationError, setSimulationError] = useState(false)

  const simulationPods = useMemo(
    () => Object.values(pods).filter((pod) => pod.id && pod.id !== physicalPod?.id),
    [pods, physicalPod?.id],
  )

  const injectSimulationFault = async () => {
    if (simulationPods.length === 0 || simulationBusy) {
      return
    }

    const pod = simulationPods[Math.floor(Math.random() * simulationPods.length)]
    const fault = SIMULATION_FAULTS[Math.floor(Math.random() * SIMULATION_FAULTS.length)]

    setSimulationBusy(true)
    setSimulationError(false)
    setSimulationMessage(`Sending ${fault.label} to ${pod.id}...`)

    try {
      const response = await fetch(`/api/fault/${encodeURIComponent(pod.id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fault: fault.id }),
      })
      if (!response.ok) {
        throw new Error(`Fault request failed (${response.status})`)
      }
      setSimulationMessage(`${pod.id}: ${fault.label}`)
      onSelect?.(pod.id)
    } catch {
      setSimulationError(true)
      setSimulationMessage('Could not inject fault')
    } finally {
      setSimulationBusy(false)
    }
  }

  if (grid.total === 0 && Object.keys(pods).length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border text-sm italic" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>
        Waiting for pod telemetry...
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <Toolbar
        grid={grid}
        cropTypes={cropTypes}
        simulation={{
          busy: simulationBusy,
          disabled: simulationPods.length === 0,
          error: simulationError,
          message: simulationMessage,
          onInjectFault: injectSimulationFault,
        }}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {physicalPod && (
            <div className="col-span-2">
              <PhysicalPot pods={pods} />
            </div>
          )}
          {grid.paginated.map(pod => (
            <PodCard key={pod.id} pod={pod} onSelect={onSelect} />
          ))}
        </div>
      </div>

      <Pagination
        page={grid.page}
        totalPages={grid.totalPages}
        setPage={grid.setPage}
        perPage={grid.perPage}
        setPerPage={grid.setPerPage}
        total={grid.total}
      />
    </div>
  )
}
