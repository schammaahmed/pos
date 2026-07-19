import { useEffect, useMemo, useState } from 'react'
import {
  Banknote, Crown, Euro, Lightbulb, Package, Receipt, TrendingDown, Trophy, UserRound, Users,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth, roleLabel } from '../auth'
import { ConfirmDialog } from '../components/Dialog'
import SetupChecklist from '../components/SetupChecklist'
import StatDetailDialog from '../components/StatDetailDialog'
import InviteCard from '../components/InviteCard'
import { Avatar, Badge, EmptyState, SectionHeader, StatCard } from '../components/ui'
import { fmt } from '../money'

// Admin area. CAMP_ADMIN: manage their camp's team. SUPER_ADMIN: additionally manage camps.
// Everything on the dashboard is derived from the existing endpoints - no extra API needed.
export default function Admin() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isSuper = user.role === 'SUPER_ADMIN'
  const [camps, setCamps] = useState([])
  const [users, setUsers] = useState([])
  const [sales, setSales] = useState([])
  const [participants, setParticipants] = useState([])
  const [products, setProducts] = useState([]) // only for the setup checklist
  const [error, setError] = useState(null)
  const [showCampForm, setShowCampForm] = useState(false)
  const [showUserForm, setShowUserForm] = useState(false)
  const [campToClose, setCampToClose] = useState(null) // camp awaiting the close confirmation
  const [detail, setDetail] = useState(null) // which stat tile is drilled into
  const [invite, setInvite] = useState(null) // credentials sheet for a freshly created user
  // which camp the figures refer to. A camp admin only ever has their own; a super
  // admin has none of their own, so they pick one (defaults to the first active camp).
  const [statsCampId, setStatsCampId] = useState(user.campId ?? null)

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

  // super admin: once camps are loaded, default the dashboard to an active camp
  useEffect(() => {
    if (statsCampId || camps.length === 0) return
    setStatsCampId((camps.find((c) => c.status === 'ACTIVE') ?? camps[0]).id)
  }, [camps, statsCampId])

  // load the figures for the selected camp
  useEffect(() => {
    if (!statsCampId) return
    const q = `?campId=${statsCampId}`
    api(`/api/sales${q}`).then(setSales).catch(() => setSales([]))
    api(`/api/participants${q}`).then(setParticipants).catch(() => setParticipants([]))
    api(`/api/products${q}&activeOnly=false`).then(setProducts).catch(() => setProducts([]))
  }, [statsCampId])

  // ---- everything below is computed from the loaded lists -------------------
  const stats = useMemo(() => {
    const booked = sales.filter((s) => s.status === 'COMPLETED')
    const today = new Date().toDateString()
    const revenue = (list) => list.reduce((sum, s) => sum + Number(s.totalAmount), 0)
    const bookedToday = booked.filter((s) => new Date(s.createdAt).toDateString() === today)

    // how many of each product went over the counter
    const perProduct = new Map()
    for (const sale of booked) {
      for (const item of sale.items) {
        perProduct.set(item.productName, (perProduct.get(item.productName) ?? 0) + item.quantity)
      }
    }
    const topProducts = [...perProduct.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)

    // who spent the most (named participants only - anonymous cash sales have no name)
    const perBuyer = new Map()
    for (const sale of booked) {
      if (!sale.participantName) continue
      perBuyer.set(sale.participantName, (perBuyer.get(sale.participantName) ?? 0) + Number(sale.totalAmount))
    }
    const topBuyers = [...perBuyer.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)

    const debtors = participants.filter((p) => p.inDebt)

    return {
      revenueToday: revenue(bookedToday),
      revenueTotal: revenue(booked),
      salesToday: bookedToday.length,
      salesTotal: booked.length,
      reversed: sales.filter((s) => s.status === 'REVERSED').length,
      flagged: sales.filter((s) => s.flaggedForReview).length,
      participants: participants.length,
      openDebt: Math.abs(debtors.reduce((sum, p) => sum + Number(p.balance), 0)),
      debtors: debtors.length,
      activeTeam: users.filter((u) => u.active).length,
      topProducts,
      topBuyers,
      recent: booked.slice(0, 6), // API already returns newest first
    }
  }, [sales, participants, users])

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

  const statsCamp = camps.find((c) => c.id === statsCampId)

  // Rows behind each tile, so any figure can be verified against its parts.
  function detailContent() {
    const saleRow = (s) => ({
      key: s.id,
      label: s.participantName ?? 'Barverkauf',
      hint: `${s.items.map((i) => `${i.quantity}× ${i.productName}`).join(', ')} · ${new Date(s.createdAt).toLocaleString('de-AT')} · ${s.sellerName}`,
      value: fmt(s.totalAmount),
    })
    const booked = sales.filter((s) => s.status === 'COMPLETED')
    const today = new Date().toDateString()

    switch (detail) {
      case 'revenueToday': {
        const rows = booked.filter((s) => new Date(s.createdAt).toDateString() === today)
        return {
          title: 'Umsatz heute', subtitle: 'Alle gebuchten Verkäufe von heute',
          rows: rows.map(saleRow), total: { label: 'Summe', value: fmt(stats.revenueToday) },
          emptyText: 'Heute noch nichts verkauft.',
        }
      }
      case 'revenueTotal':
        return {
          title: 'Umsatz gesamt', subtitle: 'Alle gebuchten Verkäufe dieses Camps',
          rows: booked.map(saleRow), total: { label: 'Summe', value: fmt(stats.revenueTotal) },
        }
      case 'participants':
        return {
          title: 'Teilnehmer', subtitle: `${participants.length} im Camp`,
          rows: participants.map((p) => ({
            key: p.id,
            label: `${p.firstName} ${p.lastName}`,
            hint: p.inDebt ? 'offene Schulden' : 'Guthaben',
            value: fmt(Math.abs(Number(p.balance))),
          })),
        }
      case 'debt': {
        const debtors = participants.filter((p) => p.inDebt)
        return {
          title: 'Offene Schulden', subtitle: 'Wer noch zahlen muss',
          rows: debtors.map((p) => ({
            key: p.id, label: `${p.firstName} ${p.lastName}`, value: fmt(Math.abs(Number(p.balance))),
          })),
          total: { label: 'Gesamt offen', value: fmt(stats.openDebt) },
          emptyText: 'Niemand ist im Minus.',
        }
      }
      case 'team':
        return {
          title: 'Team', subtitle: `${stats.activeTeam} von ${users.length} aktiv`,
          rows: users.map((u) => ({
            key: u.id,
            label: `${u.firstName} ${u.lastName}`,
            hint: roleLabel(u.role),
            value: u.active ? 'aktiv' : 'deaktiviert',
          })),
        }
      case 'reversed': {
        const rows = sales.filter((s) => s.status === 'REVERSED')
        return {
          title: 'Stornierte Verkäufe',
          subtitle: stats.flagged ? `${stats.flagged} davon noch zu prüfen` : 'nichts offen zu prüfen',
          rows: rows.map((s) => ({ ...saleRow(s), hint: `${saleRow(s).hint}${s.flaggedForReview ? ' · zu prüfen' : ''}` })),
          emptyText: 'Nichts storniert.',
        }
      }
      default:
        return { title: '', rows: [] }
    }
  }

  // The four things a camp needs before the stand can sell. Sellers/leads are the
  // people who actually staff it, so an admin on their own doesn't count as "team".
  const setupSteps = [
    {
      label: 'Camp anlegen',
      hint: 'Name, Stadt und Zeitraum des Lagers',
      cta: 'Camp anlegen',
      done: camps.length > 0,
      action: () => setShowCampForm(true),
    },
    {
      label: 'Team einladen',
      hint: 'Verkäufer:innen und Stand-Leitung anlegen',
      cta: 'Benutzer anlegen',
      done: users.some((u) => ['SELLER', 'SELLER_LEAD'].includes(u.role)),
      action: () => setShowUserForm(true),
    },
    {
      label: 'Produkte anlegen',
      hint: 'Was verkauft wird, mit Preis und Kategorie',
      cta: 'Zu den Produkten',
      done: products.length > 0,
      action: () => navigate('/products'),
    },
    {
      label: 'Teilnehmer anlegen',
      hint: 'Wer im Lager einkaufen kann',
      cta: 'Zu den Teilnehmern',
      done: participants.length > 0,
      action: () => navigate('/participants'),
    },
  ]

  return (
    <div className="space-y-6">
      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3">{error}</div>}

      <SetupChecklist steps={setupSteps} />

      {/* ---------------------------------------------------------- overview */}
      <section>
        <SectionHeader title="Überblick" hint={statsCamp ? statsCamp.name : 'Kein Camp ausgewählt'}>
          {/* a super admin belongs to no camp, so they choose which one the figures show */}
          {isSuper && camps.length > 0 && (
            <select
              value={statsCampId ?? ''}
              onChange={(e) => setStatsCampId(Number(e.target.value))}
              className="border rounded-lg px-3 py-2 text-sm bg-white"
            >
              {camps.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
        </SectionHeader>

        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <StatCard label="Umsatz heute" value={fmt(stats.revenueToday)} hint={`${stats.salesToday} Verkäufe`}
                    tone="primary" icon={Euro} onClick={() => setDetail('revenueToday')} />
          <StatCard label="Umsatz gesamt" value={fmt(stats.revenueTotal)} hint={`${stats.salesTotal} Verkäufe`}
                    tone="success" icon={Receipt} onClick={() => setDetail('revenueTotal')} />
          <StatCard label="Teilnehmer" value={stats.participants}
                    tone="info" icon={Users} onClick={() => setDetail('participants')} />
          <StatCard
            label="Offene Schulden"
            value={fmt(stats.openDebt)}
            hint={stats.debtors ? `${stats.debtors} Teilnehmer` : 'niemand im Minus'}
            tone={stats.debtors ? 'accent' : 'neutral'}
            icon={TrendingDown}
            onClick={() => setDetail('debt')}
          />
          <StatCard label="Team aktiv" value={stats.activeTeam} hint={`${users.length} gesamt`}
                    tone="neutral" icon={UserRound} onClick={() => setDetail('team')} />
          <StatCard
            label="Storniert"
            value={stats.reversed}
            hint={stats.flagged ? `${stats.flagged} zu prüfen` : 'nichts offen'}
            tone={stats.flagged ? 'warning' : 'neutral'}
            icon={Package}
            onClick={() => setDetail('reversed')}
          />
        </div>

        {detail && <StatDetailDialog {...detailContent()} onClose={() => setDetail(null)} />}
      </section>

      {/* -------------------------------------------- recent sales + rankings */}
      <div className="grid lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2">
          <SectionHeader title="Letzte Verkäufe" hint="Wer hat was an wen verkauft" />
          <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100 overflow-hidden">
            {stats.recent.map((s) => (
              <div key={s.id} className="flex items-center gap-3 p-3">
                {/* an anonymous cash sale is NOT a person - a name avatar reading "B"
                    made "Barverkauf" look like a participant called Barverkauf */}
                {s.participantName ? (
                  <Avatar name={s.participantName} />
                ) : (
                  <span className="w-10 h-10 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center shrink-0">
                    <Banknote className="w-5 h-5" />
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {s.participantName ?? <span className="text-gray-500 italic font-normal">Barverkauf</span>}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {s.items.map((i) => `${i.quantity}× ${i.productName}`).join(', ')}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-semibold">{fmt(s.totalAmount)}</div>
                  <div className="text-[11px] text-gray-400">
                    {new Date(s.createdAt).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })} · {s.sellerName}
                  </div>
                </div>
              </div>
            ))}
            {stats.recent.length === 0 && (
              <div className="p-6 text-center text-gray-400 text-sm">Noch keine Verkäufe in diesem Camp.</div>
            )}
          </div>
        </section>

        <section className="space-y-6">
          <div>
            <SectionHeader title="Bestseller" hint="Meistverkaufte Produkte" />
            <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100 overflow-hidden">
              {stats.topProducts.map(([name, qty], index) => (
                <div key={name} className="flex items-center gap-3 p-3">
                  <span className="w-6 h-6 rounded-lg bg-primary-soft text-primary text-xs font-bold flex items-center justify-center shrink-0">
                    {index + 1}
                  </span>
                  <span className="flex-1 truncate text-sm font-medium">{name}</span>
                  <Badge tone="primary">{qty}×</Badge>
                </div>
              ))}
              {stats.topProducts.length === 0 && (
                <div className="p-6 text-center text-gray-400 text-sm">Noch nichts verkauft.</div>
              )}
            </div>
          </div>

          <div>
            <SectionHeader title="Top-Käufer" hint="Wer am meisten ausgibt" />
            <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100 overflow-hidden">
              {stats.topBuyers.map(([name, total], index) => (
                <div key={name} className="flex items-center gap-3 p-3">
                  {index === 0
                    ? <Crown className="w-5 h-5 text-warning shrink-0" />
                    : <Trophy className="w-4 h-4 text-gray-300 shrink-0" />}
                  <span className="flex-1 truncate text-sm font-medium">{name}</span>
                  <span className="text-sm font-semibold">{fmt(total)}</span>
                </div>
              ))}
              {stats.topBuyers.length === 0 && (
                <div className="p-6 text-center text-gray-400 text-sm">Noch keine Käufe auf Namen.</div>
              )}
            </div>
          </div>
        </section>
      </div>

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
        <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100 overflow-hidden">
          {camps.map((c) => (
            <div key={c.id} className="p-3 flex justify-between items-center gap-3 hover:bg-gray-50">
              <div className="min-w-0">
                <div className="font-medium flex items-center gap-2">
                  <span className="truncate">{c.name}</span>
                  <Badge tone={c.status === 'ACTIVE' ? 'success' : 'neutral'}>
                    {c.status === 'ACTIVE' ? 'aktiv' : 'abgeschlossen'}
                  </Badge>
                </div>
                <div className="text-sm text-gray-500 truncate">
                  {c.city} · {c.startDate} bis {c.endDate}
                </div>
              </div>
              {isSuper && c.status === 'ACTIVE' && (
                <button onClick={() => setCampToClose(c)}
                        className="text-sm border rounded-lg px-3 py-2 text-accent hover:bg-accent-soft shrink-0">
                  Abschließen
                </button>
              )}
            </div>
          ))}
          {camps.length === 0 && <EmptyState icon={Package}>Noch keine Camps.</EmptyState>}
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
        <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100 overflow-hidden">
          {users.map((u) => (
            <div key={u.id} className={`p-3 flex items-center gap-3 hover:bg-gray-50 ${u.active ? '' : 'opacity-60'}`}>
              <Avatar name={`${u.firstName} ${u.lastName}`} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="font-medium flex items-center gap-2">
                  <span className="truncate">{u.firstName} {u.lastName}</span>
                  {u.id === user.id && <Badge tone="info">Du</Badge>}
                  {!u.active && <Badge tone="accent">deaktiviert</Badge>}
                </div>
                <div className="text-sm text-gray-500 truncate">
                  {roleLabel(u.role)}
                  {u.campName ? ` · ${u.campName}` : ''}
                </div>
              </div>
              {u.id !== user.id && (
                <button onClick={() => toggleUser(u)} className="text-sm border rounded-lg px-3 py-2 hover:bg-gray-100 shrink-0">
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
        <UserForm
          camps={camps}
          isSuper={isSuper}
          onClose={() => setShowUserForm(false)}
          onSaved={reload}
          onCreated={setInvite} // hand over the credentials sheet to pass on
        />
      )}

      {invite && <InviteCard invite={invite} onClose={() => setInvite(null)} />}
    </div>
  )
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

function UserForm({ camps, isSuper, onClose, onSaved, onCreated }) {
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
      const created = await api('/api/users', {
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
      // the plain password only exists here, in this form - the API never returns
      // it again, so the invite sheet has to be built from what we just typed
      onCreated({ ...created, password })
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
