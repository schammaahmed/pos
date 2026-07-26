import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, ClipboardList, Package, Plus } from 'lucide-react'
import { selfApi, loadSelf } from '../selfApi'
import { fmt } from '../money'
import { groupByCategory } from '../products'
import { SelfShell } from './Self'

// The menu the participant sees after identifying. Grouped by category, one card per
// product; tap opens a small pre-order sheet.
export default function SelfMenu() {
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [me, setMe] = useState(null)
  const [ordering, setOrdering] = useState(null) // product being ordered
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!loadSelf()?.token) { navigate('/self', { replace: true }); return }
    Promise.all([selfApi('/api/self/me'), selfApi('/api/self/products')])
      .then(([m, p]) => { setMe(m); setProducts(p) })
      .catch((e) => setError(e.message))
  }, [navigate])

  const byCategory = groupByCategory(products)

  return (
    <SelfShell>
      {me && (
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-gray-400">Guthaben</div>
            <div className="text-xl font-bold text-primary">{fmt(me.balance)}</div>
          </div>
          <Link to="/self/orders"
                className="text-sm text-primary font-semibold flex items-center gap-1 hover:gap-2 transition-[gap]">
            <ClipboardList className="w-4 h-4" /> Meine Bestellungen <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {error && <ErrorCard message={error} />}

      {products.length === 0 && !error && (
        <div className="text-center text-gray-500 py-10">
          <Package className="w-10 h-10 mx-auto text-gray-300 mb-2" />
          Noch keine Produkte im Angebot.
        </div>
      )}

      {byCategory.map(([category, list]) => (
        <section key={category ?? '_'} className="mb-4">
          {category && (
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mb-1">{category}</div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {list.map((p) => (
              <button key={p.id} onClick={() => setOrdering(p)}
                      className="bg-white rounded-xl shadow-sm p-4 text-left hover:shadow-md active:scale-[0.98] transition">
                <div className="font-medium truncate">{p.name}</div>
                <div className="text-primary font-bold mt-1">{fmt(p.price)}</div>
                <div className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> Vorbestellen
                </div>
              </button>
            ))}
          </div>
        </section>
      ))}

      {ordering && (
        <PlaceDialog product={ordering}
                     onClose={() => setOrdering(null)}
                     onDone={() => { setOrdering(null); navigate('/self/orders') }} />
      )}
    </SelfShell>
  )
}

function PlaceDialog({ product, onClose, onDone }) {
  const [quantity, setQuantity] = useState(1)
  const [requestedFor, setRequestedFor] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function submit() {
    setBusy(true); setError(null)
    try {
      await selfApi('/api/self/preorders', {
        method: 'POST',
        body: {
          productId: product.id,
          quantity: Number(quantity),
          requestedFor: requestedFor ? requestedFor + ':00' : null,
          note: note.trim() || null,
        },
      })
      onDone()
    } catch (e) { setError(e.message); setBusy(false) }
  }

  const total = Number(product.price) * quantity

  return (
    <div className="fixed inset-0 bg-black/50 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl">
        <div className="px-5 pt-4 pb-2">
          <h2 className="font-bold text-lg">{product.name}</h2>
          <div className="text-primary font-bold">{fmt(product.price)} pro Stück</div>
        </div>

        <div className="p-5 pt-2 space-y-4">
          {error && <ErrorCard message={error} />}

          <label className="block">
            <span className="block text-sm text-gray-600 mb-1">Menge</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="border rounded-lg w-11 h-11 text-lg">−</button>
              <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                     className="flex-1 border rounded-lg px-3 py-3 text-center text-lg font-semibold" />
              <button type="button" onClick={() => setQuantity((q) => q + 1)} className="border rounded-lg w-11 h-11 text-lg">+</button>
            </div>
          </label>

          <label className="block">
            <span className="block text-sm text-gray-600 mb-1">Wann willst du es abholen? (optional)</span>
            <input type="datetime-local" value={requestedFor} onChange={(e) => setRequestedFor(e.target.value)}
                   className="w-full border rounded-lg px-3 py-3" />
          </label>

          <label className="block">
            <span className="block text-sm text-gray-600 mb-1">Notiz (optional)</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300}
                   placeholder="z.B. ohne Zwiebel" className="w-full border rounded-lg px-3 py-3" />
          </label>

          <div className="flex justify-between text-sm bg-gray-50 rounded-lg p-3">
            <span className="text-gray-500">Zu zahlen bei Abholung</span>
            <span className="font-bold">{fmt(total)}</span>
          </div>

          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 border rounded-lg py-3">Abbrechen</button>
            <button onClick={submit} disabled={busy}
                    className="flex-1 bg-primary text-white rounded-lg py-3 font-semibold disabled:opacity-40">
              Vorbestellen
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ErrorCard({ message }) {
  return <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3">{message}</div>
}
