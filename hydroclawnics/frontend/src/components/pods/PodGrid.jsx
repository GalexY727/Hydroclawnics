import { useMemo } from 'react'
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

const WATER_COLOR = (pct) => {
  const n = Number(pct) || 0
  if (n < 20) return 'var(--color-critical)'
  if (n < 50) return 'var(--color-warning)'
  return 'var(--color-info)'
}

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
  const waterPct = Number(pod.water_level) || 0
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
        borderLeftWidth: 3,
      }}
    >
      <div className="p-2.5">
        <div className="mb-0.5 flex min-w-0 items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.08em]" style={{ color: 'var(--color-muted)' }}>
          {pod.crop ? (
            <>
              <CropIcon crop={pod.crop} className="h-4 w-4" />
              <span className="truncate">{pod.crop}</span>
            </>
          ) : '—'}
        </div>
        <div className="mb-1.5 flex items-baseline justify-between gap-1">
          <span className="text-[12px] font-bold leading-none" style={{ color: 'var(--color-text)' }}>
            {pod.id}
          </span>
          {hasFault && (
            <span
              className="truncate text-[9px] font-bold leading-none"
              style={{ color: pod.status === 'critical' ? 'var(--color-critical)' : 'var(--color-warning)' }}
            >
              {pod.fault_type}
            </span>
          )}
        </div>

        <div className="grid grid-cols-[auto_1fr_auto_1fr] items-baseline gap-x-1.5 gap-y-0.5">
          {([
            ['pH',  (Number(pod.ph) || 0).toFixed(2)],
            ['EC',  `${Math.round(Number(pod.ec_ppm) || 0)}`],
            ['°C',  (Number(pod.air_temp_c) || 0).toFixed(1)],
            ['RH',  `${Math.round(Number(pod.humidity) || 0)}%`],
          ]).map(([label, val]) => (
            <div key={label} className="contents">
              <span className="text-[9px]" style={{ color: 'var(--color-muted)' }}>{label}</span>
              <span className="text-right font-mono text-[10px] font-semibold" style={{ color: 'var(--color-text)' }}>{val}</span>
            </div>
          ))}
        </div>

        <div className="mt-1.5">
          <div className="mb-1 flex justify-between text-[9px]" style={{ color: 'var(--color-muted)' }}>
            <span>Water</span>
            <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{waterPct}%</span>
          </div>
          <div className="h-[3px] overflow-hidden rounded-sm" style={{ background: 'var(--color-surface-2)' }}>
            <div
              className="h-full rounded-sm transition-[width] duration-300"
              style={{ width: `${waterPct}%`, background: WATER_COLOR(waterPct) }}
            />
          </div>
        </div>
      </div>
    </button>
  )
}

function Toolbar({ grid, cropTypes }) {
  const { statusFilter, setStatusFilter, cropFilter, setCropFilter, sort, setSort, total, counts } = grid

  const toggleCrop = (crop) => {
    setCropFilter(prev =>
      prev.includes(crop) ? prev.filter(c => c !== crop) : [...prev, crop]
    )
  }

  const totalAll = Object.values(counts).reduce((a, b) => a + b, 0)

  return (
    <div
      className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
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
            className="rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all duration-150"
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
          className="rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all duration-150 capitalize"
          style={{
            background: cropFilter.includes(crop) ? 'var(--color-info)' : 'var(--color-surface-2)',
            color: cropFilter.includes(crop) ? 'var(--color-bg)' : 'var(--color-muted)',
            borderColor: cropFilter.includes(crop) ? 'var(--color-info)' : 'var(--color-border)',
          }}
        >
          <span className="inline-flex items-center gap-1.5">
            <CropIcon crop={crop} className="h-4 w-4" />
            <span>{crop}</span>
          </span>
        </button>
      ))}

      <div className="h-5 w-px" style={{ background: 'var(--color-border)' }} />
      <select
        value={sort}
        onChange={e => setSort(e.target.value)}
        className="rounded-md border px-2 py-1 text-[11px] font-semibold"
        style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
      >
        {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      <span className="ml-auto text-[11px]" style={{ color: 'var(--color-muted)' }}>
        {total} pod{total !== 1 ? 's' : ''}
      </span>
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
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
      <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>
        Pods <strong style={{ color: 'var(--color-text)' }}>{start}–{end}</strong> of <strong style={{ color: 'var(--color-text)' }}>{total}</strong>
      </span>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
          className="grid h-7 w-7 place-items-center rounded-md border text-sm transition-colors disabled:opacity-30"
          style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
        >‹</button>

        {pages.map((p, i) =>
          p === '…'
            ? <span key={`e${i}`} className="px-1 text-xs" style={{ color: 'var(--color-muted)' }}>…</span>
            : (
              <button
                key={p}
                type="button"
                onClick={() => setPage(p)}
                className="grid h-7 w-7 place-items-center rounded-md border text-xs font-semibold transition-colors"
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
          className="grid h-7 w-7 place-items-center rounded-md border text-sm transition-colors disabled:opacity-30"
          style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
        >›</button>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>Per page</span>
        <select
          value={perPage}
          onChange={e => setPerPage(Number(e.target.value))}
          className="rounded-md border px-2 py-1 text-[11px]"
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

  if (grid.total === 0 && Object.keys(pods).length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border text-sm italic" style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>
        Waiting for pod telemetry...
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <Toolbar grid={grid} cropTypes={cropTypes} />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
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
