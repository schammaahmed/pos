import { LayoutGrid, List } from 'lucide-react'

// Small shared building blocks so every page looks like the same app instead of
// each screen inventing its own spacing and colours.

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

// one number in the summary strip at the top of a page
export function StatCard({ label, value, tone = 'default', icon: Icon }) {
  const valueTone =
    tone === 'debt' ? 'text-accent' : tone === 'good' ? 'text-primary' : 'text-gray-900'

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3">
      {Icon && (
        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-gray-400" />
        </div>
      )}
      <div className="min-w-0">
        {/* wraps instead of truncating - "Offene Schulden" must stay readable on a phone */}
        <div className="text-xs text-gray-500 leading-tight">{label}</div>
        <div className={`text-lg font-bold ${valueTone}`}>{value}</div>
      </div>
    </div>
  )
}

// consistent "nothing here yet" block instead of a bare grey sentence
export function EmptyState({ icon: Icon, children }) {
  return (
    <div className="bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-400 text-sm">
      {Icon && <Icon className="w-10 h-10 mx-auto mb-2 text-gray-300" />}
      {children}
    </div>
  )
}

// small status pill (active/inactive, sale status, ...)
export function Badge({ tone = 'gray', children }) {
  const tones = {
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-700',
    gray: 'bg-gray-100 text-gray-600',
    accent: 'bg-accent/10 text-accent',
  }
  return <span className={`text-[11px] font-medium rounded-full px-2 py-0.5 ${tones[tone]}`}>{children}</span>
}
