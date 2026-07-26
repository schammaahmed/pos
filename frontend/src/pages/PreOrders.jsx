import { useEffect, useState } from 'react'
import {
  CheckCircle2, ChevronRight, Clock, Flame, Footprints, PackageOpen, PlayCircle, X,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { fmt } from '../money'
import { EmptyState, SectionHeader } from '../components/ui'
import { ConfirmDialog } from '../components/Dialog'

// Kitchen board for incoming self-serve pre-orders. Grouped by status so the flow
// through the station is obvious at a glance:
//   Neu           — participant just placed it
//   In Küche      — someone is preparing it
//   Fertig        — ready to hand out
//   Verlauf       — the day's done + cancelled work (collapsed by default)
//
// Not every order needs the middle stops: a Snickers goes NEW → PICKED_UP directly
// (the row shows both "Starten" and "Direkt abgeholt"), a cheese toast goes through
// the whole flow.
export default function PreOrders() {
  const [orders, setOrders] = useState([])
  const [error, setError] = useState(null)
  const [pickingUp, setPickingUp] = useState(null)
  const [cancelling, setCancelling] = useState(null)
  const [showPast, setShowPast] = useState(false)

  async function reload() {
    try { setOrders(await api('/api/preorders')) } catch (e) { setError(e.message) }
  }
  useEffect(() => {
    reload()
    // small polling so fresh orders and other sellers' status changes show without a refresh
    const t = setInterval(reload, 6000)
    return () => clearInterval(t)
  }, [])

  async function transition(id, action) {
    setError(null)
    try { await api(`/api/preorders/${id}/${action}`, { method: 'POST' }); reload() }
    catch (e) { setError(e.message) }
  }
  async function doCancel(id) {
    try { await api(`/api/preorders/${id}/cancel`, { method: 'POST' }); setCancelling(null); reload() }
    catch (e) { setError(e.message) }
  }

  const neu = orders.filter((o) => o.status === 'NEW')
  const kitchen = orders.filter((o) => o.status === 'IN_PROGRESS')
  const ready = orders.filter((o) => o.status === 'READY')
  const past = orders.filter((o) => o.status === 'PICKED_UP' || o.status === 'CANCELLED')

  return (
    <div className="space-y-6">
      <SectionHeader title="Vorbestellungen" hint="Selbstbedienung vom QR-Code">
        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-500">
            {neu.length} neu · {kitchen.length} in Küche · {ready.length} fertig
          </div>
          {/* opens the fast-input walk mode - a seller loops through the bus taking orders */}
          <Link to="/preorders/walk"
                className="inline-flex items-center gap-1.5 bg-primary text-white rounded-lg px-3 py-1.5 text-sm font-semibold">
            <Footprints className="w-4 h-4" /> Rundgang
          </Link>
        </div>
      </SectionHeader>

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3">{error}</div>}

      {orders.length === 0 && !error && (
        <EmptyState icon={PackageOpen}>
          Noch keine Vorbestellungen. Sobald jemand den QR-Code scannt, landen die Bestellungen hier.
        </EmptyState>
      )}

      {/* the three action columns; stacks on mobile, side by side on lg */}
      {(neu.length + kitchen.length + ready.length) > 0 && (
        <div className="grid gap-4 lg:grid-cols-3">
          <StatusColumn
            title="Neu"
            hint="gerade vorbestellt"
            tone="primary"
            Icon={Clock}
            orders={neu}
            renderActions={(o) => (
              <>
                <BtnPrimary onClick={() => transition(o.id, 'start')}>
                  <Flame className="w-4 h-4" /> Starten
                </BtnPrimary>
                <BtnGhost onClick={() => setPickingUp(o)}>
                  <CheckCircle2 className="w-4 h-4" /> Direkt abgeholt
                </BtnGhost>
                <BtnLink onClick={() => setCancelling(o)}>Stornieren</BtnLink>
              </>
            )}
          />
          <StatusColumn
            title="In Küche"
            hint="gerade in Vorbereitung"
            tone="warning"
            Icon={Flame}
            orders={kitchen}
            renderActions={(o) => (
              <>
                <BtnPrimary onClick={() => transition(o.id, 'ready')}>
                  <PlayCircle className="w-4 h-4" /> Fertig
                </BtnPrimary>
                <BtnLink onClick={() => setCancelling(o)}>Stornieren</BtnLink>
              </>
            )}
            timestampLabel={(o) => o.startedAt && `seit ${fmtTime(o.startedAt)}${o.startedByName ? ` · ${o.startedByName}` : ''}`}
          />
          <StatusColumn
            title="Fertig"
            hint="wartet auf Abholung"
            tone="success"
            Icon={CheckCircle2}
            orders={ready}
            renderActions={(o) => (
              <BtnPrimary onClick={() => setPickingUp(o)}>
                <CheckCircle2 className="w-4 h-4" /> Abgeholt
              </BtnPrimary>
            )}
            timestampLabel={(o) => o.readyAt && `fertig seit ${fmtTime(o.readyAt)}`}
          />
        </div>
      )}

      {/* history: collapsed by default so the working columns stay uncluttered */}
      {past.length > 0 && (
        <section>
          <button onClick={() => setShowPast((s) => !s)}
                  className="text-xs font-semibold text-gray-500 hover:text-gray-700 flex items-center gap-1">
            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showPast ? 'rotate-90' : ''}`} />
            Verlauf ({past.length})
          </button>
          {showPast && (
            <div className="mt-2 bg-white rounded-xl shadow-sm divide-y divide-gray-100 overflow-hidden">
              {past.map((o) => <DoneRow key={o.id} order={o} />)}
            </div>
          )}
        </section>
      )}

      {pickingUp && (
        <PickupDialog order={pickingUp}
                      onClose={() => setPickingUp(null)}
                      onDone={() => { setPickingUp(null); reload() }} />
      )}
      {cancelling && (
        <ConfirmDialog
          title="Vorbestellung stornieren"
          message={`„${cancelling.quantity}× ${cancelling.productName}" für ${cancelling.participantName} stornieren?`}
          confirmLabel="Stornieren"
          tone="danger"
          onConfirm={() => doCancel(cancelling.id)}
          onClose={() => setCancelling(null)}
        />
      )}
    </div>
  )
}

function StatusColumn({ title, hint, tone, Icon, orders, renderActions, timestampLabel }) {
  const tones = {
    primary: { bar: 'bg-primary', ring: 'ring-primary/20', pill: 'bg-primary-soft text-primary' },
    warning: { bar: 'bg-warning', ring: 'ring-warning/20', pill: 'bg-warning-soft text-warning' },
    success: { bar: 'bg-success', ring: 'ring-success/20', pill: 'bg-success-soft text-success' },
  }[tone]
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${tones.pill}`}>
          <Icon className="w-3.5 h-3.5" /> {title}
        </span>
        <span className="text-xs text-gray-400">{hint}</span>
        <span className="ml-auto text-xs font-semibold text-gray-400">{orders.length}</span>
      </div>
      <div className="space-y-2">
        {orders.length === 0
          ? <div className="text-xs text-gray-300 border border-dashed border-gray-200 rounded-xl p-4 text-center">—</div>
          : orders.map((o) => (
              <div key={o.id} className={`bg-white rounded-xl shadow-sm p-3 space-y-2 ring-1 ${tones.ring}`}>
                <div className="flex items-start gap-2">
                  <div className={`w-1 self-stretch rounded-full ${tones.bar}`} />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {o.quantity}× {o.productName}
                    </div>
                    <div className="text-xs text-gray-600 truncate">{o.participantName}</div>
                    <div className="text-[11px] text-gray-400">
                      {timestampLabel?.(o) ?? `vorbestellt ${fmtTime(o.createdAt)}`}
                      {o.requestedFor && ` · für ${fmtTime(o.requestedFor)}`}
                    </div>
                    {o.note && <div className="text-xs text-gray-500 italic mt-0.5">„{o.note}"</div>}
                  </div>
                  <div className="font-semibold shrink-0">{fmt(o.totalAmount)}</div>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1 border-t border-gray-100">
                  {renderActions(o)}
                </div>
              </div>
            ))}
      </div>
    </div>
  )
}

function DoneRow({ order }) {
  const done = order.status === 'PICKED_UP'
  return (
    <div className="p-3 flex items-center gap-3 opacity-70">
      {done ? <CheckCircle2 className="w-5 h-5 text-success shrink-0" /> : <X className="w-5 h-5 text-gray-400 shrink-0" />}
      <div className="flex-1 min-w-0">
        <div className={`font-medium truncate ${done ? 'line-through decoration-gray-300' : ''}`}>
          {order.quantity}× {order.productName} <span className="text-gray-400 font-normal">·</span> <span className="text-gray-600">{order.participantName}</span>
        </div>
        <div className="text-xs text-gray-500 truncate">
          {done
            ? <>abgeholt {fmtTime(order.pickedUpAt)}{order.pickedUpByName ? ` · ${order.pickedUpByName}` : ''}</>
            : 'storniert'}
        </div>
      </div>
      <div className="font-semibold shrink-0">{fmt(order.totalAmount)}</div>
    </div>
  )
}

// Slim payment picker — same 3-method layout as the till and the Aktionen collect flow.
function PickupDialog({ order, onClose, onDone }) {
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
      if (given < total) {
        setError(`Es fehlen ${(total - given).toFixed(2)} € – bei Bar muss der Betrag voll bezahlt werden.`)
        setBusy(false); return
      }
      body = { cashGiven: given, useBalance: false, keepChangeAsCredit: false }
    }
    try { await api(`/api/preorders/${order.id}/pickup`, { method: 'POST', body }); onDone() }
    catch (e) { setError(e.message); setBusy(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl">
        <div className="flex items-center justify-between px-5 pt-4">
          <h2 className="font-bold">Abholen: {order.quantity}× {order.productName}</h2>
          <button onClick={onClose} className="text-gray-400"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3">{error}</div>}

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
            <input inputMode="decimal" value={cash} onChange={(e) => setCash(e.target.value)}
                   placeholder={`Betrag (mind. ${total.toFixed(2)})`}
                   autoFocus className="w-full border rounded-lg px-3 py-3 text-lg" />
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 border rounded-lg py-3">Abbrechen</button>
            <button onClick={submit} disabled={busy}
                    className="flex-1 bg-primary text-white rounded-lg py-3 font-semibold disabled:opacity-40">
              Abholung bestätigen
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function MethodButton({ active, onClick, children }) {
  return (
    <button onClick={onClick}
            className={`rounded-lg py-2.5 text-sm font-semibold border ${
              active ? 'border-primary bg-primary text-white' : 'border-gray-200 hover:bg-gray-50'
            }`}>
      {children}
    </button>
  )
}

// Small action-button flavours - keep the kitchen cards readable
function BtnPrimary({ onClick, children }) {
  return (
    <button onClick={onClick}
            className="flex-1 bg-primary text-white rounded-lg px-3 py-1.5 text-sm font-semibold flex items-center justify-center gap-1">
      {children}
    </button>
  )
}
function BtnGhost({ onClick, children }) {
  return (
    <button onClick={onClick}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-gray-50 flex items-center justify-center gap-1">
      {children}
    </button>
  )
}
function BtnLink({ onClick, children }) {
  return <button onClick={onClick} className="text-xs text-gray-400 hover:text-accent">{children}</button>
}

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })
}
