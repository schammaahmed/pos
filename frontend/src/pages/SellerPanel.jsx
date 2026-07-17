import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { fmt, fromCents, previewSplit, toCents } from '../money'

// The heart of the POS. Flow: pick participant (or anonymous) -> tap products into
// the cart -> "Zur Kasse" -> review basket + choose how it's paid -> confirm.
export default function SellerPanel() {
  const [products, setProducts] = useState([])
  const [participant, setParticipant] = useState(null) // null = anonymous cash sale
  const [cart, setCart] = useState({}) // productId -> quantity
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [lastSale, setLastSale] = useState(null) // success screen data
  const [error, setError] = useState(null)

  useEffect(() => {
    api('/api/products').then(setProducts).catch((e) => setError(e.message))
  }, [])

  // Multi-device sync via polling: every 10s the product list and the selected participant's
  // balance are re-fetched, so a sale on ANOTHER phone shows up here too. The server-side
  // optimistic lock is the real safety net - polling just keeps the display fresh.
  useEffect(() => {
    const interval = setInterval(() => {
      api('/api/products').then(setProducts).catch(() => {})
      if (participant) {
        api(`/api/participants/${participant.id}`).then(setParticipant).catch(() => {})
      }
    }, 10_000)
    return () => clearInterval(interval) // stop polling when the page unmounts
  }, [participant])

  const cartEntries = useMemo(
    () =>
      Object.entries(cart)
        .map(([id, qty]) => ({ product: products.find((p) => p.id === Number(id)), qty }))
        .filter((e) => e.product),
    [cart, products],
  )
  const totalCents = cartEntries.reduce((sum, e) => sum + toCents(e.product.price) * e.qty, 0)
  const itemCount = cartEntries.reduce((sum, e) => sum + e.qty, 0)

  function addToCart(product) {
    setCart((c) => ({ ...c, [product.id]: (c[product.id] || 0) + 1 }))
  }

  function changeQty(productId, delta) {
    setCart((c) => {
      const next = { ...c, [productId]: (c[productId] || 0) + delta }
      if (next[productId] <= 0) delete next[productId] // removing the last one deletes the line
      return next
    })
  }

  async function refreshParticipant() {
    if (!participant) return
    try {
      setParticipant(await api(`/api/participants/${participant.id}`))
    } catch {
      /* keep the stale one, next refresh will fix it */
    }
  }

  function handleSold(sale) {
    setLastSale(sale)
    setCart({})
    setCheckoutOpen(false)
    refreshParticipant()
  }

  // success screen replaces everything until "Weiter" - the seller needs ONE clear
  // number in that moment: how much change to hand back
  if (lastSale) {
    return <SuccessView sale={lastSale} onDone={() => setLastSale(null)} />
  }

  return (
    <div className="space-y-4">
      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3">{error}</div>}

      <ParticipantPicker participant={participant} onSelect={setParticipant} />

      <ProductGrid products={products} cart={cart} onAdd={addToCart} />

      {/* sticky cart bar above the bottom nav - always one tap from checkout */}
      {itemCount > 0 && (
        <button
          onClick={() => setCheckoutOpen(true)}
          className="fixed bottom-16 inset-x-4 max-w-3xl mx-auto bg-blue-600 text-white rounded-xl py-4 font-semibold shadow-lg z-20"
        >
          🛒 {itemCount} Artikel · {fmt(fromCents(totalCents))} · Zur Kasse
        </button>
      )}

      {checkoutOpen && (
        <CheckoutSheet
          cartEntries={cartEntries}
          totalCents={totalCents}
          participant={participant}
          onChangeQty={changeQty}
          onClose={() => setCheckoutOpen(false)}
          onSold={handleSold}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------- participant search
function ParticipantPicker({ participant, onSelect }) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])

  // fetch matches while typing, with a 250ms pause so we don't fire a request per keystroke
  useEffect(() => {
    if (search.trim().length < 2) {
      setResults([])
      return
    }
    const timer = setTimeout(() => {
      api(`/api/participants?search=${encodeURIComponent(search.trim())}`)
        .then(setResults)
        .catch(() => setResults([]))
    }, 250)
    return () => clearTimeout(timer) // typing again cancels the previous timer
  }, [search])

  if (participant) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-4 flex items-center justify-between">
        <div>
          <div className="font-semibold">
            {participant.firstName} {participant.lastName}
          </div>
          <div className={`text-sm ${participant.inDebt ? 'text-red-600' : 'text-green-700'}`}>
            Guthaben: {fmt(participant.balance)}
          </div>
        </div>
        <button onClick={() => onSelect(null)} className="text-sm text-gray-500 border rounded-lg px-3 py-2">
          Wechseln
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 space-y-2">
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍 Teilnehmer suchen… (leer = Barverkauf)"
        className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base"
      />
      {results.map((p) => (
        <button
          key={p.id}
          onClick={() => {
            onSelect(p)
            setSearch('')
          }}
          className="w-full flex justify-between items-center p-3 rounded-lg bg-gray-50 active:bg-gray-200"
        >
          <span>
            {p.firstName} {p.lastName}
          </span>
          <span className={p.inDebt ? 'text-red-600' : 'text-green-700'}>{fmt(p.balance)}</span>
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------- product grid
function ProductGrid({ products, cart, onAdd }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
      {products.map((p) => (
        <button
          key={p.id}
          onClick={() => onAdd(p)}
          className="relative bg-white rounded-xl shadow-sm p-2 flex flex-col items-center active:scale-95 transition-transform"
        >
          {cart[p.id] > 0 && (
            <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold">
              {cart[p.id]}
            </span>
          )}
          {p.imageUrl ? (
            <img src={p.imageUrl} alt={p.name} className="w-full aspect-square object-cover rounded-lg" />
          ) : (
            <div className="w-full aspect-square rounded-lg bg-gray-100 flex items-center justify-center text-3xl">
              🛍️
            </div>
          )}
          <div className="text-sm font-medium mt-1 text-center leading-tight">{p.name}</div>
          <div className="text-sm text-gray-500">{fmt(p.price)}</div>
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------- checkout
function CheckoutSheet({ cartEntries, totalCents, participant, onChangeQty, onClose, onSold }) {
  const [cashInput, setCashInput] = useState('') // what the buyer hands over, as typed
  const [useBalance, setUseBalance] = useState(!!participant) // default: pay from balance if there is an account
  const [keepChange, setKeepChange] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const cashCents = toCents(cashInput === '' ? 0 : cashInput.replace(',', '.'))
  const balanceCents = participant ? toCents(participant.balance) : 0

  // live preview - the seller SEES debt/credit/change before confirming (the "final check")
  const split = previewSplit({
    totalCents,
    cashCents,
    balanceCents,
    useBalance,
    keepChangeAsCredit: keepChange,
  })

  const anonymousUnderpaid = !participant && split.debt > 0

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      const sale = await api('/api/sales', {
        method: 'POST',
        body: {
          participantId: participant?.id ?? null,
          items: cartEntries.map((e) => ({ productId: e.product.id, quantity: e.qty })),
          cashGiven: fromCents(cashCents),
          useBalance,
          keepChangeAsCredit: keepChange,
        },
      })
      onSold(sale)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    // full-screen sheet over everything - checkout deserves full attention
    <div className="fixed inset-0 bg-white z-30 overflow-y-auto">
      <div className="max-w-3xl mx-auto p-4 space-y-4 pb-32">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Kasse</h2>
          <button onClick={onClose} className="text-gray-500 border rounded-lg px-3 py-2">
            ← Zurück
          </button>
        </div>

        <div className="text-sm text-gray-600">
          {participant
            ? `Verkauf an ${participant.firstName} ${participant.lastName} · Guthaben ${fmt(participant.balance)}`
            : 'Barverkauf (ohne Teilnehmer)'}
        </div>

        {/* basket lines with +/- : the "final check with overview" from the requirements */}
        <div className="bg-gray-50 rounded-xl divide-y">
          {cartEntries.map((e) => (
            <div key={e.product.id} className="flex items-center gap-3 p-3">
              <div className="flex-1">
                <div className="font-medium">{e.product.name}</div>
                <div className="text-sm text-gray-500">{fmt(e.product.price)}</div>
              </div>
              <button onClick={() => onChangeQty(e.product.id, -1)} className="w-9 h-9 rounded-lg bg-gray-200 font-bold">
                −
              </button>
              <span className="w-6 text-center font-semibold">{e.qty}</span>
              <button onClick={() => onChangeQty(e.product.id, 1)} className="w-9 h-9 rounded-lg bg-gray-200 font-bold">
                +
              </button>
            </div>
          ))}
          <div className="flex justify-between p-3 font-bold">
            <span>Summe</span>
            <span>{fmt(fromCents(totalCents))}</span>
          </div>
        </div>

        {/* payment */}
        <div className="space-y-3">
          <label className="block">
            <span className="text-sm font-medium">Bar erhalten</span>
            <input
              inputMode="decimal"
              placeholder="0,00"
              value={cashInput}
              onChange={(e) => setCashInput(e.target.value)}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-3 text-lg"
            />
          </label>
          <div className="flex gap-2">
            {[5, 10, 20].map((bill) => (
              <button
                key={bill}
                onClick={() => setCashInput(String(bill))}
                className="flex-1 border rounded-lg py-2 text-sm bg-gray-50"
              >
                {bill} €
              </button>
            ))}
            <button onClick={() => setCashInput('')} className="flex-1 border rounded-lg py-2 text-sm bg-gray-50">
              0 €
            </button>
          </div>

          {participant && (
            <>
              <label className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                <input type="checkbox" checked={useBalance} onChange={(e) => setUseBalance(e.target.checked)} className="w-5 h-5" />
                <span>Guthaben verwenden ({fmt(participant.balance)})</span>
              </label>
              {split.changeToReturn > 0 || keepChange ? (
                <label className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                  <input type="checkbox" checked={keepChange} onChange={(e) => setKeepChange(e.target.checked)} className="w-5 h-5" />
                  <span>Rest als Guthaben behalten („stimmt so“)</span>
                </label>
              ) : null}
            </>
          )}
        </div>

        {/* live preview of what confirming will do */}
        <div className="bg-blue-50 rounded-xl p-4 text-sm space-y-1">
          {split.paidCash > 0 && <Row label="Bar bezahlt" value={fmt(fromCents(split.paidCash))} />}
          {split.paidFromBalance > 0 && <Row label="Vom Guthaben" value={fmt(fromCents(split.paidFromBalance))} />}
          {split.debt > 0 && <Row label="Auf Schulden" value={fmt(fromCents(split.debt))} red />}
          {split.extraCredited > 0 && <Row label="Als Guthaben gutgeschrieben" value={fmt(fromCents(split.extraCredited))} />}
          {split.changeToReturn > 0 && (
            <Row label="Wechselgeld zurückgeben" value={fmt(fromCents(split.changeToReturn))} bold />
          )}
          {participant && (
            <Row
              label="Guthaben danach"
              value={fmt(fromCents(balanceCents - split.paidFromBalance - split.debt + split.extraCredited))}
              bold
            />
          )}
        </div>

        {anonymousUnderpaid && (
          <div className="bg-yellow-50 text-yellow-800 text-sm rounded-lg p-3">
            Barverkauf: Der Betrag muss voll in bar bezahlt werden.
          </div>
        )}
        {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3">{error}</div>}
      </div>

      <div className="fixed bottom-0 inset-x-0 bg-white border-t p-4">
        <button
          onClick={confirm}
          disabled={busy || cartEntries.length === 0 || anonymousUnderpaid}
          className="w-full max-w-3xl mx-auto block bg-green-600 text-white rounded-xl py-4 font-semibold text-lg disabled:opacity-40"
        >
          {busy ? 'Wird gebucht…' : `Verkauf bestätigen · ${fmt(fromCents(totalCents))}`}
        </button>
      </div>
    </div>
  )
}

function Row({ label, value, red, bold }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-bold' : ''} ${red ? 'text-red-600' : ''}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

// ---------------------------------------------------------------- after the sale
function SuccessView({ sale, onDone }) {
  return (
    <div className="bg-white rounded-2xl shadow p-6 text-center space-y-4 mt-8">
      <div className="text-5xl">✅</div>
      <h2 className="text-xl font-bold">Verkauf gebucht</h2>
      <div className="text-gray-600">
        {sale.items.map((i) => `${i.quantity}× ${i.productName}`).join(', ')} · {fmt(sale.totalAmount)}
      </div>

      {Number(sale.changeToReturn) > 0 && (
        <div className="bg-yellow-50 rounded-xl p-4 text-lg">
          Wechselgeld: <span className="font-bold">{fmt(sale.changeToReturn)}</span>
        </div>
      )}
      {sale.newBalance !== null && (
        <div className={`text-lg ${Number(sale.newBalance) < 0 ? 'text-red-600' : 'text-green-700'}`}>
          Neues Guthaben: <span className="font-bold">{fmt(sale.newBalance)}</span>
        </div>
      )}

      <button onClick={onDone} className="w-full bg-blue-600 text-white rounded-xl py-4 font-semibold">
        Weiter verkaufen
      </button>
    </div>
  )
}
