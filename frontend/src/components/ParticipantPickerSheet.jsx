import { useEffect, useMemo, useRef, useState } from 'react'
import { LayoutGrid, List, Search, X } from 'lucide-react'
import { api } from '../api'
import { fmt } from '../money'

// ---- "recently sold to" memory (per device, survives reloads) -------------
const RECENT_KEY = 'pos_recent_participants'

export function rememberRecentParticipant(id) {
  const current = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
  const next = [id, ...current.filter((x) => x !== id)].slice(0, 6) // newest first, max 6
  localStorage.setItem(RECENT_KEY, JSON.stringify(next))
}

function loadRecentIds() {
  return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
}

// ---- the picker -----------------------------------------------------------
// Full-screen sheet to pick 1 of 60+ participants FAST:
// search, M/W filter, "Zuletzt" row, and two views: A-Z list (with letter rail) or name grid.
export default function ParticipantPickerSheet({ onSelect, onClose }) {
  const [participants, setParticipants] = useState([])
  const [search, setSearch] = useState('')
  const [genderFilter, setGenderFilter] = useState(null) // null | 'M' | 'W'
  const [view, setView] = useState('list') // 'list' | 'grid'
  const [error, setError] = useState(null)
  const scrollRef = useRef(null) // the scrolling container, for the letter rail

  // load ALL once - 60-100 rows is nothing, filtering then happens instantly on the device
  useEffect(() => {
    api('/api/participants').then(setParticipants).catch((e) => setError(e.message))
  }, [])

  const hasGenders = participants.some((p) => p.gender)

  const filtered = useMemo(() => {
    let list = participants
    if (genderFilter) list = list.filter((p) => p.gender === genderFilter)
    const q = search.trim().toLowerCase()
    if (q) list = list.filter((p) => `${p.firstName} ${p.lastName}`.toLowerCase().includes(q))
    return list
  }, [participants, genderFilter, search])

  // group by first letter of the LAST name (the list is sorted by last name already)
  const groups = useMemo(() => {
    const map = new Map()
    for (const p of filtered) {
      const letter = (p.lastName[0] || '#').toUpperCase()
      if (!map.has(letter)) map.set(letter, [])
      map.get(letter).push(p)
    }
    return [...map.entries()] // [['A', [...]], ['B', [...]]]
  }, [filtered])

  const recents = loadRecentIds()
    .map((id) => participants.find((p) => p.id === id))
    .filter(Boolean)

  function jumpTo(letter) {
    // scroll the letter's section to the top of the sheet
    document.getElementById(`picker-letter-${letter}`)?.scrollIntoView({ block: 'start' })
  }

  const pick = (p) => onSelect(p)

  const tabClass = (isActive) =>
    `rounded-full px-4 py-2 text-sm border ${
      isActive ? 'bg-primary text-white border-primary' : 'bg-white border-gray-300'
    }`

  return (
    <div className="fixed inset-0 bg-page z-40 flex flex-col">
      {/* header: search + filters, stays while the list scrolls */}
      <div className="bg-white shadow-sm p-3 space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Suchen…"
              className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-3"
            />
          </div>
          <button onClick={onClose} title="Schließen"
                  className="border rounded-lg px-3 text-gray-500 hover:bg-gray-50 flex items-center">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex gap-2 items-center">
          {hasGenders && (
            <>
              <button onClick={() => setGenderFilter(null)} className={tabClass(genderFilter === null)}>Alle</button>
              <button onClick={() => setGenderFilter('M')} className={tabClass(genderFilter === 'M')}>M</button>
              <button onClick={() => setGenderFilter('W')} className={tabClass(genderFilter === 'W')}>W</button>
            </>
          )}
          <div className="flex-1" />
          {/* view toggle: list with A-Z rail vs. big-button grid */}
          <button onClick={() => setView(view === 'list' ? 'grid' : 'list')}
                  className="border rounded-lg px-3 py-2 text-sm bg-white hover:bg-gray-50 flex items-center gap-1.5">
            {view === 'list' ? <><LayoutGrid className="w-4 h-4" /> Raster</> : <><List className="w-4 h-4" /> Liste</>}
          </button>
        </div>
      </div>

      {error && <div className="m-3 bg-red-50 text-red-700 text-sm rounded-lg p-3">{error}</div>}

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 pb-8">
        {/* recently sold to - the same kids come back all day */}
        {recents.length > 0 && !search && (
          <div className="mb-3">
            <div className="text-xs font-semibold text-gray-500 mb-1">ZULETZT</div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {recents.map((p) => (
                <button key={p.id} onClick={() => pick(p)}
                        className="whitespace-nowrap bg-white rounded-full border border-gray-300 px-4 py-2 text-sm">
                  {p.firstName} {p.lastName[0]}.
                </button>
              ))}
            </div>
          </div>
        )}

        {view === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {filtered.map((p) => (
              <button key={p.id} onClick={() => pick(p)}
                      className="bg-white rounded-xl shadow-sm p-3 text-left active:scale-95 transition-transform">
                <div className="font-medium leading-tight">{p.firstName} {p.lastName}</div>
                <div className={`text-sm ${p.inDebt ? 'text-accent' : 'text-primary'}`}>{fmt(p.balance)}</div>
              </button>
            ))}
          </div>
        ) : (
          <div className="pr-6">{/* leave room for the letter rail */}
            {groups.map(([letter, people]) => (
              <div key={letter} id={`picker-letter-${letter}`}>
                <div className="text-xs font-bold text-gray-400 mt-3 mb-1">{letter}</div>
                <div className="bg-white rounded-xl shadow-sm divide-y">
                  {people.map((p) => (
                    <button key={p.id} onClick={() => pick(p)}
                            className="w-full flex justify-between items-center p-3 active:bg-gray-100">
                      <span>{p.firstName} <span className="font-medium">{p.lastName}</span></span>
                      <span className={p.inDebt ? 'text-accent' : 'text-primary'}>{fmt(p.balance)}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {filtered.length === 0 && <div className="text-gray-400 text-sm p-4">Niemand gefunden.</div>}
      </div>

      {/* A-Z rail, like in the phone contacts app - only in list view */}
      {view === 'list' && groups.length > 3 && (
        <div className="absolute right-1 top-28 bottom-4 flex flex-col justify-center gap-0.5">
          {groups.map(([letter]) => (
            <button key={letter} onClick={() => jumpTo(letter)}
                    className="text-[11px] font-semibold text-primary w-5 h-5 leading-5 text-center">
              {letter}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
