import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { fmt, fromCents, toCents } from '../money'
import ParticipantPickerSheet, { rememberRecentParticipant } from '../components/ParticipantPickerSheet'

// The heart of the POS. Flow: pick participant (or anonymous) -> tap products into
// the cart -> "Zur Kasse" -> review basket + choose how it's paid -> confirm.
export default function SellerPanel() {
  const [products, setProducts] = useState([])
  const [participant, setParticipant] = useState(null) // null = anonymous cash sale
  const [cart, setCart] = useState({}) // productId -> quantity
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false) // the full-screen participant picker
  const [lastSale, setLastSale] = useState(null) // success screen data
  const [categoryFilter, setCategoryFilter] = useState(null) // null = all categories
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
    if (participant) rememberRecentParticipant(participant.id) // feeds the "Zuletzt" row
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

      <ParticipantBar participant={participant} onOpenPicker={() => setPickerOpen(true)} onClear={() => setParticipant(null)} />

      <CategoryTabs products={products} active={categoryFilter} onChange={setCategoryFilter} />

      <ProductGrid
        products={categoryFilter ? products.filter((p) => p.category === categoryFilter) : products}
        cart={cart}
        onAdd={addToCart}
      />

      {/* sticky cart bar above the bottom nav - always one tap from checkout */}
      {itemCount > 0 && (
        <button
          onClick={() => setCheckoutOpen(true)}
          className="fixed bottom-16 inset-x-4 max-w-3xl mx-auto bg-primary text-white rounded-xl py-4 font-semibold shadow-lg z-20"
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
          onPickParticipant={() => setPickerOpen(true)} // choose/change the person from INSIDE the Kasse
          onClose={() => setCheckoutOpen(false)}
          onSold={handleSold}
        />
      )}

      {/* z-40: the picker opens ABOVE the checkout sheet when called from there */}
      {pickerOpen && (
        <ParticipantPickerSheet
          onSelect={(p) => {
            setParticipant(p)
            setPickerOpen(false)
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------- participant bar
// Slim bar showing who the sale is for. The actual choosing happens in the
// full-screen ParticipantPickerSheet (A-Z list / grid / M-W filter / Zuletzt).
function ParticipantBar({ participant, onOpenPicker, onClear }) {
  if (participant) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-4 flex items-center justify-between">
        <button onClick={onOpenPicker} className="text-left">
          <div className="font-semibold">
            {participant.firstName} {participant.lastName}
          </div>
          <div className={`text-sm ${participant.inDebt ? 'text-accent' : 'text-primary'}`}>
            {participant.inDebt
              ? `Offene Schulden: ${fmt(Math.abs(Number(participant.balance)))}`
              : `Guthaben: ${fmt(participant.balance)}`}
          </div>
        </button>
        <button onClick={onClear} className="text-sm text-gray-500 border rounded-lg px-3 py-2">
          ✕ Barverkauf
        </button>
      </div>
    )
  }

  return (
    <button onClick={onOpenPicker}
            className="w-full bg-white rounded-xl shadow-sm p-4 flex items-center justify-between text-gray-600">
      <span>👥 Teilnehmer wählen…</span>
      <span className="text-sm text-gray-400">ohne = Barverkauf</span>
    </button>
  )
}

// ---------------------------------------------------------------- category tabs
function CategoryTabs({ products, active, onChange }) {
  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))]
  if (categories.length < 2) return null // one or no category -> tabs are just noise

  const tabClass = (isActive) =>
    `whitespace-nowrap rounded-full px-4 py-2 text-sm border ${
      isActive ? 'bg-primary text-white border-primary' : 'bg-white border-gray-300'
    }`

  return (
    // horizontal scroll instead of wrapping - keeps the grid high on small screens
    <div className="flex gap-2 overflow-x-auto pb-1">
      <button onClick={() => onChange(null)} className={tabClass(active === null)}>Alle</button>
      {categories.map((c) => (
        <button key={c} onClick={() => onChange(c)} className={tabClass(active === c)}>{c}</button>
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
            <span className="absolute -top-2 -right-2 bg-primary text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold">
              {cart[p.id]}
            </span>
          )}
          {p.imageUrl ? (
            <img src={p.imageUrl} alt={p.name} className="w-full aspect-square object-cover rounded-lg" />
          ) : (
            <div className="w-full aspect-square rounded-lg bg-page flex items-center justify-center text-3xl">
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
function CheckoutSheet({ cartEntries, totalCents, participant, onChangeQty, onPickParticipant, onClose, onSold }) {
  const [cashInput, setCashInput] = useState('') // what the buyer hands over, as typed
  // The seller must ACTIVELY choose one method - no default. Each method is a single, clear
  // intent, so cash and balance can never silently fight each other (the old bug).
  const [method, setMethod] = useState(null) // null (not chosen yet) | 'cash' | 'balance' | 'debt'
  const [payExtra, setPayExtra] = useState(false) // "stimmt so" -> overpaid cash becomes credit (cash mode only)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const balanceCents = participant ? toCents(participant.balance) : 0

  // Guthaben and Schulden need a named account. If the participant is removed while one of
  // those is selected, drop back to "nothing chosen" so the seller has to decide again.
  useEffect(() => {
    if (!participant) {
      setMethod((m) => (m === 'balance' || m === 'debt' ? null : m))
      setPayExtra(false)
    }
  }, [participant?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const cashCents = method === 'cash' ? toCents(cashInput === '' ? 0 : cashInput.replace(',', '.')) : 0
  const overpaidCents = Math.max(cashCents - totalCents, 0)

  // What (if anything) blocks the sale. Each is surfaced as its own prompt below.
  const needsParticipant = (method === 'balance' || method === 'debt') && !participant // debt/credit need a person
  const balanceShort = method === 'balance' && participant && balanceCents < totalCents  // Guthaben must fully cover
  const cashShort = method === 'cash' && cashCents < totalCents                          // Bar must fully cover (never auto-debt)
  const canConfirm = !!method && !needsParticipant && !balanceShort && !cashShort && cartEntries.length > 0 && !busy

  // the three values sent to the backend, derived from the single chosen method
  const useBalance = method === 'balance'
  const keepChangeAsCredit = method === 'cash' && payExtra && !!participant

  // tapping the already-active method clears it again (back to "nothing chosen")
  function chooseMethod(next) {
    setMethod((current) => (current === next ? null : next))
    setPayExtra(false) // "stimmt so" belongs to one specific cash entry, never carry it over
  }

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
          keepChangeAsCredit,
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

        {/* who is buying - tappable, so the person can be assigned as the LAST step too */}
        <button onClick={onPickParticipant}
                className="w-full bg-gray-50 rounded-xl p-3 flex items-center justify-between text-left">
          <span className="text-sm text-gray-700">
            {participant
              ? <>
                  Verkauf an <span className="font-semibold">{participant.firstName} {participant.lastName}</span>
                  {participant.inDebt
                    ? <> · offene Schulden {fmt(Math.abs(Number(participant.balance)))}</>
                    : <> · Guthaben {fmt(participant.balance)}</>}
                </>
              : 'Barverkauf (ohne Teilnehmer)'}
          </span>
          <span className="text-sm text-primary font-semibold">{participant ? 'Ändern' : 'Teilnehmer wählen'}</span>
        </button>

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

        {/* payment method: exactly one active at a time */}
        <div className="space-y-3">
          <span className="text-sm font-medium">Zahlung</span>
          <div className="grid grid-cols-3 gap-2">
            {/* all three are always selectable; picking Guthaben/Schulden without a
                participant prompts for one below (a walk-in from outside the camp pays cash) */}
            <MethodButton active={method === 'cash'} onClick={() => chooseMethod('cash')} label="Bar" />
            <MethodButton
              active={method === 'balance'}
              onClick={() => chooseMethod('balance')}
              label="Guthaben"
              // available credit - someone in debt has none, so show 0,00 € rather than a
              // contradictory negative amount on a "Guthaben" button
              hint={participant ? fmt(Math.max(Number(participant.balance), 0)) : null}
            />
            <MethodButton active={method === 'debt'} onClick={() => chooseMethod('debt')} label="Schulden" />
          </div>

          {/* cash details only in cash mode */}
          {method === 'cash' && (
            <div className="space-y-2">
              <label className="block">
                <span className="text-sm text-gray-600">Bar erhalten</span>
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
                  <button key={bill} onClick={() => setCashInput(String(bill))}
                          className="flex-1 border rounded-lg py-2 text-sm bg-gray-50">
                    {bill} €
                  </button>
                ))}
                <button onClick={() => setCashInput('')} className="flex-1 border rounded-lg py-2 text-sm bg-gray-50">
                  0 €
                </button>
              </div>
              {/* pay-extra ("stimmt so") only makes sense when there's overpayment and an account to credit */}
              {participant && overpaidCents > 0 && (
                <label className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                  <input type="checkbox" checked={payExtra} onChange={(e) => setPayExtra(e.target.checked)} className="w-5 h-5" />
                  <span>Rest als Guthaben behalten („stimmt so“)</span>
                </label>
              )}
            </div>
          )}
        </div>

        {/* summary of what confirming will do - only shown once a valid method is set up */}
        {method && !needsParticipant && !cashShort && !balanceShort && (
          <div className="bg-primary/10 rounded-xl p-4 text-sm space-y-1">
            {method === 'cash' && (
              <>
                <Row label="Bar bezahlt" value={fmt(fromCents(Math.min(cashCents, totalCents)))} />
                {overpaidCents > 0 && !payExtra && (
                  <Row label="Wechselgeld zurückgeben" value={fmt(fromCents(overpaidCents))} bold />
                )}
                {overpaidCents > 0 && payExtra && (
                  <Row label="Als Guthaben gutgeschrieben" value={fmt(fromCents(overpaidCents))} />
                )}
                {participant && <BalanceRow cents={balanceCents + (payExtra ? overpaidCents : 0)} />}
              </>
            )}
            {method === 'balance' && (
              <>
                <Row label="Vom Guthaben" value={fmt(fromCents(totalCents))} />
                <BalanceRow cents={balanceCents - totalCents} />
              </>
            )}
            {method === 'debt' && (
              <>
                <Row label="Auf Schulden" value={fmt(fromCents(totalCents))} red />
                <BalanceRow cents={balanceCents - totalCents} />
              </>
            )}
          </div>
        )}

        {/* prompts: tell the seller exactly what's missing before they can confirm */}
        {!method && (
          <div className="bg-yellow-50 text-yellow-800 text-sm rounded-lg p-3">
            Bitte eine Zahlungsart wählen.
          </div>
        )}
        {needsParticipant && (
          <div className="bg-yellow-50 text-yellow-800 text-sm rounded-lg p-3 flex items-center justify-between gap-3">
            <span>Für {method === 'balance' ? 'Guthaben' : 'Schulden'} zuerst einen Teilnehmer wählen.</span>
            <button onClick={onPickParticipant} className="shrink-0 bg-primary text-white rounded-lg px-3 py-2 text-sm font-semibold">
              Teilnehmer wählen
            </button>
          </div>
        )}
        {cashShort && (
          <div className="bg-yellow-50 text-yellow-800 text-sm rounded-lg p-3">
            Es fehlen {fmt(fromCents(totalCents - cashCents))} — bei „Bar“ muss der Betrag voll bezahlt werden.
          </div>
        )}
        {balanceShort && (
          <div className="bg-yellow-50 text-yellow-800 text-sm rounded-lg p-3">
            Guthaben reicht nicht ({fmt(participant.balance)}). Bitte „Bar“ oder „Schulden“ wählen.
          </div>
        )}
        {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3">{error}</div>}
      </div>

      <div className="fixed bottom-0 inset-x-0 bg-white border-t p-4">
        <button
          onClick={confirm}
          disabled={!canConfirm}
          className="w-full max-w-3xl mx-auto block bg-primary text-white rounded-xl py-4 font-semibold text-lg disabled:opacity-40"
        >
          {busy ? 'Wird gebucht…' : `Verkauf bestätigen · ${fmt(fromCents(totalCents))}`}
        </button>
      </div>
    </div>
  )
}

// one payment-method choice in the segmented control
function MethodButton({ active, disabled, onClick, label, hint }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg py-3 px-2 text-sm font-semibold border text-center leading-tight ${
        active ? 'bg-primary text-white border-primary' : 'bg-white border-gray-300'
      } ${disabled ? 'opacity-40' : ''}`}
    >
      {label}
      {hint && <div className="text-xs font-normal opacity-80">{hint}</div>}
    </button>
  )
}

// A negative balance is debt. Never show "Guthaben: -1,00 €" - at the stand that reads
// wrong. Show it as a positive "Offene Schulden" amount instead.
function BalanceRow({ cents }) {
  return cents < 0 ? (
    <Row label="Offene Schulden" value={fmt(fromCents(-cents))} bold red />
  ) : (
    <Row label="Guthaben danach" value={fmt(fromCents(cents))} bold />
  )
}

function Row({ label, value, red, bold }) {
  return (
    <div className={`flex justify-between ${bold ? 'font-bold' : ''} ${red ? 'text-accent' : ''}`}>
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
      {sale.newBalance !== null &&
        (Number(sale.newBalance) < 0 ? (
          <div className="text-lg text-accent">
            Offene Schulden: <span className="font-bold">{fmt(Math.abs(Number(sale.newBalance)))}</span>
          </div>
        ) : (
          <div className="text-lg text-primary">
            Neues Guthaben: <span className="font-bold">{fmt(sale.newBalance)}</span>
          </div>
        ))}

      <button onClick={onDone} className="w-full bg-primary text-white rounded-xl py-4 font-semibold">
        Weiter verkaufen
      </button>
    </div>
  )
}
