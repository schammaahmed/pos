import { useEffect, useRef, useState } from 'react'
import { ChevronDown, KeyRound, LogOut } from 'lucide-react'
import { useAuth, roleLabel } from '../auth'

// Account/settings menu in the top bar. Replaces the lone key icon: everything
// personal (who am I, password, sign out) lives behind one predictable button.
export default function AccountMenu({ onChangePassword }) {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  // close on outside click or Escape - expected behaviour for a dropdown
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const initials = `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Konto & Einstellungen"
        className="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-gray-100"
      >
        <span className="w-8 h-8 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shrink-0">
          {initials}
        </span>
        {/* the greeting lives here so it doesn't repeat the name twice in the bar */}
        <span className="hidden sm:block text-left leading-tight">
          <span className="block text-sm text-gray-900">
            Hallo, <span className="font-semibold">{user.firstName}</span>
          </span>
          <span className="block text-[11px] text-gray-500">{roleLabel(user.role)}</span>
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50">
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="font-semibold truncate">
              {user.firstName} {user.lastName}
            </div>
            <div className="text-xs text-gray-500">
              {roleLabel(user.role)}
              {user.campName ? ` · ${user.campName}` : ''}
            </div>
          </div>

          <button
            onClick={() => {
              setOpen(false)
              onChangePassword()
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50"
          >
            <KeyRound className="w-4 h-4 text-gray-400" /> Passwort ändern
          </button>

          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-accent hover:bg-accent/5"
          >
            <LogOut className="w-4 h-4" /> Abmelden
          </button>
        </div>
      )}
    </div>
  )
}
