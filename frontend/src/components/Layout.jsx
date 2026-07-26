import { useEffect, useState } from 'react'
import { NavLink, Outlet, Navigate } from 'react-router-dom'
import { ClipboardCheck, LayoutDashboard, LogOut, Menu, Package, PackageOpen, QrCode, Receipt, ShieldUser, ShoppingCart, Users } from 'lucide-react'
import { useAuth, isLead } from '../auth'
import { useCamp } from '../campContext'
import CampSwitcher from './CampSwitcher'
import AccountMenu from './AccountMenu'
import ChangePassword from './ChangePassword'
import OnboardingTour, { hasSeenTour } from './OnboardingTour'

const SIDEBAR_KEY = 'pos_sidebar_collapsed'

// The frame around every page. Structure follows the previous POS version:
// a full-width top bar (logo left, date/time centre, greeting right) plus a left
// icon rail on desktop. On phones the rail becomes a bottom tab bar, because
// sellers hold the device one-handed and thumbs reach the bottom.
export default function Layout() {
  const { user, logout } = useAuth()
  const { activeCampId } = useCamp()
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [showTour, setShowTour] = useState(false)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === '1')
  const [now, setNow] = useState(() => new Date())

  // First login: show the guide once the user is past the forced password change,
  // so they aren't hit with two overlays at the same time.
  useEffect(() => {
    if (user && !user.mustChangePassword && !hasSeenTour(user)) setShowTour(true)
  }, [user?.id, user?.mustChangePassword]) // eslint-disable-line react-hooks/exhaustive-deps

  // keep the clock in the top bar roughly current without re-rendering constantly
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [])

  // Compute the next value first, THEN update state and storage. Never put a side effect
  // inside a setState updater: React invokes updaters twice in StrictMode to check they are
  // pure, which would toggle this twice and appear to do nothing.
  function toggleSidebar() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0') // remember the choice per device
  }

  // not logged in? -> everything inside this layout is off limits
  if (!user) return <Navigate to="/login" replace />

  // temporary admin password still active? -> nothing works until it's changed
  if (user.mustChangePassword) {
    return (
      <div className="min-h-screen bg-page">
        <header className="bg-white border-b border-gray-200 px-4 h-14 flex items-center justify-between">
          <span className="font-bold">Verkaufsstand</span>
          <button onClick={logout} className="text-sm text-gray-500 flex items-center gap-1">
            <LogOut className="w-4 h-4" /> Abmelden
          </button>
        </header>
        <ChangePassword forced />
      </div>
    )
  }

  // one source of truth for both the desktop rail and the mobile tab bar. A super admin
  // gets everything, scoped to the camp picked in the top-bar switcher: they oversee it
  // all, so they can also step in and sell or review any camp.
  const navItems = [
    // a super admin oversees every camp, so their home is the cross-camp overview
    ...(user.role === 'SUPER_ADMIN' ? [{ to: '/overview', label: 'Übersicht', Icon: LayoutDashboard }] : []),
    { to: '/sell', label: 'Verkaufen', Icon: ShoppingCart },
    { to: '/participants', label: 'Teilnehmer', Icon: Users },
    { to: '/products', label: 'Produkte', Icon: Package },
    // Aktionen (Vorbestellungen + Ausgabe). At the till just like Verkaufen, so any staff can use it.
    { to: '/aktionen', label: 'Aktionen', Icon: PackageOpen },
    // Self-serve pre-orders coming in from the QR code - staff picks them up.
    { to: '/preorders', label: 'Vorbestellungen', Icon: QrCode },
    // sellers see the log too: they may not undo anything, but they can flag a sale
    // they are unsure about so the lead checks it
    { to: '/sales', label: 'Verkäufe', Icon: Receipt },
    ...(isLead(user) ? [{ to: '/review', label: 'Prüfen', Icon: ClipboardCheck }] : []),
    // ShieldUser, not a gear: this is the admin area, not app settings
    ...(['SUPER_ADMIN', 'CAMP_LEAD'].includes(user.role) ? [{ to: '/admin', label: 'Admin', Icon: ShieldUser }] : []),
  ]

  const dateLine =
    now.toLocaleDateString('de-AT', { weekday: 'long', day: 'numeric', month: 'long' }) +
    ' um ' +
    now.toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="min-h-screen bg-page">
      {/* ---------------------------------------------------------------- top bar */}
      <header className="fixed top-0 inset-x-0 h-14 bg-white border-b border-gray-200 z-30 flex items-center px-3 md:px-4">
        {/* left: collapse toggle + wordmark */}
        <div className="flex items-center gap-2 shrink-0 md:w-56">
          <button
            onClick={toggleSidebar}
            className="hidden md:flex items-center justify-center w-9 h-9 rounded-lg text-gray-500 hover:bg-gray-100"
            title={collapsed ? 'Menü ausklappen' : 'Menü einklappen'}
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-bold text-primary">Verkaufsstand</span>
        </div>

        {/* centre: for a super admin, the active-camp switcher (which camp everything is
            scoped to - visible on phones too, since "welche Kassa?" matters most there);
            otherwise the date and time, like v1 */}
        <div className="flex-1 flex justify-center min-w-0 px-2">
          {user.role === 'SUPER_ADMIN'
            ? <CampSwitcher />
            : <span className="hidden md:block text-sm text-gray-500 truncate">{dateLine}</span>}
        </div>

        {/* right: one account menu holding greeting, password and sign out */}
        <div className="ml-auto md:ml-0 flex items-center shrink-0 md:w-56 md:justify-end">
          <AccountMenu
            onChangePassword={() => setShowPasswordForm(true)}
            onShowGuide={() => setShowTour(true)}
          />
        </div>
      </header>

      {/* ---------------------------------------------------------------- sidebar (desktop) */}
      <aside
        className={`hidden md:flex flex-col fixed top-14 bottom-0 left-0 bg-white border-r border-gray-200 z-20 py-3 transition-[width] ${
          collapsed ? 'w-16' : 'w-56'
        }`}
      >
        {navItems.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 mx-2 mb-1 px-3 py-2.5 rounded-lg text-sm font-medium ${
                isActive ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100'
              } ${collapsed ? 'justify-center' : ''}`
            }
          >
            <Icon className="w-5 h-5 shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}

        {/* camp name sits at the bottom of the rail so it's always visible but never in the way */}
        {user.campName && !collapsed && (
          <div className="mt-auto px-5 text-xs text-gray-400 leading-snug">{user.campName}</div>
        )}
      </aside>

      {/* ---------------------------------------------------------------- content */}
      <main className={`pt-14 pb-24 md:pb-8 ${collapsed ? 'md:pl-16' : 'md:pl-56'}`}>
        {/* keyed on the active camp: switching camps in the top bar remounts the page so
            every camp-scoped list refetches for the newly chosen camp, no per-page wiring */}
        <div key={activeCampId} className="max-w-6xl mx-auto p-4">
          <Outlet /> {/* the current page renders here */}
        </div>
      </main>

      {showPasswordForm && <ChangePassword onClose={() => setShowPasswordForm(false)} />}
      {showTour && <OnboardingTour user={user} onClose={() => setShowTour(false)} />}

      {/* ---------------------------------------------------------------- bottom tabs (mobile) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 flex z-30">
        {navItems.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${
                isActive ? 'text-primary' : 'text-gray-500'
              }`
            }
          >
            <Icon className="w-5 h-5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
