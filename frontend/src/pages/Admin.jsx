import { useEffect, useMemo, useState } from 'react'
import {
  Banknote, Coins, Crown, Euro, LayoutDashboard, Lightbulb, Package, PackageOpen, QrCode,
  Receipt, RefreshCw, Tent, TrendingDown, Trophy, UserRound, Users,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth, roleLabel } from '../auth'
import { useCamp } from '../campContext'
import { ConfirmDialog } from '../components/Dialog'
import SetupChecklist from '../components/SetupChecklist'
import CashBox from '../components/CashBox'
import StatDetailDialog from '../components/StatDetailDialog'
import InviteCard from '../components/InviteCard'
import TeamMemberDialog from '../components/TeamMemberDialog'
import { Avatar, Badge, EmptyState, SectionHeader, StatCard } from '../components/ui'
import { fmt } from '../money'

// Admin area for ONE camp. CAMP_LEAD manages their own; a SUPER_ADMIN works on whichever
// camp is active in the top-bar switcher and can additionally create/close camps. The page
// is split into tabs so it stays scannable instead of one long scroll. Everything on the
// dashboard is derived from the existing endpoints - no extra API needed.
export default function Admin() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isSuper = user.role === 'SUPER_ADMIN'
  // the active camp comes from the shared context (top-bar switcher for super admins,
  // own camp for a lead), so every page - not just this one - stays on the same camp
  const { camps, activeCampId, activeCamp, refreshCamps } = useCamp()
  const [users, setUsers] = useState([])
  const [sales, setSales] = useState([])
  const [participants, setParticipants] = useState([])
  const [products, setProducts] = useState([]) // only for the setup checklist
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('overview')
  const [showCampForm, setShowCampForm] = useState(false)
  const [showUserForm, setShowUserForm] = useState(false)
  const [campToClose, setCampToClose] = useState(null) // camp awaiting the close confirmation
  const [detail, setDetail] = useState(null) // which stat tile is drilled into
  const [member, setMember] = useState(null) // team member whose activity is open
  const [invite, setInvite] = useState(null) // credentials sheet for a freshly created user

  async function reload() {
    try {
      await refreshCamps()
      setUsers(await api('/api/users'))
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => {
    reload()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // load the figures for the active camp (api() adds campId for super admins automatically)
  useEffect(() => {
    if (!activeCampId) return
    api('/api/sales').then(setSales).catch(() => setSales([]))
    api('/api/participants').then(setParticipants).catch(() => setParticipants([]))
    api('/api/products?activeOnly=false').then(setProducts).catch(() => setProducts([]))
  }, [activeCampId])

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

  const statsCamp = activeCamp

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
      done: users.some((u) => ['SELLER', 'CAMP_LEAD'].includes(u.role)),
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

  const tabs = [
    { id: 'overview', label: 'Überblick', Icon: LayoutDashboard },
    { id: 'team', label: 'Team', Icon: Users },
    { id: 'cash', label: 'Kasse', Icon: Coins },
    { id: 'specials', label: 'Aktionen', Icon: PackageOpen },
    { id: 'selfserve', label: 'Selbstbedienung', Icon: QrCode },
    ...(isSuper ? [{ id: 'camps', label: 'Camps', Icon: Package }] : []),
  ]

  return (
    <div className="space-y-6">
      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3">{error}</div>}

      {/* a super admin works on ONE camp at a time - say which, so nothing is ambiguous */}
      {isSuper && statsCamp && (
        <div className="flex items-center gap-2 text-sm bg-primary-soft text-primary-dark rounded-lg px-3 py-2">
          <Tent className="w-4 h-4 shrink-0" />
          <span>Du bearbeitest <strong>{statsCamp.name}</strong>. Oben in der Leiste wechselst du das Camp.</span>
        </div>
      )}

      <SetupChecklist steps={setupSteps} />

      {/* tabs keep the admin area scannable instead of one endless scroll */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {tabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
              tab === id ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* ---------------------------------------------------------- overview */}
      {tab === 'overview' && (
      <div className="space-y-6">
      <section>
        <SectionHeader title="Überblick" hint={statsCamp ? statsCamp.name : 'Kein Camp ausgewählt'} />

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
      </div>
      )}

      {/* ---------------------------------------------------------------- cash */}
      {tab === 'cash' && activeCampId && <CashBox campId={activeCampId} />}

      {tab === 'specials' && activeCampId && <SpecialsAdmin />}

      {tab === 'selfserve' && activeCampId && <SelfServeAdmin />}

      {/* camps - super admin manages, and creates/closes them here */}
      {tab === 'camps' && (
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
      )}

      {/* ---------------------------------------------------------------- team */}
      {tab === 'team' && (
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
              {/* the row itself opens the person's activity */}
              <button onClick={() => setMember(u)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                <Avatar name={`${u.firstName} ${u.lastName}`} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium flex items-center gap-2 flex-wrap">
                    <span className="truncate">{u.firstName} {u.lastName}</span>
                    {u.id === user.id && <Badge tone="info">Du</Badge>}
                    {!u.active
                      ? <Badge tone="accent">deaktiviert</Badge>
                      : u.lastLoginAt
                        ? <Badge tone="success">aktiv</Badge>
                        : <Badge tone="warning">eingeladen</Badge>}
                  </div>
                  <div className="text-sm text-gray-500 truncate">
                    {roleLabel(u.role)}
                    {u.campName ? ` · ${u.campName}` : ''}
                    {u.lastLoginAt
                      ? ` · zuletzt ${new Date(u.lastLoginAt).toLocaleDateString('de-AT')}`
                      : ' · noch nie angemeldet'}
                  </div>
                </div>
              </button>
              {u.id !== user.id && (
                <button onClick={() => toggleUser(u)} className="text-sm border rounded-lg px-3 py-2 hover:bg-gray-100 shrink-0">
                  {u.active ? 'Deaktivieren' : 'Aktivieren'}
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
      )}

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

      {member && <TeamMemberDialog member={member} sales={sales} onClose={() => setMember(null)} />}
    </div>
  )
}

function CampForm({ onClose, onSaved }) {
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [startingCash, setStartingCash] = useState('')
  const [error, setError] = useState(null)

  async function submit(event) {
    event.preventDefault()
    try {
      await api('/api/camps', {
        method: 'POST',
        body: {
          name, city, startDate, endDate,
          startingCash: startingCash ? Number(startingCash.replace(',', '.')) : 0,
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
        <label className="block text-sm text-gray-600">
          Startgeld in der Kasse (Wechselgeld, optional)
          <input inputMode="decimal" placeholder="z.B. 50,00" value={startingCash}
                 onChange={(e) => setStartingCash(e.target.value)} className="w-full border rounded-lg px-3 py-3 mt-1" />
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

  // a camp lead may only create sellers and fellow leads - the backend enforces this too
  const roles = isSuper
    ? ['SELLER', 'CAMP_LEAD', 'SUPER_ADMIN']
    : ['SELLER', 'CAMP_LEAD']

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

// -------- Aktionen (Specials) admin: create/list/close ---------------------
// The seller side (reserve + Ausgabe) lives on /aktionen; here the lead defines
// what the stand is going to offer.
function SpecialsAdmin() {
  const [specials, setSpecials] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [closing, setClosing] = useState(null)
  const [error, setError] = useState(null)

  async function reload() {
    try { setSpecials(await api('/api/specials')) } catch (e) { setError(e.message) }
  }
  useEffect(() => { reload() }, [])

  async function doClose(id) {
    try { await api(`/api/specials/${id}/close`, { method: 'POST' }); setClosing(null); reload() }
    catch (e) { setError(e.message) }
  }

  return (
    <section className="space-y-3">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="font-bold text-lg">Aktionen</h2>
          <p className="text-xs text-gray-500">
            Vorbestell-Angebote wie „Waffeln am Samstag". Bestellungen laufen im Panel „Aktionen" auf.
          </p>
        </div>
        <button onClick={() => setShowForm(true)}
                className="bg-primary text-white rounded-lg px-4 py-2 text-sm font-semibold">
          + Aktion
        </button>
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3">{error}</div>}

      <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100 overflow-hidden">
        {specials.map((s) => (
          <div key={s.id} className="p-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-medium flex items-center gap-2 flex-wrap">
                <span className="truncate">{s.name}</span>
                <Badge tone={s.status === 'ACTIVE' ? 'success' : 'neutral'}>
                  {s.status === 'ACTIVE' ? 'aktiv' : 'geschlossen'}
                </Badge>
              </div>
              <div className="text-xs text-gray-500 truncate">
                {fmt(s.price)} · Ausgabe {new Date(s.collectionDate).toLocaleDateString('de-AT')}
                {s.orderableUntil && ' · bis ' + new Date(s.orderableUntil).toLocaleString('de-AT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                {s.capacity != null && ` · ${s.taken}/${s.capacity} bestellt`}
                {s.capacity == null && s.taken > 0 && ` · ${s.taken} bestellt`}
              </div>
            </div>
            {s.status === 'ACTIVE' && (
              <button onClick={() => setClosing(s)}
                      className="text-sm border rounded-lg px-3 py-2 text-accent hover:bg-accent-soft shrink-0">
                Schließen
              </button>
            )}
          </div>
        ))}
        {specials.length === 0 && <EmptyState icon={PackageOpen}>Noch keine Aktionen.</EmptyState>}
      </div>

      {showForm && <SpecialForm onClose={() => setShowForm(false)} onSaved={reload} />}
      {closing && (
        <ConfirmDialog
          title="Aktion schließen"
          message={`„${closing.name}" schließen? Neue Vorbestellungen werden dann abgelehnt; bestehende bleiben.`}
          confirmLabel="Schließen"
          tone="danger"
          onConfirm={() => doClose(closing.id)}
          onClose={() => setClosing(null)}
        />
      )}
    </section>
  )
}

function SpecialForm({ onClose, onSaved }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [collectionDate, setCollectionDate] = useState('')
  const [orderableUntil, setOrderableUntil] = useState('')
  const [capacity, setCapacity] = useState('')
  const [error, setError] = useState(null)

  async function submit(event) {
    event.preventDefault()
    try {
      await api('/api/specials', {
        method: 'POST',
        body: {
          name, description: description || null,
          price: Number(String(price).replace(',', '.')),
          collectionDate,
          orderableUntil: orderableUntil || null,
          capacity: capacity ? Number(capacity) : null,
        },
      })
      onSaved(); onClose()
    } catch (e) { setError(e.message) }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-30 flex items-end sm:items-center justify-center" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="bg-white rounded-t-2xl sm:rounded-2xl p-4 w-full max-w-md space-y-3">
        <h2 className="font-bold text-lg">Aktion anlegen</h2>
        {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-2">{error}</div>}
        <input required placeholder="Name (z.B. Waffeln am Samstag)" value={name}
               onChange={(e) => setName(e.target.value)} className="w-full border rounded-lg px-3 py-3" />
        <textarea placeholder="Kurzbeschreibung (optional)" value={description}
                  onChange={(e) => setDescription(e.target.value)} rows={2}
                  className="w-full border rounded-lg px-3 py-3" />
        <input required inputMode="decimal" placeholder="Preis pro Stück (z.B. 3,00)" value={price}
               onChange={(e) => setPrice(e.target.value)} className="w-full border rounded-lg px-3 py-3" />
        <label className="block text-sm text-gray-600">
          Ausgabetag
          <input required type="date" value={collectionDate}
                 onChange={(e) => setCollectionDate(e.target.value)}
                 className="w-full border rounded-lg px-3 py-3 mt-1" />
        </label>
        <label className="block text-sm text-gray-600">
          Bestellschluss (optional)
          <input type="datetime-local" value={orderableUntil}
                 onChange={(e) => setOrderableUntil(e.target.value)}
                 className="w-full border rounded-lg px-3 py-3 mt-1" />
        </label>
        <label className="block text-sm text-gray-600">
          Max. Menge (optional; wird als Warnung angezeigt, nicht als harte Sperre)
          <input type="number" min={1} placeholder="z.B. 20" value={capacity}
                 onChange={(e) => setCapacity(e.target.value)}
                 className="w-full border rounded-lg px-3 py-3 mt-1" />
        </label>
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 border rounded-lg py-3">Abbrechen</button>
          <button type="submit" className="flex-1 bg-primary text-white rounded-lg py-3 font-semibold">Anlegen</button>
        </div>
      </form>
    </div>
  )
}

// -------- Self-service admin: the QR to display at the stand + open hours ---
function SelfServeAdmin() {
  const [cfg, setCfg] = useState(null)
  const [openFrom, setOpenFrom] = useState('')
  const [openUntil, setOpenUntil] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [confirmRotate, setConfirmRotate] = useState(false)

  async function load() {
    try {
      const c = await api('/api/preorders/config')
      setCfg(c)
      setOpenFrom(c.openFrom ? String(c.openFrom).slice(0, 5) : '')
      setOpenUntil(c.openUntil ? String(c.openUntil).slice(0, 5) : '')
    } catch (e) { setError(e.message) }
  }
  useEffect(() => { load() }, [])

  async function save(rotateToken) {
    setSaving(true); setError(null)
    try {
      const c = await api('/api/preorders/config', {
        method: 'PUT',
        body: {
          openFrom: openFrom || null,
          openUntil: openUntil || null,
          rotateToken: Boolean(rotateToken),
        },
      })
      setCfg(c)
      setConfirmRotate(false)
    } catch (e) { setError(e.message) }
    setSaving(false)
  }

  if (!cfg) return null

  // The URL the QR encodes. window.location.origin makes it work on the sandbox and
  // production without a config knob - whatever host the admin loaded the app from.
  const url = `${window.location.origin}/self?t=${cfg.selfServeToken}`

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-bold text-lg">Selbstbedienung</h2>
        <p className="text-xs text-gray-500">
          Teilnehmer:innen scannen den QR am Stand, geben ihren Namen ein und können dann eigenständig
          vorbestellen. Bezahlt wird bei der Abholung – siehe Panel „Vorbestellungen".
        </p>
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3">{error}</div>}

      <div className="grid md:grid-cols-2 gap-4">
        {/* QR card */}
        <div className="bg-white rounded-xl shadow-sm p-4 flex flex-col items-center gap-3">
          <div className="p-3 bg-white rounded-lg" style={{ border: '1px solid #eee' }}>
            <QRCodeSVG value={url} size={192} level="M" />
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-400">Ziel-Adresse (zum Testen)</div>
            <a href={url} target="_blank" rel="noreferrer"
               className="text-sm text-primary break-all hover:underline">{url}</a>
          </div>
          <button onClick={() => setConfirmRotate(true)}
                  className="text-xs text-gray-400 hover:text-accent flex items-center gap-1">
            <RefreshCw className="w-3.5 h-3.5" /> Neuen QR-Code erzeugen (alten deaktivieren)
          </button>
        </div>

        {/* Windows */}
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <div>
            <div className="font-medium">Öffnungszeiten</div>
            <p className="text-xs text-gray-500">
              Wenn beide leer sind, ist die Selbstbedienung immer geöffnet (solange das Camp aktiv ist).
              Eine Zeit von 22:00 bis 02:00 gilt über Mitternacht.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm text-gray-600">
              Offen ab
              <input type="time" value={openFrom} onChange={(e) => setOpenFrom(e.target.value)}
                     className="w-full border rounded-lg px-3 py-2 mt-1" />
            </label>
            <label className="block text-sm text-gray-600">
              Offen bis
              <input type="time" value={openUntil} onChange={(e) => setOpenUntil(e.target.value)}
                     className="w-full border rounded-lg px-3 py-2 mt-1" />
            </label>
          </div>
          <button onClick={() => save(false)} disabled={saving}
                  className="w-full bg-primary text-white rounded-lg py-2.5 text-sm font-semibold disabled:opacity-40">
            Speichern
          </button>
        </div>
      </div>

      {confirmRotate && (
        <ConfirmDialog
          title="Neuen QR-Code erzeugen"
          message="Der bisherige QR-Code wird sofort ungültig. Ausgedruckte oder verteilte QR-Codes müssen neu gemacht werden."
          confirmLabel="Neuen Code erzeugen"
          tone="danger"
          onConfirm={() => save(true)}
          onClose={() => setConfirmRotate(false)}
        />
      )}
    </section>
  )
}
