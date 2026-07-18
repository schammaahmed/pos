import { useEffect, useState } from 'react'
import { Lightbulb } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../auth'
import { ConfirmDialog } from '../components/Dialog'

// Admin area. CAMP_ADMIN: manage their camp's team. SUPER_ADMIN: additionally manage camps.
export default function Admin() {
  const { user } = useAuth()
  const isSuper = user.role === 'SUPER_ADMIN'
  const [camps, setCamps] = useState([])
  const [users, setUsers] = useState([])
  const [error, setError] = useState(null)
  const [showCampForm, setShowCampForm] = useState(false)
  const [showUserForm, setShowUserForm] = useState(false)
  const [campToClose, setCampToClose] = useState(null) // camp awaiting the close confirmation

  async function reload() {
    try {
      setCamps(await api('/api/camps'))
      setUsers(await api('/api/users'))
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => {
    reload()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleUser(u) {
    try {
      await api(`/api/users/${u.id}/${u.active ? 'deactivate' : 'activate'}`, { method: 'POST' })
      reload()
    } catch (e) {
      setError(e.message)
    }
  }

  async function closeCamp(camp) {
    try {
      await api(`/api/camps/${camp.id}/close`, { method: 'POST' })
      reload()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="space-y-6">
      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3">{error}</div>}

      {/* camps - super admin manages, camp admin just sees their own */}
      <section className="space-y-2">
        <div className="flex justify-between items-center">
          <h2 className="font-bold text-lg">Camps</h2>
          {isSuper && (
            <button onClick={() => setShowCampForm(true)} className="bg-primary text-white rounded-lg px-4 py-2 text-sm font-semibold">
              + Camp
            </button>
          )}
        </div>
        <div className="bg-white rounded-xl shadow-sm divide-y">
          {camps.map((c) => (
            <div key={c.id} className="p-3 flex justify-between items-center">
              <div>
                <div className="font-medium">{c.name}</div>
                <div className="text-sm text-gray-500">
                  {c.city} · {c.startDate} bis {c.endDate} · {c.status === 'ACTIVE' ? 'aktiv' : 'abgeschlossen'}
                </div>
              </div>
              {isSuper && c.status === 'ACTIVE' && (
                <button onClick={() => setCampToClose(c)} className="text-sm border rounded-lg px-3 py-2 text-accent hover:bg-accent/5">
                  Abschließen
                </button>
              )}
            </div>
          ))}
          {camps.length === 0 && <div className="p-4 text-gray-400 text-sm">Noch keine Camps.</div>}
        </div>
      </section>

      {/* team */}
      <section className="space-y-2">
        <div className="flex justify-between items-center">
          <h2 className="font-bold text-lg">Team</h2>
          <button onClick={() => setShowUserForm(true)} className="bg-primary text-white rounded-lg px-4 py-2 text-sm font-semibold">
            + Benutzer
          </button>
        </div>
        <div className="bg-white rounded-xl shadow-sm divide-y">
          {users.map((u) => (
            <div key={u.id} className={`p-3 flex justify-between items-center ${u.active ? '' : 'opacity-50'}`}>
              <div>
                <div className="font-medium">
                  {u.firstName} {u.lastName}
                </div>
                <div className="text-sm text-gray-500">
                  {roleLabel(u.role)}
                  {u.campName ? ` · ${u.campName}` : ''}
                  {!u.active && ' · deaktiviert'}
                </div>
              </div>
              {u.id !== user.id && (
                <button onClick={() => toggleUser(u)} className="text-sm border rounded-lg px-3 py-2">
                  {u.active ? 'Deaktivieren' : 'Aktivieren'}
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {campToClose && (
        <ConfirmDialog
          title="Camp abschließen"
          message={`„${campToClose.name}" wirklich abschließen? Danach kann in diesem Camp nicht mehr verkauft werden.`}
          confirmLabel="Abschließen"
          tone="danger"
          onConfirm={() => closeCamp(campToClose)}
          onClose={() => setCampToClose(null)}
        />
      )}

      {showCampForm && <CampForm onClose={() => setShowCampForm(false)} onSaved={reload} />}
      {showUserForm && (
        <UserForm camps={camps} isSuper={isSuper} onClose={() => setShowUserForm(false)} onSaved={reload} />
      )}
    </div>
  )
}

function roleLabel(role) {
  return {
    SUPER_ADMIN: 'Super-Admin',
    CAMP_ADMIN: 'Camp-Admin',
    SELLER_LEAD: 'Stand-Leitung',
    SELLER: 'Verkäufer:in',
  }[role] ?? role
}

function CampForm({ onClose, onSaved }) {
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [error, setError] = useState(null)

  async function submit(event) {
    event.preventDefault()
    try {
      await api('/api/camps', { method: 'POST', body: { name, city, startDate, endDate } })
      onSaved()
      onClose()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-30 flex items-end sm:items-center justify-center" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="bg-white rounded-t-2xl sm:rounded-2xl p-4 w-full max-w-md space-y-3">
        <h2 className="font-bold text-lg">Camp anlegen</h2>
        {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-2">{error}</div>}
        <input required placeholder="Name (z.B. Sommerlager Wien 2026)" value={name} onChange={(e) => setName(e.target.value)} className="w-full border rounded-lg px-3 py-3" />
        <input required placeholder="Stadt" value={city} onChange={(e) => setCity(e.target.value)} className="w-full border rounded-lg px-3 py-3" />
        <label className="block text-sm text-gray-600">
          Von
          <input required type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full border rounded-lg px-3 py-3 mt-1" />
        </label>
        <label className="block text-sm text-gray-600">
          Bis
          <input required type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full border rounded-lg px-3 py-3 mt-1" />
        </label>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 border rounded-lg py-3">Abbrechen</button>
          <button type="submit" className="flex-1 bg-primary text-white rounded-lg py-3 font-semibold">Anlegen</button>
        </div>
      </form>
    </div>
  )
}

function UserForm({ camps, isSuper, onClose, onSaved }) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('SELLER')
  const [campId, setCampId] = useState('')
  const [error, setError] = useState(null)

  // camp admins may only create sellers/leads - the backend enforces this too
  const roles = isSuper
    ? ['SELLER', 'SELLER_LEAD', 'CAMP_ADMIN', 'SUPER_ADMIN']
    : ['SELLER', 'SELLER_LEAD']

  async function submit(event) {
    event.preventDefault()
    try {
      await api('/api/users', {
        method: 'POST',
        body: {
          firstName,
          lastName,
          email,
          password,
          role,
          // super admin picks the camp; camp admin's own camp is used automatically
          campId: role === 'SUPER_ADMIN' ? null : campId ? Number(campId) : (camps[0]?.id ?? null),
        },
      })
      onSaved()
      onClose()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-30 flex items-end sm:items-center justify-center" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="bg-white rounded-t-2xl sm:rounded-2xl p-4 w-full max-w-md space-y-3">
        <h2 className="font-bold text-lg">Benutzer anlegen</h2>
        {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-2">{error}</div>}
        <input required placeholder="Vorname" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full border rounded-lg px-3 py-3" />
        <input required placeholder="Nachname" value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full border rounded-lg px-3 py-3" />
        <input required type="email" placeholder="E-Mail" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border rounded-lg px-3 py-3" />
        <input required type="password" placeholder="Temporäres Passwort (min. 8 Zeichen)" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border rounded-lg px-3 py-3" />
        {/* the reminder the user asked for: this password is only temporary */}
        <div className="bg-primary/10 text-primary-dark text-xs rounded-lg p-2 flex gap-2">
          <Lightbulb className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Teile dieses temporäre Passwort persönlich mit. Beim ersten Login muss die Person
            ein eigenes Passwort setzen.
          </span>
        </div>
        <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full border rounded-lg px-3 py-3 bg-white">
          {roles.map((r) => (
            <option key={r} value={r}>{roleLabel(r)}</option>
          ))}
        </select>
        {isSuper && role !== 'SUPER_ADMIN' && (
          <select required value={campId} onChange={(e) => setCampId(e.target.value)} className="w-full border rounded-lg px-3 py-3 bg-white">
            <option value="">Camp wählen…</option>
            {camps.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 border rounded-lg py-3">Abbrechen</button>
          <button type="submit" className="flex-1 bg-primary text-white rounded-lg py-3 font-semibold">Anlegen</button>
        </div>
      </form>
    </div>
  )
}
