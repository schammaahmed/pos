import { NavLink, Outlet, Navigate } from 'react-router-dom'
import { useAuth, isLead } from '../auth'

// The frame around every page after login: content on top, tab bar at the bottom.
// Bottom navigation because sellers hold phones - thumbs live at the bottom of the screen.
export default function Layout() {
  const { user, logout } = useAuth()

  // not logged in? -> everything inside this layout is off limits
  if (!user) return <Navigate to="/login" replace />

  const tabClass = ({ isActive }) =>
    `flex-1 py-3 text-center text-xs font-medium ${isActive ? 'text-blue-600' : 'text-gray-500'}`

  return (
    <div className="min-h-screen bg-gray-100 pb-16">
      {/* top bar: who am I, which camp, logout */}
      <header className="bg-white shadow-sm px-4 py-2 flex items-center justify-between sticky top-0 z-10">
        <div>
          <span className="font-bold">Camp Kiosk</span>
          {user.campName && <span className="text-sm text-gray-500 ml-2">{user.campName}</span>}
        </div>
        <button onClick={logout} className="text-sm text-gray-500">
          {user.firstName} · Abmelden
        </button>
      </header>

      <main className="p-4 max-w-3xl mx-auto">
        <Outlet /> {/* the current page renders here */}
      </main>

      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 flex z-10">
        {user.role !== 'SUPER_ADMIN' && (
          <NavLink to="/sell" className={tabClass}>🛒<div>Verkaufen</div></NavLink>
        )}
        <NavLink to="/participants" className={tabClass}>👥<div>Teilnehmer</div></NavLink>
        <NavLink to="/products" className={tabClass}>🏪<div>Produkte</div></NavLink>
        {isLead(user) && user.role !== 'SUPER_ADMIN' && (
          <NavLink to="/review" className={tabClass}>🔍<div>Prüfen</div></NavLink>
        )}
        {['SUPER_ADMIN', 'CAMP_ADMIN'].includes(user.role) && (
          <NavLink to="/admin" className={tabClass}>⚙️<div>Admin</div></NavLink>
        )}
      </nav>
    </div>
  )
}
