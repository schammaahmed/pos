import { Tent } from 'lucide-react'
import { useCamp } from '../campContext'

// The super admin's active-camp picker, living in the top bar. Whatever camp is chosen
// here scopes every camp-page (Teilnehmer, Produkte, Kasse, Verkäufe) at once - so the
// answer to "which camp's till is this?" is always on screen. Camp users never see it:
// they are pinned to their own camp server-side.
export default function CampSwitcher() {
  const { camps, activeCampId, setActiveCamp } = useCamp()

  if (camps.length === 0) return null

  return (
    <label className="flex items-center gap-1.5 max-w-full">
      <Tent className="w-4 h-4 text-primary shrink-0" />
      <span className="sr-only">Aktives Camp</span>
      <select
        value={activeCampId ?? ''}
        onChange={(e) => setActiveCamp(Number(e.target.value))}
        className="max-w-[9rem] sm:max-w-[16rem] truncate border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-medium bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary/30"
        title="Aktives Camp wechseln"
      >
        {camps.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}{c.status !== 'ACTIVE' ? ' (abgeschlossen)' : ''}
          </option>
        ))}
      </select>
    </label>
  )
}
