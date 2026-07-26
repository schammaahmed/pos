import { useEffect, useState } from 'react'
import {
  CalendarClock, CheckCircle2, ClipboardList, PackageOpen, Plus, UserRound, X,
} from 'lucide-react'
import { api } from '../api'
import { fmt } from '../money'
import { Badge, EmptyState, SectionHeader } from '../components/ui'
import ParticipantPickerSheet, { rememberRecentParticipant } from '../components/ParticipantPickerSheet'
import { ConfirmDialog } from '../components/Dialog'

// The seller side of Aktionen: two tabs on one page.
//   Vorbestellen  — take a new reservation for a participant
//   Ausgabe       — hand out today's reservations (payment happens here)
// Creating/closing Specials themselves is admin work and lives in the Admin panel.
export default function Aktionen() {
  const [tab, setTab] = useState('reserve')

  return (
    <div className="space-y-4">
      <SectionHeader title="Aktionen" hint="Vorbestellungen & Ausgabe" />

      <div className="flex gap-1 border-b border-gray-200">
        <TabButton active={tab === 'reserve'} onClick={() => setTab('reserve')} Icon={Plus}>
          Vorbestellen
        </TabButton>
        <TabButton active={tab === 'collect'} onClick={() => setTab('collect')} Icon={PackageOpen}>
          Ausgabe
        </TabButton>
      </div>

      {tab === 'reserve' ? <ReserveView /> : <CollectView />}
    </div>
  )
}

function TabButton({ active, onClick, Icon, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${
        active ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      <Icon className="w-4 h-4" /> {children}
    </button>
  )
}

// ---------------------------------------------------------------- Vorbestellen

function ReserveView() {
  const [specials, setSpecials] = useState([])
  const [selectedSpecial, setSelectedSpecial] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => { load() }, [])
  async function load() {
    try {
      const list = await api('/api/specials')
      // seller UX: hide closed Aktionen entirely, keep it focused on what can still be ordered
      setSpecials(list.filter((s) => s.status === 'ACTIVE'))
    } catch (e) { setError(e.message) }
  }

  if (error) return <ErrorBar message={error} />
  if (specials.length === 0) {
    return (
      <EmptyState icon={ClipboardList}>
        Keine offenen Aktionen. Neue Aktionen legt die Stand-Leitung im Admin-Bereich an.
      </EmptyState>
    )
  }

  return (
    <div className="space-y-3">
      <div className="grid sm:grid-cols-2 gap-3">
        {specials.map((s) => (
          <SpecialCard key={s.id} special={s} onOrder={() => setSelectedSpecial(s)} />
        ))}
      </div>

      {selectedSpecial && (
        <ReserveDialog
          special={selectedSpecial}
          onClose={() => setSelectedSpecial(null)}
          onDone={() => { setSelectedSpecial(null); load() }}
        />
      )}
    </div>
  )
}

function SpecialCard({ special, onOrder }) {
  const overCap = special.capacity != null && special.taken >= special.capacity
  const deadlinePassed = special.orderableUntil && new Date(special.orderableUntil) < new Date()
  return (
    <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-bold truncate">{special.name}</div>
          {special.description && (
            <div className="text-sm text-gray-500 mt-0.5">{special.description}</div>
          )}
        </div>
        <div className="text-primary font-bold shrink-0">{fmt(special.price)}</div>
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <CalendarClock className="w-3.5 h-3.5" />
          Ausgabe: {new Date(special.collectionDate).toLocaleDateString('de-AT')}
        </span>
        {special.orderableUntil && (
          <span className="flex items-center gap-1">
            bis {new Date(special.orderableUntil).toLocaleString('de-AT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        {special.capacity != null && (
          <Badge tone={overCap ? 'warning' : 'neutral'}>
            {special.taken}/{special.capacity} bestellt
          </Badge>
        )}
      </div>

      {deadlinePassed && (
        <div className="text-xs text-accent">Bestellfrist abgelaufen – wird beim Speichern abgelehnt.</div>
      )}
      {overCap && !deadlinePassed && (
        <div className="text-xs text-warning">
          Kapazität erreicht. Vorbestellungen sind trotzdem noch möglich; bitte mit der Küche abklären.
        </div>
      )}

      <button
        onClick={onOrder}
        disabled={deadlinePassed}
        className="w-full bg-primary text-white rounded-lg py-2.5 text-sm font-semibold disabled:opacity-40"
      >
        <Plus className="w-4 h-4 inline -mt-0.5 mr-1" /> Vorbestellen
      </button>
    </div>
  )
}

function ReserveDialog({ special, onClose, onDone }) {
  const [participant, setParticipant] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [showPicker, setShowPicker] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function submit() {
    if (!participant) return
    setBusy(true); setError(null)
    try {
      await api('/api/specials/orders', {
        method: 'POST',
        body: { specialId: special.id, participantId: participant.id, quantity: Number(quantity) },
      })
      rememberRecentParticipant(participant.id)
      onDone()
    } catch (e) { setError(e.message); setBusy(false) }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
        <div onClick={(e) => e.stopPropagation()} className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl">
          <div className="flex items-center justify-between px-5 pt-4">
            <h2 className="font-bold">Vorbestellen: {special.name}</h2>
            <button onClick={onClose} className="text-gray-400"><X className="w-5 h-5" /></button>
          </div>

          <div className="p-5 space-y-4">
            {error && <ErrorBar message={error} />}

            {/* participant */}
            <button
              onClick={() => setShowPicker(true)}
              className="w-full flex items-center gap-3 border rounded-lg p-3 text-left hover:bg-gray-50"
            >
              <UserRound className="w-5 h-5 text-gray-400" />
              <span className="flex-1 truncate">
                {participant
                  ? `${participant.firstName} ${participant.lastName}`
                  : <span className="text-gray-400">Teilnehmer wählen …</span>}
              </span>
            </button>

            {/* quantity */}
            <label className="block">
              <span className="block text-sm text-gray-600 mb-1">Menge</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="border rounded-lg w-10 h-10">−</button>
                <input
                  type="number" min={1} value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                  className="flex-1 border rounded-lg px-3 py-2.5 text-center text-lg font-semibold"
                />
                <button onClick={() => setQuantity((q) => q + 1)} className="border rounded-lg w-10 h-10">+</button>
              </div>
            </label>

            <div className="flex justify-between text-sm bg-gray-50 rounded-lg p-3">
              <span className="text-gray-500">Zu zahlen bei Ausgabe</span>
              <span className="font-bold">{fmt(Number(special.price) * quantity)}</span>
            </div>

            <div className="flex gap-2 pt-1">
              <button onClick={onClose} className="flex-1 border rounded-lg py-3">Abbrechen</button>
              <button
                onClick={submit}
                disabled={!participant || busy}
                className="flex-1 bg-primary text-white rounded-lg py-3 font-semibold disabled:opacity-40"
              >
                Vorbestellen
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Rendered OUTSIDE the backdrop above: otherwise a click inside the picker
          bubbles up to the backdrop's onClose and dismisses the whole reservation dialog. */}
      {showPicker && (
        <ParticipantPickerSheet
          onSelect={(p) => { setParticipant(p); setShowPicker(false) }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </>
  )
}

// ---------------------------------------------------------------- Ausgabe

function CollectView() {
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10))
  const [orders, setOrders] = useState([])
  const [collecting, setCollecting] = useState(null) // order awaiting payment method
  const [cancelling, setCancelling] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => { load() }, [day])
  async function load() {
    try {
      setOrders(await api(`/api/specials/collection?day=${day}`))
    } catch (e) { setError(e.message) }
  }

  async function doCancel(id) {
    setError(null)
    try {
      await api(`/api/specials/orders/${id}/cancel`, { method: 'POST' })
      setCancelling(null); load()
    } catch (e) { setError(e.message) }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          type="date" value={day} onChange={(e) => setDay(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
        />
        <button onClick={() => setDay(new Date().toISOString().slice(0, 10))}
                className="text-sm text-gray-500 hover:text-gray-700">Heute</button>
      </div>

      {error && <ErrorBar message={error} />}

      {orders.length === 0 ? (
        <EmptyState icon={PackageOpen}>Keine offenen Vorbestellungen für diesen Tag.</EmptyState>
      ) : (
        <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100 overflow-hidden">
          {orders.map((o) => (
            <div key={o.id} className="p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">
                  {o.quantity}× {o.specialName} <span className="text-gray-400 font-normal">·</span>{' '}
                  <span className="text-gray-600">{o.participantName}</span>
                </div>
                <div className="text-xs text-gray-500 truncate">
                  vorbestellt {new Date(o.createdAt).toLocaleString('de-AT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · {o.createdByName}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-semibold">{fmt(o.totalAmount)}</div>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <button onClick={() => setCollecting(o)}
                        className="bg-primary text-white rounded-lg px-3 py-1.5 text-sm font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Ausgeben
                </button>
                <button onClick={() => setCancelling(o)}
                        className="text-xs text-gray-400 hover:text-accent">Stornieren</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {collecting && (
        <CollectDialog
          order={collecting}
          onClose={() => setCollecting(null)}
          onDone={() => { setCollecting(null); load() }}
        />
      )}
      {cancelling && (
        <ConfirmDialog
          title="Vorbestellung stornieren"
          message={`Vorbestellung „${cancelling.quantity}× ${cancelling.specialName}" für ${cancelling.participantName} stornieren?`}
          confirmLabel="Stornieren"
          tone="danger"
          onConfirm={() => doCancel(cancelling.id)}
          onClose={() => setCancelling(null)}
        />
      )}
    </div>
  )
}

// A slim, purpose-built payment picker for special collections. It mirrors the seller
// panel's 3-method selector but doesn't need a cart — the total is fixed.
function CollectDialog({ order, onClose, onDone }) {
  const [method, setMethod] = useState('cash')
  const [cash, setCash] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const total = Number(order.totalAmount)

  async function submit() {
    setBusy(true); setError(null)
    let body
    if (method === 'balance') body = { cashGiven: 0, useBalance: true, keepChangeAsCredit: false }
    else if (method === 'debt') body = { cashGiven: 0, useBalance: false, keepChangeAsCredit: false }
    else {
      const given = Number(String(cash).replace(',', '.')) || 0
      if (given < total) { setError(`Es fehlen ${(total - given).toFixed(2)} € – bei Bar muss der Betrag voll bezahlt werden.`); setBusy(false); return }
      body = { cashGiven: given, useBalance: false, keepChangeAsCredit: false }
    }
    try {
      await api(`/api/specials/orders/${order.id}/collect`, { method: 'POST', body })
      onDone()
    } catch (e) { setError(e.message); setBusy(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl">
        <div className="flex items-center justify-between px-5 pt-4">
          <h2 className="font-bold">Ausgeben: {order.quantity}× {order.specialName}</h2>
          <button onClick={onClose} className="text-gray-400"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {error && <ErrorBar message={error} />}

          <div className="flex justify-between text-sm bg-gray-50 rounded-lg p-3">
            <span className="text-gray-500">{order.participantName}</span>
            <span className="font-bold text-lg">{fmt(total)}</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <MethodButton active={method === 'cash'} onClick={() => setMethod('cash')}>Bar</MethodButton>
            <MethodButton active={method === 'balance'} onClick={() => setMethod('balance')}>Guthaben</MethodButton>
            <MethodButton active={method === 'debt'} onClick={() => setMethod('debt')}>Schulden</MethodButton>
          </div>

          {method === 'cash' && (
            <input
              inputMode="decimal" value={cash} onChange={(e) => setCash(e.target.value)}
              placeholder={`Betrag (mind. ${total.toFixed(2)})`}
              className="w-full border rounded-lg px-3 py-3 text-lg"
              autoFocus
            />
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 border rounded-lg py-3">Abbrechen</button>
            <button onClick={submit} disabled={busy}
                    className="flex-1 bg-primary text-white rounded-lg py-3 font-semibold disabled:opacity-40">
              Ausgabe bestätigen
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function MethodButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg py-2.5 text-sm font-semibold border ${
        active ? 'border-primary bg-primary text-white' : 'border-gray-200 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  )
}

function ErrorBar({ message }) {
  return <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3">{message}</div>
}
