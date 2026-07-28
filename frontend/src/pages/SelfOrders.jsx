import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Clock, Flame, PackageOpen, X } from 'lucide-react'
import { selfApi, loadSelf } from '../selfApi'
import { fmt } from '../money'
import { SelfShell } from './Self'

// The participant's own orders. Live via Server-Sent Events: the server pushes a
// "preorder" event whenever one of the participant's orders transitions, so status
// flips (fertig, abgeholt, …) show up sub-second. EventSource auto-reconnects on
// blip. Falls back to a slow poll if SSE isn't available (older browsers / proxies).
export default function SelfOrders() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [error, setError] = useState(null)
  const [cancelling, setCancelling] = useState(null)
  // Remembers which order IDs were already READY so the browser Notification only
  // fires on the actual NEW→READY / IN_PROGRESS→READY transition, not on every refresh.
  const readySeen = useRef(new Set())

  async function reload() {
    try { setOrders(await selfApi('/api/self/preorders')) }
    catch (e) { setError(e.message) }
  }

  useEffect(() => {
    const self = loadSelf()
    if (!self?.token) { navigate('/self', { replace: true }); return }
    // seed the state so a page refresh doesn't re-fire notifications for orders
    // that were already ready when we loaded
    reload().then(() => {})

    // EventSource can't send Authorization headers, so the JWT rides in as a query
    // param that JwtAuthFilter accepts as a fallback for this endpoint.
    const es = new EventSource(`/api/self/preorders/stream?access_token=${encodeURIComponent(self.token)}`)
    es.addEventListener('preorder', (evt) => {
      let pushed
      try { pushed = JSON.parse(evt.data) } catch { return }
      if (pushed.status === 'READY' && !readySeen.current.has(pushed.id)) {
        readySeen.current.add(pushed.id)
        notifyReady(pushed)
      }
      reload()
    })
    es.onerror = () => { /* browser retries automatically; ignore */ }

    // Belt-and-braces fallback poll in case SSE gets held up by a proxy - runs every
    // 30 s (much less than the old 5 s) so it stays cheap when SSE is working.
    const poll = setInterval(reload, 30000)

    return () => { es.close(); clearInterval(poll) }
  }, [navigate])

  async function doCancel(id) {
    try { await selfApi(`/api/self/preorders/${id}/cancel`, { method: 'POST' }); setCancelling(null); reload() }
    catch (e) { setError(e.message) }
  }

  // active = anything that hasn't reached a terminal state yet, so the participant sees
  // their whole in-flight pipeline (Wartet → In Vorbereitung → Fertig) not just NEW
  const ACTIVE = new Set(['NEW', 'IN_PROGRESS', 'READY'])
  const active = orders.filter((o) => ACTIVE.has(o.status))
  const past = orders.filter((o) => !ACTIVE.has(o.status))

  return (
    <SelfShell>
      <Link to="/self/menu" className="text-sm text-primary flex items-center gap-1 mb-3">
        <ArrowLeft className="w-4 h-4" /> Zum Menü
      </Link>

      <h1 className="text-xl font-bold mb-3">Meine Bestellungen</h1>

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3 mb-3">{error}</div>}

      {orders.length === 0 && (
        <div className="text-center text-gray-500 py-10">
          <PackageOpen className="w-10 h-10 mx-auto text-gray-300 mb-2" />
          Noch nichts vorbestellt.
        </div>
      )}

      {active.length > 0 && (
        <section className="space-y-2 mb-6">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Offen</div>
          {active.map((o) => (
            <OrderCard key={o.id} order={o} onCancel={() => setCancelling(o)} />
          ))}
        </section>
      )}

      {past.length > 0 && (
        <section className="space-y-2">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Verlauf</div>
          {past.map((o) => <OrderCard key={o.id} order={o} />)}
        </section>
      )}

      {cancelling && (
        <ConfirmSheet
          message={`Vorbestellung „${cancelling.quantity}× ${cancelling.productName}" stornieren?`}
          onConfirm={() => doCancel(cancelling.id)}
          onClose={() => setCancelling(null)}
        />
      )}
    </SelfShell>
  )
}

function OrderCard({ order, onCancel }) {
  const done = order.status === 'PICKED_UP'
  const cancelled = order.status === 'CANCELLED'
  const ready = order.status === 'READY'
  // once the kitchen has said Fertig, cancelling from a phone would waste food -
  // the backend refuses it too; hide the button so nothing looks half-broken
  const canCancel = onCancel && !done && !cancelled && !ready

  return (
    <div className={`rounded-xl shadow-sm p-3 ${done || cancelled ? 'bg-white opacity-70' : ready ? 'bg-success-soft ring-1 ring-success/30' : 'bg-white'}`}>
      <div className="flex items-center gap-3">
        <StatusIcon status={order.status} />
        <div className="flex-1 min-w-0">
          <div className={`font-medium truncate ${cancelled ? 'line-through' : ''}`}>
            {order.quantity}× {order.productName}
          </div>
          {order.optionsLabel && <div className="text-xs text-primary">{order.optionsLabel}</div>}
          <div className="text-xs text-gray-500 truncate">
            {done && <>abgeholt {fmtTs(order.pickedUpAt)}{order.pickedUpByName ? ` · ${order.pickedUpByName}` : ''}</>}
            {!done && cancelled && 'storniert'}
            {!done && !cancelled && ready && <span className="text-success font-semibold">Fertig zur Abholung!</span>}
            {!done && !cancelled && order.status === 'IN_PROGRESS' && <>in Vorbereitung seit {fmtTs(order.startedAt)}</>}
            {!done && !cancelled && order.status === 'NEW' && <>vorbestellt {fmtTs(order.createdAt)}{order.requestedFor ? ` · für ${fmtTs(order.requestedFor)}` : ''}</>}
          </div>
          {order.note && <div className="text-xs text-gray-400 italic mt-0.5">„{order.note}"</div>}
        </div>
        <div className="text-right shrink-0">
          <div className="font-semibold">{fmt(order.totalAmount)}</div>
          {done && Number(order.debtAmount) > 0 && (
            <div className="text-[11px] text-accent">
              davon {fmt(order.debtAmount)} auf Schulden
            </div>
          )}
        </div>
      </div>
      {canCancel && (
        <div className="mt-2 pt-2 border-t border-gray-100 text-right">
          <button onClick={onCancel} className="text-xs text-gray-400 hover:text-accent">Stornieren</button>
        </div>
      )}
    </div>
  )
}

function StatusIcon({ status }) {
  if (status === 'PICKED_UP') return <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
  if (status === 'CANCELLED') return <X className="w-5 h-5 text-gray-400 shrink-0" />
  if (status === 'READY') return <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
  if (status === 'IN_PROGRESS') return <Flame className="w-5 h-5 text-warning shrink-0" />
  return <Clock className="w-5 h-5 text-primary shrink-0" />
}

function ConfirmSheet({ message, onConfirm, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 space-y-4 shadow-xl">
        <p>{message}</p>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 border rounded-lg py-3">Nein</button>
          <button onClick={onConfirm} className="flex-1 bg-accent text-white rounded-lg py-3 font-semibold">Stornieren</button>
        </div>
      </div>
    </div>
  )
}

function fmtTs(ts) {
  return new Date(ts).toLocaleString('de-AT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// Fire a browser notification when an order becomes READY. If permission hasn't been
// granted yet, request it - the READY event itself is a user-relevant moment so the
// browser is fine with prompting here (and it's a no-op if the browser doesn't
// support the API or the user denied). Falls back to nothing visible; the on-page
// green highlight already tells the kid it's ready when the tab is open.
function notifyReady(order) {
  if (typeof Notification === 'undefined') return
  const title = 'Bestellung fertig!'
  const body = `${order.quantity}× ${order.productName} kann abgeholt werden.`
  const show = () => { try { new Notification(title, { body, tag: `preorder-${order.id}` }) } catch { /* ignore */ } }
  if (Notification.permission === 'granted') { show(); return }
  if (Notification.permission !== 'denied') {
    Notification.requestPermission().then((p) => { if (p === 'granted') show() })
  }
}
