# Hydroclawnics Design Tokens

Created `hydroclawnics/frontend/src/tokens.css` as a standalone token layer for the dashboard redesign. No component files were edited.

## Decisions

- Dark mode is the default token set through `:root` and `color-scheme: dark`.
- Light mode is handled with `@media (prefers-color-scheme: light)` and only overrides color tokens that need a different light-surface value.
- The green accent family stays unchanged in light mode to preserve the plant-app identity.
- Danger, warning, and info use Apple-style light-mode variants for better fit on white surfaces.
- Spacing uses a 12-step dashboard-friendly scale: compact 4px/8px increments at the low end, then larger 8px rhythm steps up to 96px.
- `--font-family` is included as the shared typography stack token.

## Tokens Created

### Typography

| Token | Value |
| --- | --- |
| `--font-family` | `-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", system-ui, sans-serif` |
| `--font-size-xs` | `11px` |
| `--font-size-sm` | `13px` |
| `--font-size-base` | `15px` |
| `--font-size-lg` | `17px` |
| `--font-size-xl` | `22px` |
| `--font-size-2xl` | `28px` |
| `--font-size-3xl` | `34px` |
| `--font-weight-regular` | `400` |
| `--font-weight-medium` | `500` |
| `--font-weight-semibold` | `600` |
| `--tracking-tight` | `-0.3px` |
| `--tracking-normal` | `0` |
| `--tracking-wide` | `0.5px` |

### Colors

| Token | Dark value | Light override |
| --- | --- | --- |
| `--color-bg-base` | `#0a0a0a` | `#f5f5f7` |
| `--bg-elevated` | `#141414` | `#ffffff` |
| `--bg-panel` | `#1c1c1e` | `#ffffff` |
| `--bg-card` | `#242426` | `#f2f2f7` |
| `--bg-hover` | `#2c2c2e` | `#e5e5ea` |
| `--color-text-primary` | `#f5f5f7` | `#1d1d1f` |
| `--text-secondary` | `#aeaeb2` | `#3a3a3c` |
| `--text-tertiary` | `#636366` | `#6e6e73` |
| `--text-disabled` | `#48484a` | `#aeaeb2` |
| `--color-accent` | `#30d158` | unchanged |
| `--accent-muted` | `#1a7a32` | unchanged |
| `--accent-subtle` | `#0d3d1a` | unchanged |
| `--color-danger` | `#ff453a` | `#ff3b30` |
| `--warning` | `#ff9f0a` | `#ff9500` |
| `--info` | `#0a84ff` | `#007aff` |
| `--success` | `#30d158` | `#30d158` |
| `--color-border` | `#2c2c2e` | `#d1d1d6` |
| `--border-subtle` | `#1c1c1e` | `#e5e5ea` |
| `--border-strong` | `#3a3a3c` | `#c7c7cc` |

### Spacing

| Token | Value |
| --- | --- |
| `--space-1` | `4px` |
| `--space-2` | `8px` |
| `--space-3` | `12px` |
| `--space-4` | `16px` |
| `--space-5` | `24px` |
| `--space-6` | `32px` |
| `--space-7` | `40px` |
| `--space-8` | `48px` |
| `--space-9` | `56px` |
| `--space-10` | `64px` |
| `--space-11` | `80px` |
| `--space-12` | `96px` |

### Radius

| Token | Value |
| --- | --- |
| `--radius-sm` | `6px` |
| `--radius-md` | `10px` |
| `--radius-lg` | `14px` |
| `--radius-xl` | `20px` |
| `--radius-full` | `9999px` |

### Effects

| Token | Value |
| --- | --- |
| `--blur-panel` | `blur(20px)` |
| `--shadow-card` | `0 1px 3px rgba(0, 0, 0, 0.4), 0 4px 16px rgba(0, 0, 0, 0.3)` |
| `--shadow-elevated` | `0 8px 32px rgba(0, 0, 0, 0.5)` |
