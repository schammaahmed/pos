import { LayoutGrid, List } from 'lucide-react'

// Small shared building blocks so every page looks like the same app instead of
// each screen inventing its own spacing and colours.

// Maps a semantic tone to the token pair defined in index.css. Written out in
// full because Tailwind scans source text - it cannot see `bg-${tone}-soft`.
const TONES = {
  primary: { text: 'text-primary', tile: 'bg-primary-soft text-primary', pill: 'bg-primary-soft text-primary' },
  success: { text: 'text-success', tile: 'bg-success-soft text-success', pill: 'bg-success-soft text-success' },
  accent: { text: 'text-accent', tile: 'bg-accent-soft text-accent', pill: 'bg-accent-soft text-accent' },
  warning: { text: 'text-warning', tile: 'bg-warning-soft text-warning', pill: 'bg-warning-soft text-warning' },
  info: { text: 'text-info', tile: 'bg-info-soft text-info', pill: 'bg-info-soft text-info' },
  neutral: { text: 'text-gray-900', tile: 'bg-gray-100 text-gray-400', pill: 'bg-gray-100 text-gray-600' },
}

// list <-> raster switch, used on Teilnehmer, Produkte and the sales log
export function ViewToggle({ view, onChange }) {
  const btn = (active) =>
    `flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg ${
      active ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
    }`

  return (
    <div className="flex bg-gray-100 rounded-lg p-1 shrink-0">
      <button onClick={() => onChange('list')} className={btn(view === 'list')} title="Liste">
        <List className="w-4 h-4" />
      </button>
      <button onClick={() => onChange('grid')} className={btn(view === 'grid')} title="Raster">
        <LayoutGrid className="w-4 h-4" />
      </button>
    </div>
  )
}

// One number in the summary strip at the top of a page. The coloured tile behind
// the icon is what makes a row of these readable at a glance.
export function StatCard({ label, value, hint, tone = 'neutral', icon: Icon, onClick }) {
  const t = TONES[tone] ?? TONES.neutral
  // clickable tiles open the rows behind the number - see StatDetailDialog
  const Tag = onClick ? 'button' : 'div'

  return (
    <Tag
      onClick={onClick}
      className={`bg-white rounded-xl shadow-sm p-4 flex items-center gap-3 w-full text-left ${
        onClick ? 'hover:shadow-md hover:ring-1 hover:ring-primary/30 transition cursor-pointer' : ''
      }`}
    >
      {Icon && (
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${t.tile}`}>
          <Icon className="w-5 h-5" />
        </div>
      )}
      <div className="min-w-0">
        {/* wraps instead of truncating - "Offene Schulden" must stay readable on a phone */}
        <div className="text-xs text-gray-500 leading-tight">{label}</div>
        <div className={`text-lg font-bold ${tone === 'neutral' ? 'text-gray-900' : t.text}`}>{value}</div>
        {hint && <div className="text-[11px] text-gray-400 leading-tight">{hint}</div>}
      </div>
    </Tag>
  )
}

// Consistent "nothing here yet" block. An empty screen should never be a dead end,
// so it can carry the action that fills it.
export function EmptyState({ icon: Icon, children, hint, action, cta }) {
  return (
    <div className="bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center">
      {Icon && <Icon className="w-10 h-10 mx-auto mb-2 text-gray-300" />}
      <div className="text-sm text-gray-500">{children}</div>
      {hint && <div className="text-xs text-gray-400 mt-1">{hint}</div>}
      {action && cta && (
        <button onClick={action} className="mt-4 bg-primary text-white rounded-lg px-4 py-2 text-sm font-semibold">
          {cta}
        </button>
      )}
    </div>
  )
}

// small status pill (active/inactive, sale status, role, ...)
export function Badge({ tone = 'neutral', children }) {
  const t = TONES[tone] ?? TONES.neutral
  return <span className={`text-[11px] font-medium rounded-full px-2 py-0.5 whitespace-nowrap ${t.pill}`}>{children}</span>
}

// Initials avatar. The reference dashboards lean on avatars to make rows of data
// scannable; we have no photos, so colour the initials deterministically instead.
const AVATAR_TONES = ['primary', 'success', 'info', 'accent', 'warning']

export function Avatar({ name = '', size = 'md' }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  // same name always gets the same colour, so people stay recognisable in a list
  const sum = [...name].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  const t = TONES[AVATAR_TONES[sum % AVATAR_TONES.length]]
  const box = size === 'sm' ? 'w-8 h-8 text-[11px]' : 'w-10 h-10 text-xs'

  return (
    <span className={`${box} ${t.tile} rounded-full flex items-center justify-center font-bold shrink-0`}>
      {initials || '?'}
    </span>
  )
}

// page section heading with an optional action on the right
export function SectionHeader({ title, hint, children }) {
  return (
    <div className="flex items-end justify-between gap-3 mb-2">
      <div>
        <h2 className="font-bold text-lg leading-tight">{title}</h2>
        {hint && <p className="text-xs text-gray-500">{hint}</p>}
      </div>
      {children}
    </div>
  )
}
