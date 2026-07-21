import { useEffect, useMemo, useState } from 'react'
import { FileSpreadsheet, Search, TrendingDown, UserRound, Users, Wallet } from 'lucide-react'
import { api } from '../api'
import { useAuth, isLead } from '../auth'
import { fmt } from '../money'
import { AmountDialog, ConfirmDialog } from '../components/Dialog'
import ImportDialog from '../components/ImportDialog'
import { Badge, EmptyState, StatCard, ViewToggle } from '../components/ui'

const VIEW_KEY = 'pos_participants_view'

// Participant list with balance, history, deposit and (for leads) debt settlement.
export default function Participants() {
  const { user } = useAuth()
  const [participants, setParticipants] = useState([])
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState(null) // which row is expanded
  const [view, setView] = useState(() => localStorage.getItem(VIEW_KEY) || 'list')
  const [error, setError] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showImport, setShowImport] = useState(false)

  function changeView(next) {
    setView(next)
    localStorage.setItem(VIEW_KEY, next)
  }

  async function reload() {
    try {
      const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ''
      setParticipants(await api(`/api/participants${query}`))
    } catch (e) {
      setError(e.message)
    }
  }

  // reload when the search text settles (250ms after the last keystroke)
  useEffect(() => {
    const timer = setTimeout(reload, 250)
    return () => clearTimeout(timer)
  }, [search]) // eslint-disable-line react-hooks/exhaustive-deps

  const openDebts = participants.filter((p) => p.inDebt)

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suchen…"
            className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-3"
          />
        </div>
        <ViewToggle view={view} onChange={changeView} />
        {isLead(user) && (
          <>
            <button onClick={() => setShowImport(true)} title="Aus Excel importieren"
                    className="border rounded-lg px-3 py-2.5 text-sm bg-white hover:bg-gray-50 shrink-0 flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4" /> <span className="hidden sm:inline">Import</span>
            </button>
            <button onClick={() => setShowCreate(true)} className="bg-primary text-white rounded-lg px-4 font-semibold shrink-0">
              + Neu
            </button>
          </>
        )}
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3">{error}</div>}

      {/* summary strip: the three numbers a lead actually wants at a glance */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard label="Teilnehmer" value={participants.length} tone="info" icon={Users} />
        <StatCard
          label="Offene Schulden"
          // debts are stored as negative balances - show the total owed as a positive amount
          value={fmt(Math.abs(openDebts.reduce((sum, p) => sum + Number(p.balance), 0)))}
          hint={openDebts.length ? `${openDebts.length} Teilnehmer` : 'niemand im Minus'}
          tone={openDebts.length ? 'accent' : 'neutral'}
          icon={TrendingDown}
        />
        <StatCard
          label="Guthaben gesamt"
          value={fmt(participants.filter((p) => !p.inDebt).reduce((sum, p) => sum + Number(p.balance), 0))}
          tone="success"
          icon={Wallet}
        />
      </div>

      {participants.length === 0 ? (
        <EmptyState
          icon={UserRound}
          hint={
            search
              ? 'Andere Schreibweise probieren oder die Suche leeren.'
              : isLead(user)
                ? 'Lege die Kinder an, die am Stand einkaufen können.'
                : undefined
          }
          action={!search && isLead(user) ? () => setShowCreate(true) : undefined}
          cta="Ersten Teilnehmer anlegen"
        >
          {search ? `Niemand gefunden für „${search}".` : 'Noch keine Teilnehmer.'}
        </EmptyState>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {participants.map((p) => (
            <button
              key={p.id}
              onClick={() => setOpenId(openId === p.id ? null : p.id)}
              className={`bg-white rounded-xl shadow-sm p-4 text-left hover:shadow-md transition ${
                openId === p.id ? 'ring-2 ring-primary' : ''
              }`}
            >
              <div className="font-semibold leading-tight truncate">
                {p.firstName} {p.lastName}
              </div>
              <div className={`text-sm mt-1 ${p.inDebt ? 'text-accent font-semibold' : 'text-primary'}`}>
                {p.inDebt ? `Schulden ${fmt(Math.abs(Number(p.balance)))}` : fmt(p.balance)}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100 overflow-hidden">
          {participants.map((p) => (
            <ParticipantRow
              key={p.id}
              participant={p}
              open={openId === p.id}
              onToggle={() => setOpenId(openId === p.id ? null : p.id)}
              canSettle={isLead(user)}
              onChanged={reload}
            />
          ))}
        </div>
      )}

      {/* in grid view the details still need somewhere to live */}
      {view === 'grid' && openId && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <ParticipantRow
            participant={participants.find((p) => p.id === openId)}
            open
            onToggle={() => setOpenId(null)}
            canSettle={isLead(user)}
            onChanged={reload}
          />
        </div>
      )}

      {showCreate && <CreateParticipantForm onClose={() => setShowCreate(false)} onCreated={reload} />}
      {showImport && (
        <ImportDialog kind="participants" onClose={() => setShowImport(false)} onImported={reload} />
      )}
    </div>
  )
}

function ParticipantRow({ participant, open, onToggle, canSettle, onChanged }) {
  const [history, setHistory] = useState(null)
  const [sales, setSales] = useState(null)
  const [error, setError] = useState(null)
  const [dialog, setDialog] = useState(null) // 'deposit' | 'settle' | null

  // load the details only when the row is opened - not for all 80 participants upfront
  useEffect(() => {
    if (!open) return
    api(`/api/participants/${participant.id}/history`).then(setHistory).catch(() => setHistory([]))
    api(`/api/sales?participantId=${participant.id}`).then(setSales).catch(() => setSales([]))
  }, [open, participant.id])

  async function deposit(amount) {
    setError(null)
    await api(`/api/participants/${participant.id}/deposit`, { method: 'POST', body: { amount } })
    onChanged()
  }

  async function settleDebt() {
    setError(null)
    try {
      await api(`/api/participants/${participant.id}/settle-debt`, { method: 'POST' })
      onChanged()
    } catch (e) {
      setError(e.message)
    }
  }

  const debt = Math.abs(Number(participant.balance))

  // their usual order, counted across everything they actually bought
  const topItems = useMemo(() => {
    const counts = new Map()
    for (const sale of sales ?? []) {
      if (sale.status === 'REVERSED') continue // a reversed sale never happened
      for (const item of sale.items) {
        counts.set(item.productName, (counts.get(item.productName) ?? 0) + item.quantity)
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4)
  }, [sales])

  return (
    <div>
      <div className="flex items-center gap-2 pr-3 hover:bg-gray-50">
        <button onClick={onToggle} className="flex-1 flex justify-between items-center gap-3 p-4 text-left min-w-0">
          <span className="font-medium truncate">
            {participant.firstName} {participant.lastName}
          </span>
          <span className="flex items-center gap-2 shrink-0">
            {participant.inDebt && <Badge tone="accent">Schulden</Badge>}
            <span className={participant.inDebt ? 'text-accent font-semibold' : 'text-primary'}>
              {participant.inDebt ? fmt(debt) : fmt(participant.balance)}
            </span>
          </span>
        </button>

        {/* Settling used to be hidden inside the expanded row, so it looked missing.
            For anyone in debt it now sits on the row itself - one click, no digging. */}
        {canSettle && participant.inDebt && (
          <button onClick={() => setDialog('settle')}
                  className="shrink-0 border border-accent text-accent rounded-lg px-3 py-2 text-xs font-semibold hover:bg-accent-soft">
            Begleichen
          </button>
        )}
      </div>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-2">{error}</div>}

          <div className="flex gap-2">
            <button onClick={() => setDialog('deposit')}
                    className="flex-1 bg-primary text-white rounded-lg py-2 text-sm font-semibold flex items-center justify-center gap-1.5">
              <Wallet className="w-4 h-4" /> Einzahlen
            </button>
            {canSettle && participant.inDebt && (
              <button onClick={() => setDialog('settle')}
                      className="flex-1 border border-accent text-accent rounded-lg py-2 text-sm font-semibold hover:bg-accent/5">
                Schulden begleichen
              </button>
            )}
          </div>

          {dialog === 'deposit' && (
            <AmountDialog
              title={`Einzahlen für ${participant.firstName} ${participant.lastName}`}
              label="Betrag, den die Person übergibt"
              confirmLabel="Einzahlen"
              onSubmit={deposit}
              onClose={() => setDialog(null)}
            />
          )}
          {dialog === 'settle' && (
            <ConfirmDialog
              title="Schulden begleichen"
              message={`${participant.firstName} ${participant.lastName} hat ${fmt(debt)} offen. Wurde das Geld kassiert? Der Saldo wird auf 0,00 € gesetzt.`}
              confirmLabel="Ja, bezahlt"
              tone="danger"
              onConfirm={settleDebt}
              onClose={() => setDialog(null)}
            />
          )}

          {/* Was this person's usual? Comes straight out of their own purchases. */}
          {topItems.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-500 mb-1.5">LIEBLINGSPRODUKTE</div>
              <div className="flex flex-wrap gap-1.5">
                {topItems.map(([name, qty]) => (
                  <span key={name} className="bg-primary-soft text-primary text-xs rounded-full px-2.5 py-1 font-medium">
                    {name} · {qty}×
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Purchase history: one card per sale with the items stacked underneath,
              instead of everything squeezed onto a single line. */}
          {sales?.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-500 mb-1.5">EINKÄUFE</div>
              <div className="bg-gray-50 rounded-lg divide-y divide-gray-200 overflow-hidden">
                {sales.map((s) => (
                  <div key={s.id} className={`p-3 ${s.status === 'REVERSED' ? 'opacity-50' : ''}`}>
                    <div className="flex justify-between items-start gap-3">
                      <span className="text-xs text-gray-500">
                        {new Date(s.createdAt).toLocaleString('de-AT')} · {s.sellerName}
                      </span>
                      <span className={`font-semibold shrink-0 ${s.status === 'REVERSED' ? 'line-through' : ''}`}>
                        {fmt(s.totalAmount)}
                      </span>
                    </div>
                    <ul className="mt-1 space-y-0.5">
                      {s.items.map((i, idx) => (
                        <li key={idx} className={`text-sm flex justify-between ${s.status === 'REVERSED' ? 'line-through' : ''}`}>
                          <span>{i.quantity}× {i.productName}</span>
                          <span className="text-gray-500">{fmt(i.lineTotal)}</span>
                        </li>
                      ))}
                    </ul>
                    {(s.status === 'REVERSED' || s.flaggedForReview) && (
                      <div className="mt-1.5 flex gap-1.5">
                        {s.status === 'REVERSED' && <Badge tone="neutral">storniert</Badge>}
                        {s.flaggedForReview && <Badge tone="warning">zu prüfen</Badge>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* deposits & settlements */}
          {history?.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-gray-500 mb-1.5">EIN-/AUSZAHLUNGEN</div>
              <div className="bg-gray-50 rounded-lg divide-y divide-gray-200 overflow-hidden">
                {history.map((h) => (
                  <div key={h.id} className="flex justify-between items-center p-3 text-sm">
                    <span>
                      {h.type === 'DEPOSIT' ? 'Einzahlung' : 'Schulden beglichen'}
                      <span className="block text-xs text-gray-500">
                        {new Date(h.createdAt).toLocaleString('de-AT')} · {h.performedBy}
                      </span>
                    </span>
                    <span className="font-semibold">{fmt(h.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function CreateParticipantForm({ onClose, onCreated }) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [gender, setGender] = useState(null) // 'M' | 'W' | null (optional)
  const [initialBalance, setInitialBalance] = useState('')
  const [error, setError] = useState(null)

  async function submit(event) {
    event.preventDefault()
    try {
      await api('/api/participants', {
        method: 'POST',
        body: {
          firstName,
          lastName,
          phone: phone || null,
          gender,
          initialBalance: initialBalance ? Number(initialBalance.replace(',', '.')) : null,
        },
      })
      onCreated()
      onClose()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-30 flex items-end sm:items-center justify-center" onClick={onClose}>
      {/* stopPropagation: clicking INSIDE the form must not close it */}
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="bg-white rounded-t-2xl sm:rounded-2xl p-4 w-full max-w-md space-y-3">
        <h2 className="font-bold text-lg">Teilnehmer anlegen</h2>
        {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-2">{error}</div>}
        <input required placeholder="Vorname" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full border rounded-lg px-3 py-3" />
        <input required placeholder="Nachname" value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full border rounded-lg px-3 py-3" />
        <input placeholder="Handynummer (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full border rounded-lg px-3 py-3" />
        {/* optional - powers the M/W filter in the seller panel's picker */}
        <div className="flex gap-2 items-center">
          <span className="text-sm text-gray-600">Geschlecht:</span>
          {['M', 'W'].map((g) => (
            <button key={g} type="button" onClick={() => setGender(gender === g ? null : g)}
                    className={`rounded-full px-4 py-2 text-sm border ${
                      gender === g ? 'bg-primary text-white border-primary' : 'bg-white border-gray-300'
                    }`}>
              {g}
            </button>
          ))}
        </div>
        <input placeholder="Startguthaben € (optional)" inputMode="decimal" value={initialBalance} onChange={(e) => setInitialBalance(e.target.value)} className="w-full border rounded-lg px-3 py-3" />
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 border rounded-lg py-3">Abbrechen</button>
          <button type="submit" className="flex-1 bg-primary text-white rounded-lg py-3 font-semibold">Anlegen</button>
        </div>
      </form>
    </div>
  )
}
