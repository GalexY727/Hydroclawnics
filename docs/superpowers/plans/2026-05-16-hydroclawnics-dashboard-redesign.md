# Hydroclawnics Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Hydroclawnics dashboard into a polished "Command Center" with a camera-refactored 3D view, scalable 2D grid with filter/sort/pagination, schema sync, growth-stage plant geometry, and cohesive micro-animations.

**Architecture:** Approach B — extract camera logic into `useCameraControls.js`, extract grid logic into `usePodGrid.js`, replace the tab switcher with pill tabs in the Navbar, and layer all new features on those clean foundations. The agent log becomes a collapsible right drawer; Settings becomes a real tab.

**Tech Stack:** React 18, Three.js via `@react-three/fiber` + `@react-three/drei`, Tailwind CSS v3, custom CSS variables (Gruvbox palette), Recharts for sparklines, Vite.

> **Note on testing:** This project has no test runner configured. "Verify" steps mean open the dev server (`cd hydroclawnics/frontend && npm run dev`) and confirm the described behavior in the browser. Logic-only hooks are verified by console-logging during dev, then cleaning up.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/useWebSocket.js` | Modify | Map new backend schema fields to frontend aliases |
| `src/globals.css` | Modify | New keyframes, tabular-number font feature, CSS vars |
| `src/App.jsx` | Modify | Three-tab state, drawer layout, remove PhysicalPot from sidebar |
| `src/Navbar.jsx` | Modify | Pill-tab switcher, colored health dots |
| `src/tabSwitcher.jsx` | Delete | Replaced by Navbar pill tabs |
| `src/usePodGrid.js` | Create | Filter, sort, paginate logic for 2D grid |
| `src/PodGrid.jsx` | Modify | Toolbar, new card layout (Style C + left border), pagination |
| `src/PhysicalPot.jsx` | Modify | Renders as a wide first-card inside the grid |
| `src/useCameraControls.js` | Create | Orbit focus, free-roam WASD, camera reset logic |
| `src/Farm3D.jsx` | Modify | Close button, background click reset, HUD chip, wire useCameraControls |
| `src/useFarm3D.js` | Modify | Dynamic column count, plant_height_cm scale |
| `src/PodMesh.jsx` | Modify | Growth-stage geometry, emissive pulse on warning/critical |
| `src/PlantPreview.jsx` | Create | Isolated mini Three.js canvas for modal |
| `src/PodDetailModal.jsx` | Modify | PlantPreview embed, new schema fields, modal enter animation |
| `src/AgentLog.jsx` | Modify | Slide-in animation per entry, pod status dot |
| `src/SettingsPanel.jsx` | Create | Three-section settings tab |

---

## Task 1: Schema sync in useWebSocket.js

**Files:**
- Modify: `hydroclawnics/frontend/src/useWebSocket.js`

The backend now sends `plant_status` (not `status`), `fault_type`, `plant_height_cm`, `water_temp_c`, `air_temp_c`, `relative_humidity_percent`, `water_level_percent`, `pump_status`, `flow_rate_l_min`. We normalize these to consistent frontend field names inside `withHistory`.

- [ ] **Step 1: Update `withHistory` to map new schema fields**

Replace the entire `withHistory` function in `src/useWebSocket.js`:

```js
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
        timestamp,
      },
    ].slice(-MAX_HISTORY)
    next[pod.id] = { ...previous, ...pod, history }
    return next
  }, { ...podsById })
}
```

- [ ] **Step 2: Verify — start dev server and confirm no console errors**

```bash
cd hydroclawnics/frontend && npm run dev
```

Open browser console. If the WebSocket is connected, confirm `pods` object has `status`, `fault_type`, `water_level`, `air_temp_c` fields (add a temporary `console.log(pods)` in `App.jsx`, then remove it).

- [ ] **Step 3: Commit**

```bash
git add hydroclawnics/frontend/src/useWebSocket.js
git commit -m "feat: sync frontend data layer to new backend schema fields"
```

---

## Task 2: CSS foundation

**Files:**
- Modify: `hydroclawnics/frontend/src/globals.css`

Add keyframes for: tab fade transition, modal enter, status badge pulse, agent log slide-in. Also add tabular number rendering.

- [ ] **Step 1: Append new CSS to `globals.css`**

Add at the bottom of `src/globals.css`:

```css
/* Tabular numbers — prevents layout jitter on live metric updates */
.font-mono,
[class*="font-mono"] {
  font-feature-settings: 'tnum';
}

/* Tab content fade + lift */
@keyframes tab-enter {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.tab-enter {
  animation: tab-enter 150ms ease forwards;
}

/* Modal scale-in */
@keyframes modal-enter {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}
.modal-enter {
  animation: modal-enter 200ms ease forwards;
}

/* Status badge pulse (triggered by React key change) */
@keyframes badge-pop {
  0%   { transform: scale(1); }
  50%  { transform: scale(1.15); }
  100% { transform: scale(1); }
}
.badge-pop {
  animation: badge-pop 300ms ease;
}

/* Agent log entry slide-in */
@keyframes log-slide-in {
  from { opacity: 0; transform: translateY(-8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.log-entry {
  animation: log-slide-in 150ms ease forwards;
}

/* Free-camera HUD chip */
@keyframes hud-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
.hud-chip {
  animation: hud-fade-in 200ms ease forwards;
}

/* Collapsible drawer transition */
.drawer-open {
  transition: width 250ms ease, opacity 250ms ease;
}
```

- [ ] **Step 2: Verify — confirm no CSS parse errors**

Check browser console after hot-reload. No errors expected.

- [ ] **Step 3: Commit**

```bash
git add hydroclawnics/frontend/src/globals.css
git commit -m "feat: add animation keyframes and tabular-number rendering to CSS"
```

---

## Task 3: App.jsx — Command Center layout

**Files:**
- Modify: `hydroclawnics/frontend/src/App.jsx`

Replace stacked layout with: top Navbar (contains pill tabs), main area (active view), right drawer (agent log). Three tab values: `'overview'` | `'farm'` | `'settings'`.

- [ ] **Step 1: Rewrite `App.jsx`**

```jsx
import { useMemo, useState } from 'react'
import AgentLog from './AgentLog'
import Farm3D from './Farm3D'
import Navbar from './Navbar'
import PodDetailModal from './PodDetailModal'
import PodGrid from './PodGrid'
import SettingsPanel from './SettingsPanel'
import useWebSocket from './useWebSocket'

export default function App() {
  const { pods, agentLog, connectionStatus } = useWebSocket()
  const [tab, setTab] = useState('overview')
  const [detailPodId, setDetailPodId] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(true)

  const podList = useMemo(() => Object.values(pods), [pods])

  const healthSummary = useMemo(() =>
    podList.reduce(
      (s, pod) => { s[pod.status] = (s[pod.status] || 0) + 1; return s },
      { healthy: 0, warning: 0, critical: 0 },
    ), [podList])

  return (
    <div className="flex h-screen flex-col overflow-hidden" style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
      <Navbar
        connectionStatus={connectionStatus}
        healthSummary={healthSummary}
        tab={tab}
        onTabChange={setTab}
        drawerOpen={drawerOpen}
        onDrawerToggle={() => setDrawerOpen(o => !o)}
      />

      <div className="flex min-h-0 flex-1">
        {/* Main content */}
        <main className="min-h-0 flex-1 overflow-hidden p-3">
          {tab === 'overview' && (
            <div key="overview" className="tab-enter h-full">
              <PodGrid pods={pods} onSelect={setDetailPodId} />
            </div>
          )}
          {tab === 'farm' && (
            <div key="farm" className="tab-enter h-full">
              <Farm3D pods={pods} onPodSelect={setDetailPodId} onClose={() => setTab('overview')} />
            </div>
          )}
          {tab === 'settings' && (
            <div key="settings" className="tab-enter h-full overflow-y-auto">
              <SettingsPanel pods={pods} connectionStatus={connectionStatus} />
            </div>
          )}
        </main>

        {/* Right drawer — agent log */}
        {drawerOpen && (
          <aside
            className="drawer-open hidden shrink-0 border-l p-3 lg:block"
            style={{ width: 280, borderColor: 'var(--color-border)' }}
          >
            <AgentLog entries={agentLog} connectionStatus={connectionStatus} pods={pods} />
          </aside>
        )}
      </div>

      <PodDetailModal
        pod={detailPodId ? pods[detailPodId] : null}
        agentLog={agentLog}
        onClose={() => setDetailPodId(null)}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify — page renders with three tabs, drawer visible**

Open browser. Should see Navbar (tabs not wired yet — that's Task 4), main area, and right rail. No console errors.

- [ ] **Step 3: Commit**

```bash
git add hydroclawnics/frontend/src/App.jsx
git commit -m "feat: restructure App to command-center layout with tab state and agent log drawer"
```

---

## Task 4: Navbar — pill tabs + colored health dots

**Files:**
- Modify: `hydroclawnics/frontend/src/Navbar.jsx`
- Delete: `hydroclawnics/frontend/src/tabSwitcher.jsx`

- [ ] **Step 1: Rewrite `Navbar.jsx`**

```jsx
import lettuceLogo from '../../../media/lettuce.png'

const statusColor = {
  connected: 'var(--color-success)',
  connecting: 'var(--color-warning)',
  disconnected: 'var(--color-critical)',
}

const TABS = [
  { id: 'overview', label: 'Farm Overview' },
  { id: 'farm',     label: '3D Farm' },
  { id: 'settings', label: 'Settings' },
]

export default function Navbar({ connectionStatus, healthSummary, tab, onTabChange, drawerOpen, onDrawerToggle }) {
  const status = connectionStatus || 'disconnected'

  return (
    <header
      className="flex h-14 shrink-0 items-center gap-4 border-b px-3 md:px-4"
      style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
    >
      {/* Logo */}
      <div className="flex shrink-0 items-center gap-2.5">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md border p-1" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
          <img src={lettuceLogo} alt="" className="h-full w-full object-contain" />
        </div>
        <span className="hidden text-base font-semibold tracking-[-0.8px] sm:block" style={{ color: 'var(--color-text)' }}>
          Hydroclawnics
        </span>
      </div>

      {/* Pill tab switcher */}
      <nav
        className="flex items-center gap-1 rounded-full border p-1"
        style={{ background: 'var(--color-bg)', borderColor: 'var(--color-border)' }}
        aria-label="Main navigation"
      >
        {TABS.map(t => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onTabChange(t.id)}
              className="rounded-full px-3 py-1 text-xs font-semibold transition-all duration-200"
              style={{
                background: active ? 'var(--color-info)' : 'transparent',
                color: active ? 'var(--color-bg)' : 'var(--color-muted)',
              }}
            >
              {t.label}
            </button>
          )
        })}
      </nav>

      {/* Right side */}
      <div className="ml-auto flex shrink-0 items-center gap-3 text-xs" style={{ color: 'var(--color-muted)' }}>
        {/* Health summary with colored dots */}
        <div className="hidden items-center gap-3 sm:flex">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: 'var(--color-success)' }} />
            {healthSummary.healthy}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: 'var(--color-warning)' }} />
            {healthSummary.warning}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: 'var(--color-critical)' }} />
            {healthSummary.critical}
          </span>
        </div>

        {/* WS status */}
        <div className="flex items-center gap-1.5">
          <span className="connection-dot h-2 w-2 rounded-full" style={{ background: statusColor[status] || statusColor.disconnected }} />
          <span className="hidden md:inline capitalize">{status}</span>
        </div>

        {/* Drawer toggle */}
        <button
          type="button"
          onClick={onDrawerToggle}
          className="grid h-8 w-8 place-items-center rounded-md transition-colors"
          style={{ background: drawerOpen ? 'var(--color-hover)' : 'transparent' }}
          aria-label="Toggle agent log"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M15 3v18" />
          </svg>
        </button>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Delete `tabSwitcher.jsx`**

```bash
rm hydroclawnics/frontend/src/tabSwitcher.jsx
```

- [ ] **Step 3: Verify — three pill tabs switch views, drawer toggles**

Click Farm Overview → 3D Farm → Settings. Each tab should render its content (Settings will be empty until Task 12). Drawer toggle button shows/hides the right panel.

- [ ] **Step 4: Commit**

```bash
git add hydroclawnics/frontend/src/Navbar.jsx
git rm hydroclawnics/frontend/src/tabSwitcher.jsx
git commit -m "feat: replace tab switcher with pill tabs in Navbar, add colored health dots and drawer toggle"
```

---

## Task 5: usePodGrid.js — filter, sort, paginate hook

**Files:**
- Create: `hydroclawnics/frontend/src/usePodGrid.js`

Pure logic hook. No JSX. All filter/sort/paginate state lives here.

- [ ] **Step 1: Create `src/usePodGrid.js`**

```js
import { useEffect, useMemo, useState } from 'react'

const PAGE_SIZE_KEY = 'hydro_per_page'
const SORT_KEY = 'hydro_sort'

function sortPods(pods, sort) {
  const arr = [...pods]
  const statusOrder = { critical: 0, warning: 1, healthy: 2 }
  switch (sort) {
    case 'status':
      return arr.sort((a, b) => (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3))
    case 'crop':
      return arr.sort((a, b) => (a.crop || '').localeCompare(b.crop || ''))
    case 'water_asc':
      return arr.sort((a, b) => (Number(a.water_level) || 100) - (Number(b.water_level) || 100))
    case 'age_newest':
      return arr.sort((a, b) => (Number(b.age_hours) || 0) - (Number(a.age_hours) || 0))
    case 'modified':
      return arr.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
    case 'id':
    default:
      return arr.sort((a, b) => (a.id || '').localeCompare(b.id || ''))
  }
}

export default function usePodGrid(pods) {
  const podList = useMemo(() => Object.values(pods), [pods])

  const [statusFilter, setStatusFilter] = useState('all')
  const [cropFilter, setCropFilter] = useState([]) // [] = all crops shown
  const [sort, setSort] = useState(() => localStorage.getItem(SORT_KEY) || 'status')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(() => {
    const saved = localStorage.getItem(PAGE_SIZE_KEY)
    return saved ? Number(saved) : 12
  })

  useEffect(() => { localStorage.setItem(PAGE_SIZE_KEY, String(perPage)) }, [perPage])
  useEffect(() => { localStorage.setItem(SORT_KEY, sort) }, [sort])

  // Reset to page 1 whenever filters/sort/perPage change
  useEffect(() => { setPage(1) }, [statusFilter, cropFilter, sort, perPage])

  const cropTypes = useMemo(
    () => [...new Set(podList.map(p => p.crop).filter(Boolean))].sort(),
    [podList],
  )

  const counts = useMemo(
    () => podList.reduce((acc, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1
      return acc
    }, { healthy: 0, warning: 0, critical: 0 }),
    [podList],
  )

  const filtered = useMemo(() => {
    let result = podList
    if (statusFilter !== 'all') result = result.filter(p => p.status === statusFilter)
    if (cropFilter.length > 0) result = result.filter(p => cropFilter.includes(p.crop))
    return sortPods(result, sort)
  }, [podList, statusFilter, cropFilter, sort])

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage))
  const safePage = Math.min(page, totalPages)
  const paginated = useMemo(
    () => filtered.slice((safePage - 1) * perPage, safePage * perPage),
    [filtered, safePage, perPage],
  )

  return {
    paginated,
    total: filtered.length,
    counts,
    cropTypes,
    page: safePage,
    totalPages,
    setPage,
    sort, setSort,
    statusFilter, setStatusFilter,
    cropFilter, setCropFilter,
    perPage, setPerPage,
  }
}
```

- [ ] **Step 2: Verify logic manually**

Temporarily add in `App.jsx`:
```js
import usePodGrid from './usePodGrid'
// inside App, after podList:
const grid = usePodGrid(pods)
console.log('grid', grid.paginated.length, grid.total, grid.counts)
```
With 20 pods: `total` should be 20, `counts` should sum to 20. Remove the log when done.

- [ ] **Step 3: Commit**

```bash
git add hydroclawnics/frontend/src/usePodGrid.js
git commit -m "feat: add usePodGrid hook with filter, sort, and paginate logic"
```

---

## Task 6: PodGrid.jsx — revamp with toolbar, new cards, pagination

**Files:**
- Modify: `hydroclawnics/frontend/src/PodGrid.jsx`
- Modify: `hydroclawnics/frontend/src/PhysicalPot.jsx`

- [ ] **Step 1: Rewrite `PodGrid.jsx`**

```jsx
import { useMemo } from 'react'
import PhysicalPot from './PhysicalPot'
import usePodGrid from './usePodGrid'

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

const CROP_EMOJI = { basil: '🌱', lettuce: '🥬', spinach: '🍃' }

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
        {/* Crop above ID */}
        <div className="mb-0.5 text-[9px] font-bold uppercase tracking-[0.08em]" style={{ color: 'var(--color-muted)' }}>
          {pod.crop ? `${CROP_EMOJI[pod.crop] || ''} ${pod.crop}` : '—'}
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

        {/* 2×2 metric grid */}
        <div className="grid grid-cols-[auto_1fr_auto_1fr] items-baseline gap-x-1.5 gap-y-0.5">
          {[
            ['pH',  (Number(pod.ph) || 0).toFixed(2)],
            ['EC',  `${Math.round(Number(pod.ec_ppm) || 0)}`],
            ['°C',  (Number(pod.air_temp_c) || 0).toFixed(1)],
            ['RH',  `${Math.round(Number(pod.humidity) || 0)}%`],
          ].map(([label, val]) => (
            <>
              <span key={`l-${label}`} className="text-[9px]" style={{ color: 'var(--color-muted)' }}>{label}</span>
              <span key={`v-${label}`} className="text-right font-mono text-[10px] font-semibold" style={{ color: 'var(--color-text)' }}>{val}</span>
            </>
          ))}
        </div>

        {/* Water level bar */}
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

  return (
    <div
      className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      {/* Status filters */}
      <div className="flex flex-wrap items-center gap-1.5">
        {[
          { id: 'all',      label: `All (${Object.values(counts).reduce((a, b) => a + b, 0)})`, color: 'var(--color-info)' },
          { id: 'critical', label: `Critical (${counts.critical})`, color: 'var(--color-critical)' },
          { id: 'warning',  label: `Warning (${counts.warning})`,  color: 'var(--color-warning)' },
          { id: 'healthy',  label: `Healthy (${counts.healthy})`,  color: 'var(--color-success)' },
        ].map(({ id, label, color }) => (
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

      {/* Divider */}
      {cropTypes.length > 0 && (
        <div className="h-5 w-px" style={{ background: 'var(--color-border)' }} />
      )}

      {/* Crop filters (multi-select) */}
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
          {CROP_EMOJI[crop] || ''} {crop}
        </button>
      ))}

      {/* Sort */}
      <div className="h-5 w-px" style={{ background: 'var(--color-border)' }} />
      <select
        value={sort}
        onChange={e => setSort(e.target.value)}
        className="rounded-md border px-2 py-1 text-[11px] font-semibold"
        style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
      >
        {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      {/* Result count */}
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
          {/* Physical pot as first wide card */}
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
```

- [ ] **Step 2: Update `PhysicalPot.jsx` — remove the standalone section wrapper, keep its internals**

The component already renders its own `<section>`. Remove the outer section so it can sit inside the grid's `col-span-2` div. Change the opening element from `<section ...>` to `<div ...>` so PodGrid controls layout.

In `PhysicalPot.jsx`, replace:
```jsx
return (
  <section className="shrink-0 rounded-lg border p-3" ...>
```
with:
```jsx
return (
  <div className="h-full rounded-lg border p-3" ...>
```
And the closing `</section>` → `</div>`.

- [ ] **Step 3: Verify — grid shows toolbar, cards, pagination, PhysicalPot spans two columns**

20 pods should show 12 per page. Filter by Critical — count should match. Sort by water level — lowest should appear first. Per-page change reloads grid size.

- [ ] **Step 4: Commit**

```bash
git add hydroclawnics/frontend/src/PodGrid.jsx hydroclawnics/frontend/src/PhysicalPot.jsx
git commit -m "feat: revamp PodGrid with filter/sort/paginate toolbar, Style-C cards, and PhysicalPot integration"
```

---

## Task 7: useCameraControls.js — orbit + free-roam hook

**Files:**
- Create: `hydroclawnics/frontend/src/useCameraControls.js`

- [ ] **Step 1: Create `src/useCameraControls.js`**

```js
import { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

const DEFAULT_POS    = new THREE.Vector3(0, 9, 12)
const DEFAULT_TARGET = new THREE.Vector3(0, 0, 0)
const LERP           = 0.08
const SETTLED        = 0.02
const SPEED          = 0.1

export default function useCameraControls() {
  const orbitRef      = useRef(null)
  const modeRef       = useRef('free')       // 'free' | 'orbiting'
  const focusPosRef   = useRef(null)         // THREE.Vector3 orbit look-at, null = center
  const camTargetRef  = useRef(null)         // THREE.Vector3 camera position target
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

  // Called from useFrame inside the Canvas
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

    // WASD free-roam
    const k = keysRef.current
    if (!k.w && !k.a && !k.s && !k.d && !k.space && !k.c) return

    const fwd = new THREE.Vector3()
    camera.getWorldDirection(fwd)
    fwd.y = 0
    fwd.normalize()
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize()

    if (k.w) { camera.position.addScaledVector(fwd, SPEED);   controls.target.addScaledVector(fwd, SPEED) }
    if (k.s) { camera.position.addScaledVector(fwd, -SPEED);  controls.target.addScaledVector(fwd, -SPEED) }
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
```

- [ ] **Step 2: Commit (not wired yet — wired in Task 8)**

```bash
git add hydroclawnics/frontend/src/useCameraControls.js
git commit -m "feat: add useCameraControls hook for orbit focus and WASD free-roam camera"
```

---

## Task 8: Farm3D.jsx — wire camera hook, close button, HUD

**Files:**
- Modify: `hydroclawnics/frontend/src/Farm3D.jsx`

- [ ] **Step 1: Rewrite `Farm3D.jsx`**

```jsx
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import PodMesh from './PodMesh'
import useCameraControls from './useCameraControls'
import useFarm3D from './useFarm3D'

function Scene({ mappedPods, onPodSelect, controls }) {
  const { orbitRef, tick, handleBackgroundClick } = controls

  useFrame((state) => tick(state))

  return (
    <>
      <color attach="background" args={['#0f1419']} />
      <ambientLight intensity={0.85} />
      <directionalLight position={[-5, 9, 6]} intensity={1.05} />

      {/* Clickable ground plane — triggers camera reset */}
      <mesh
        rotation-x={-Math.PI / 2}
        position={[0, -0.01, 0]}
        onClick={handleBackgroundClick}
      >
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#1a1f2e" roughness={0.95} />
      </mesh>

      {mappedPods.map((pod) => (
        <PodMesh
          key={pod.pod_id}
          pod={pod}
          onPodSelect={(podId, position) => {
            controls.selectPod(position)
            window.setTimeout(() => onPodSelect?.(podId), 420)
          }}
        />
      ))}

      <OrbitControls ref={orbitRef} autoRotate={controls.mode === 'free'} autoRotateSpeed={0.4} />
    </>
  )
}

export default function Farm3D({ pods, onPodSelect, onClose }) {
  const mappedPods = useFarm3D(pods)
  const controls = useCameraControls()

  return (
    <div
      className="relative h-full overflow-hidden rounded-lg border"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg)' }}
    >
      <Canvas camera={{ position: [0, 9, 12], fov: 50 }} gl={{ antialias: true }}>
        <Scene mappedPods={mappedPods} onPodSelect={onPodSelect} controls={controls} />
      </Canvas>

      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-md border transition-all hover:scale-105"
        style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
        aria-label="Close 3D view"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>

      {/* Free-camera HUD chip */}
      {controls.showHud && controls.mode === 'free' && (
        <div
          className="hud-chip absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border px-3 py-1 text-xs"
          style={{ background: 'var(--color-surface-2)', borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}
        >
          Free camera · WASD / Space / C
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify — 3D tab opens, click plant orbits, click ground resets, X button returns to overview, WASD moves in free mode**

Also confirm orbit is now freely rotatable after camera settles on a pod (no more lock after lerp).

- [ ] **Step 3: Commit**

```bash
git add hydroclawnics/frontend/src/Farm3D.jsx
git commit -m "feat: wire useCameraControls into Farm3D, add close button and free-camera HUD chip"
```

---

## Task 9: useFarm3D.js + PodMesh.jsx — growth stages

**Files:**
- Modify: `hydroclawnics/frontend/src/useFarm3D.js`
- Modify: `hydroclawnics/frontend/src/PodMesh.jsx`

- [ ] **Step 1: Update `useFarm3D.js`**

```js
const STATUS_COLOR = {
  healthy:  '#7fb069',
  warning:  '#d4a373',
  critical: '#c9566b',
}

function gridColumns(count) {
  if (count <= 20) return 5
  if (count <= 64) return 8
  return 10
}

export default function useFarm3D(pods) {
  const list = Object.values(pods)
  const cols = gridColumns(list.length)
  return list.map((pod, idx) => {
    const col = idx % cols
    const row = Math.floor(idx / cols)
    const heightScale = Math.min(1.4, Math.max(0.5, (Number(pod.plant_height_cm) || 10) / 15))
    return {
      pod_id: pod.id,
      status: pod.status,
      age_hours: Number(pod.age_hours) || 0,
      heightScale,
      color: STATUS_COLOR[pod.status] || STATUS_COLOR.healthy,
      position: [(col - (cols - 1) / 2) * 3, 0, (row - 1) * 3],
    }
  })
}
```

- [ ] **Step 2: Rewrite `PodMesh.jsx` with growth stages and emissive pulse**

```jsx
import { useRef } from 'react'
import { Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'

function stageGeometry(ageHours) {
  if (ageHours < 12)  return { stemH: 0.4, stemR: 0.5, foliageR: 0.20, foliageY: 0.70 }
  if (ageHours < 36)  return { stemH: 0.6, stemR: 0.5, foliageR: 0.30, foliageY: 1.00 }
  if (ageHours < 60)  return { stemH: 0.65, stemR: 0.5, foliageR: 0.45, foliageY: 1.10 }
  return               { stemH: 0.65, stemR: 0.5, foliageR: 0.60, foliageY: 1.20 }
}

export default function PodMesh({ pod, onPodSelect }) {
  const foliageRef = useRef()
  const { stemH, stemR, foliageR, foliageY } = stageGeometry(pod.age_hours)
  const isAlerted = pod.status === 'warning' || pod.status === 'critical'

  useFrame(({ clock }) => {
    if (!foliageRef.current || !isAlerted) return
    foliageRef.current.emissiveIntensity = 0.05 + 0.10 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * Math.PI))
  })

  return (
    <group
      position={pod.position}
      onClick={(e) => { e.stopPropagation(); onPodSelect?.(pod.pod_id, pod.position) }}
    >
      {/* Pot / stem */}
      <mesh position={[0, stemH / 2, 0]}>
        <cylinderGeometry args={[stemR, stemR, stemH, 32]} />
        <meshStandardMaterial color="#6a6a6a" roughness={0.85} metalness={0.05} />
      </mesh>

      {/* Foliage sphere */}
      <mesh position={[0, foliageY, 0]} scale={pod.heightScale}>
        <sphereGeometry args={[foliageR, 32, 32]} />
        <meshStandardMaterial
          ref={foliageRef}
          color={pod.color}
          roughness={0.6}
          metalness={0}
          emissive={pod.color}
          emissiveIntensity={isAlerted ? 0.08 : 0}
        />
      </mesh>

      {/* Second small sphere for mature stage */}
      {pod.age_hours >= 60 && (
        <mesh position={[0.3, foliageY + 0.3, 0.1]} scale={pod.heightScale * 0.55}>
          <sphereGeometry args={[foliageR, 24, 24]} />
          <meshStandardMaterial color={pod.color} roughness={0.65} metalness={0} emissive={pod.color} emissiveIntensity={0.04} />
        </mesh>
      )}

      <Text
        position={[0, -0.08, stemR + 0.05]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.28}
        color="#f5f1de"
        anchorX="center"
        anchorY="middle"
      >
        {pod.pod_id}
      </Text>
    </group>
  )
}
```

- [ ] **Step 3: Verify — 3D farm shows growth stage differences, warning/critical pods pulse gently, pod count ≥ 20 uses 5-column layout**

- [ ] **Step 4: Commit**

```bash
git add hydroclawnics/frontend/src/useFarm3D.js hydroclawnics/frontend/src/PodMesh.jsx
git commit -m "feat: add growth-stage geometry and emissive pulse to PodMesh, dynamic grid columns in useFarm3D"
```

---

## Task 10: PlantPreview.jsx + PodDetailModal.jsx updates

**Files:**
- Create: `hydroclawnics/frontend/src/PlantPreview.jsx`
- Modify: `hydroclawnics/frontend/src/PodDetailModal.jsx`

- [ ] **Step 1: Create `src/PlantPreview.jsx`**

```jsx
import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import PodMesh from './PodMesh'

function PreviewScene({ pod }) {
  const mockMappedPod = {
    pod_id: pod.id,
    status: pod.status,
    age_hours: Number(pod.age_hours) || 0,
    heightScale: Math.min(1.4, Math.max(0.5, (Number(pod.plant_height_cm) || 10) / 15)),
    color: { healthy: '#7fb069', warning: '#d4a373', critical: '#c9566b' }[pod.status] || '#7fb069',
    position: [0, 0, 0],
  }
  return (
    <>
      <ambientLight intensity={0.9} />
      <directionalLight position={[-3, 6, 4]} intensity={1.1} />
      <PodMesh pod={mockMappedPod} />
      <OrbitControls autoRotate autoRotateSpeed={1.5} enableZoom={false} />
    </>
  )
}

export default function PlantPreview({ pod }) {
  if (!pod) return null
  return (
    <div
      className="mb-5 overflow-hidden rounded-md border"
      style={{ height: 160, borderColor: 'var(--color-border)', background: '#0f1419' }}
    >
      <Suspense fallback={
        <div className="flex h-full items-center justify-center text-xs italic" style={{ color: 'var(--color-muted)' }}>
          Loading preview...
        </div>
      }>
        <Canvas camera={{ position: [3, 3, 4], fov: 45 }}>
          <PreviewScene pod={pod} />
        </Canvas>
      </Suspense>
    </div>
  )
}
```

- [ ] **Step 2: Update `PodDetailModal.jsx` — add PlantPreview, new schema fields, modal-enter animation**

In `PodDetailModal.jsx`:

1. Import `PlantPreview`:
```jsx
import PlantPreview from './PlantPreview'
```

2. Add `modal-enter` class to the `<section>` element:
```jsx
<section
  className="modal-enter max-h-[92vh] w-full max-w-[600px] overflow-y-auto rounded-lg border p-6 md:p-8"
  ...
>
```

3. Insert `<PlantPreview pod={pod} />` between the header `</div>` and the metric cards `<div className="grid grid-cols-2...">`.

4. Add two new `ReadingCard` entries in the metric grid (after the existing 6):
```jsx
<ReadingCard label="Water" value={pod.water_level != null ? `${Math.round(Number(pod.water_level))}%` : '--'} />
<ReadingCard label="Humidity" value={pod.humidity != null ? `${Math.round(Number(pod.humidity))}%` : '--'} />
<ReadingCard label="Pump" value={pod.pump_status ? 'On' : 'Off'} />
<ReadingCard label="Flow" value={pod.flow_rate != null ? `${Number(pod.flow_rate).toFixed(1)} L/m` : '--'} />
```

5. Show `fault_type` below the status badge in the modal header if it isn't `'none'`:
```jsx
{pod.fault_type && pod.fault_type !== 'none' && (
  <p className="mt-1 text-xs font-semibold" style={{ color: pod.status === 'critical' ? 'var(--color-critical)' : 'var(--color-warning)' }}>
    Fault: {pod.fault_type}
  </p>
)}
```

- [ ] **Step 3: Verify — click a pod card, modal opens with 3D preview auto-rotating, new fields visible**

- [ ] **Step 4: Commit**

```bash
git add hydroclawnics/frontend/src/PlantPreview.jsx hydroclawnics/frontend/src/PodDetailModal.jsx
git commit -m "feat: add 3D PlantPreview to modal and display new schema fields (water, humidity, pump, flow)"
```

---

## Task 11: AgentLog.jsx — slide-in animation + pod status dot

**Files:**
- Modify: `hydroclawnics/frontend/src/AgentLog.jsx`

- [ ] **Step 1: Add `pods` prop and status dot to each log entry**

`AgentLog` now receives a `pods` prop from `App.jsx` (already passed in Task 3). Add a status dot next to each entry that references a pod.

In `AgentLog.jsx`, update the component signature:
```jsx
export default function AgentLog({ entries, connectionStatus, pods = {} }) {
```

Add a status-dot helper and wrap each entry in the `log-entry` animation class. Replace however entries are currently rendered with:

```jsx
const STATUS_DOT_COLOR = { healthy: 'var(--color-success)', warning: 'var(--color-warning)', critical: 'var(--color-critical)' }

// Inside the entries map:
{entries.map((entry, i) => {
  const podStatus = entry.pod_id ? pods[entry.pod_id]?.status : null
  return (
    <div key={entry.timestamp ?? i} className="log-entry border-b py-2 text-xs" style={{ borderColor: 'var(--color-border)' }}>
      <div className="flex items-start gap-2">
        {podStatus && (
          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full" style={{ background: STATUS_DOT_COLOR[podStatus] || STATUS_DOT_COLOR.healthy }} />
        )}
        <div className="min-w-0 flex-1">
          <span className="font-semibold" style={{ color: 'var(--color-text)' }}>{entry.pod_id ?? '—'}</span>
          {' '}
          <span style={{ color: 'var(--color-muted)' }}>{entry.action ?? entry.message ?? ''}</span>
        </div>
      </div>
    </div>
  )
})}
```

- [ ] **Step 2: Verify — new agent log entries slide in from top, pod status dots match pod status color**

- [ ] **Step 3: Commit**

```bash
git add hydroclawnics/frontend/src/AgentLog.jsx
git commit -m "feat: add slide-in animation and pod status dot to AgentLog entries"
```

---

## Task 12: SettingsPanel.jsx — three-section settings tab

**Files:**
- Create: `hydroclawnics/frontend/src/SettingsPanel.jsx`

- [ ] **Step 1: Create `src/SettingsPanel.jsx`**

```jsx
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

export default function SettingsPanel({ pods, connectionStatus }) {
  const podList = Object.values(pods)
  const [thresholds, setThresholds] = useState(loadThresholds)

  useEffect(() => {
    localStorage.setItem(THRESHOLD_KEY, JSON.stringify(thresholds))
  }, [thresholds])

  const set = (key) => (val) => setThresholds(prev => ({ ...prev, [key]: val }))

  // Live preview: how many pods would trigger each threshold
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
```

- [ ] **Step 2: Verify — Settings tab shows three sections, threshold fields update live preview count, values persist on page reload**

- [ ] **Step 3: Commit**

```bash
git add hydroclawnics/frontend/src/SettingsPanel.jsx
git commit -m "feat: add SettingsPanel with farm config, alert thresholds, and localStorage persistence"
```

---

## Task 13: Final cleanup and `.gitignore` update

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Add `.superpowers/` to `.gitignore`**

```bash
echo '.superpowers/' >> .gitignore
```

- [ ] **Step 2: Verify full app end-to-end**

Run through this checklist in the browser:
- [ ] Farm Overview loads with toolbar, cards, pagination
- [ ] Filter by Critical shows only critical pods
- [ ] Filter by crop type works (multi-select)
- [ ] Sort by Water level ↑ puts lowest-water pods first
- [ ] Per-page selector changes grid density
- [ ] Click a pod card → modal opens with 3D plant preview auto-rotating
- [ ] Modal shows fault_type, water level, humidity, pump, flow rate
- [ ] 3D Farm tab loads, plants show size differences by age
- [ ] Warning/critical pods have a slow emissive pulse
- [ ] Click a pod in 3D → camera orbits it smoothly, then orbits freely
- [ ] Click ground in 3D → camera resets to center
- [ ] X button in 3D → returns to Farm Overview
- [ ] WASD in free mode moves camera
- [ ] HUD chip appears on keypress, fades after 3s
- [ ] Settings tab shows farm config and threshold preview
- [ ] Drawer toggle shows/hides agent log
- [ ] Agent log entries have colored status dots
- [ ] No console errors

- [ ] **Step 3: Final commit**

```bash
git add .gitignore
git commit -m "chore: add .superpowers to gitignore"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| 3D click-off resets camera | Task 8 (`handleBackgroundClick`) |
| X button closes 3D view | Task 8 (close button → `onClose`) |
| Full 360° orbit after focus | Task 7 (settled check stops lerping) |
| Warning/critical badges on 2D cards | Task 6 (`PodCard`, left accent border) |
| 2D grid scalable + responsive | Task 6 (responsive grid-cols, usePodGrid) |
| Filter by status + crop type | Task 6 (Toolbar), Task 5 (usePodGrid) |
| Sort options | Task 5 + 6 |
| Pagination (12/24/48) | Task 6 (Pagination), Task 5 (usePodGrid) |
| WASD + Space/C free-roam | Task 7 (tick function) |
| Free-camera HUD chip | Task 8 |
| Command Center layout | Task 3 (App.jsx), Task 4 (Navbar) |
| Settings tab with depth | Task 12 |
| Pill tab switcher | Task 4 (Navbar) |
| Schema sync | Task 1 |
| Growth stages (4 stages) | Task 9 (PodMesh) |
| plant_height_cm geometry scale | Task 9 (useFarm3D) |
| Emissive pulse warning/critical | Task 9 (PodMesh useFrame) |
| 3D preview in modal | Task 10 (PlantPreview) |
| Tab fade animation | Task 2 (CSS), Task 3 (tab-enter class) |
| Modal enter animation | Task 2 (CSS), Task 10 |
| Agent log slide-in | Task 2 (CSS), Task 11 |
| Agent log pod status dot | Task 11 |
| Tabular number font feature | Task 2 |
| Colored health dots in navbar | Task 4 |
| Drawer toggle | Task 3 + 4 |
| Crop above pod ID on card | Task 6 (PodCard) |
| fault_type on card | Task 6 (PodCard) |
| Water level bar with color thresholds | Task 6 (PodCard, WATER_COLOR) |
| Dynamic 3D grid columns | Task 9 (useFarm3D gridColumns) |
| Settings: alert thresholds localStorage | Task 12 |
| .superpowers in .gitignore | Task 13 |

All spec requirements covered. No gaps found.
