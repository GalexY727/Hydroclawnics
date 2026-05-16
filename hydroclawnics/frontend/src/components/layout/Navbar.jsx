import appIcon from '../../../../../media/icon.ico'

const statusColor = {
  connected: 'var(--color-success)',
  connecting: 'var(--color-warning)',
  disconnected: 'var(--color-critical)',
}

const TABS = [
  { id: 'overview',   label: 'Farm Overview' },
  { id: 'farm',       label: '3D Farm' },
  { id: 'automation', label: 'Automation' },
  { id: 'settings',   label: 'Settings' },
]

export default function Navbar({ connectionStatus, healthSummary, tab, onTabChange, drawerOpen, onDrawerToggle }) {
  const status = connectionStatus || 'disconnected'

  return (
    <header
      className="flex h-16 shrink-0 items-center gap-5 border-b px-4 md:px-5"
      style={{ background: 'var(--color-panel)', borderColor: 'var(--color-border-strong)' }}
    >
      <div className="flex shrink-0 items-center gap-2.5">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md border p-1.5" style={{ borderColor: 'var(--color-border-strong)', background: 'var(--color-surface)' }}>
          <img src={appIcon} alt="" className="h-full w-full object-contain" />
        </div>
        <span className="hidden text-lg font-semibold sm:block" style={{ color: 'var(--color-text)' }}>
          Hydro
            <span style={{ background: 'linear-gradient(135deg, #ff69b4, #ff1493, #ff69b4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                claw
            </span>
          nics
        </span>
      </div>

      <nav
        className="flex items-center gap-1.5 rounded-full border p-1.5"
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
              className="rounded-full px-3.5 py-1.5 text-sm font-semibold transition-all duration-200"
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

      <div className="ml-auto flex shrink-0 items-center gap-4 text-sm" style={{ color: 'var(--color-muted)' }}>
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

        <div className="flex items-center gap-1.5">
          <span className="connection-dot h-2 w-2 rounded-full" style={{ background: statusColor[status] || statusColor.disconnected }} />
          <span className="hidden md:inline capitalize">{status}</span>
        </div>

        <button
          type="button"
          onClick={onDrawerToggle}
          className="grid h-9 w-9 place-items-center rounded-md transition-colors"
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
