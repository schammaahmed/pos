import { useEffect, useState } from 'react'
import { CheckCircle2, Clock, PackageOpen, X } from 'lucide-react'
import { api } from '../api'
import { fmt } from '../money'
import { EmptyState, SectionHeader } from '../components/ui'
import { ConfirmDialog } from '../components/Dialog'

// Staff-facing view of self-serve pre-orders coming in from the QR flow. One row per
// order; sellers pick them up (with a payment sheet like the till) or cancel them.
export default function PreOrders() {
  const [orders, setOrders] = useState([])
  const [error, setError] = useState(null)
  const [pickingUp, setPickingUp] = useState(null)
  const [cancelling, setCancelling] = useState(null)

  async function reload() {
    try { setOrders(await api('/api/preorders')) } catch (e) { setError(e.message) }
  }

  useEffect(() => {
    reload()
    // light polling so a fresh self-serve order shows up without a manual refresh
    const t = setInterval(reload, 8000)
    return () => clearInterval(t)
  }, [])

  async function doCancel(id) {
    try { await api(`/api/preorders/${id}/cancel`, { method: 'POST' }); setCancelling(null); reload() }
    catch (e) { setError(e.message) }
  }

  const open = orders.filter((o) => o.status === 'NEW')
  const done = orders.filter((o) => o.status !== 'NEW')

  return (
    <div className="space-y-4">
      <SectionHeader title="Vorbestellungen" hint="Selbstbedienung vom QR-Code" />

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3">{error}</div>}

      {orders.length === 0 && !error && (
        <EmptyState icon={PackageOpen}>Noch keine Vorbestellungen. Sobald jemand den QR-Code scannt, landen die Bestellungen hier.</EmptyState>
      )}

      {open.length > 0 && (
        <section>
          <div className="text-xs font-semibold text-gray-500 mb-1">
            {open.length} offen{open.length > 1 ? 'e' : ''}
          </div>
          <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100 overflow-hidden">
            {open.map((o) => (
              <OpenRow key={o.id} order={o}
                       onPickup={() => setPickingUp(o)}
                       onCancel={() => setCancelling(o)} />
            ))}
          </div>
        </section>
      )}

      {done.length > 0 && (
        <section>
          <div className="text-xs font-semibold text-gray-500 mb-1">Verlauf</div>
          <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100 overflow-hidden">
            {done.map((o) => <DoneRow key={o.id} order={o} />)}
          </div>
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

function OpenRow({ order, onPickup, onCancel }) {
  return (
    <div className="p-3 flex items-center gap-3">
      <Clock className="w-5 h-5 text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">
          {order.quantity}× {order.productName}
          <span className="text-gray-400 font-normal"> · </span>
          <span className="text-gray-600">{order.participantName}</span>
        </div>
        <div className="text-xs text-gray-500 truncate">
          vorbestellt {fmtTs(order.createdAt)}
          {order.requestedFor && ` · für ${fmtTs(order.requestedFor)}`}
        </div>
        {order.note && <div className="text-xs text-gray-400 italic">„{order.note}"</div>}
      </div>
      <div className="text-right shrink-0">
        <div className="font-semibold">{fmt(order.totalAmount)}</div>
      </div>
      <div className="flex flex-col gap-1 shrink-0">
        <button onClick={onPickup}
                className="bg-primary text-white rounded-lg px-3 py-1.5 text-sm font-semibold flex items-center gap-1">
          <CheckCircle2 className="w-4 h-4" /> Abgeholt
        </button>
        <button onClick={onCancel} className="text-xs text-gray-400 hover:text-accent">Stornieren</button>
      </div>
    </div>
  )
}

function DoneRow({ order }) {
  const done = order.status === 'PICKED_UP'
  return (
    <div className={`p-3 flex items-center gap-3 opacity-60 ${done ? '' : ''}`}>
      {done ? <CheckCircle2 className="w-5 h-5 text-success shrink-0" /> : <X className="w-5 h-5 text-gray-400 shrink-0" />}
      <div className="flex-1 min-w-0">
        <div className={`font-medium truncate ${done ? 'line-through decoration-gray-300' : ''}`}>
          {order.quantity}× {order.productName} <span className="text-gray-400 font-normal">·</span> <span className="text-gray-600">{order.participantName}</span>
        </div>
        <div className="text-xs text-gray-500 truncate">
          {done
            ? <>abgeholt {fmtTs(order.pickedUpAt)}{order.pickedUpByName ? ` · ${order.pickedUpByName}` : ''}</>
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

function fmtTs(ts) {
  return new Date(ts).toLocaleString('de-AT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}
