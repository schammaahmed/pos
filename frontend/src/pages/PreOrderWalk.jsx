import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, CheckCircle2, Undo2, UserRound, X } from 'lucide-react'
import { api } from '../api'
import { fmt } from '../money'
import { SectionHeader } from '../components/ui'
import { groupByCategory } from '../products'
import ParticipantPickerSheet from '../components/ParticipantPickerSheet'

// "Rundgang" mode: a seller loops through the bus/dorm taking pre-orders.
//
// Flow:
//   1. Pick participant   (opens ParticipantPickerSheet)
//   2. Pick product       (tap a card in the grid)
//   3. Pick quantity      (defaults to 1; +/- allows tweaking)
//   4. Confirm            (POST /api/preorders, add to session tape, reset to step 1)
//
// Fast + finger-friendly: no fields that need typing at any step past choosing the kid.
// The session tape at the top shows recently placed orders in this rundgang, so a seller
// mid-loop can see they're actually making progress without navigating away.
export default function PreOrderWalk() {
  const navigate = useNavigate()
  const [participant, setParticipant] = useState(null)
  const [product, setProduct] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [chosenOptions, setChosenOptions] = useState([]) // selected option ids for the current product
  const [showPicker, setShowPicker] = useState(false)
  const [products, setProducts] = useState([])
  const [taken, setTaken] = useState([])       // { id, participantName, productName, quantity }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    api('/api/products').then(setProducts).catch((e) => setError(e.message))
  }, [])

  function reset() { setParticipant(null); setProduct(null); setQuantity(1); setChosenOptions([]) }

  const productOptions = product?.options ?? []
  function toggleOption(id) {
    setChosenOptions((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))
  }
  const surcharge = productOptions.filter((o) => chosenOptions.includes(o.id)).reduce((s, o) => s + Number(o.surcharge), 0)

  // A ref, not the `busy` state: setBusy is async, so `disabled={busy}` only takes effect
  // on the next render. Two quick taps - likely on a phone, walking down a bus aisle -
  // would otherwise both get past the guard and post the order twice.
  const inFlight = useRef(false)

  async function confirm() {
    if (!participant || !product || inFlight.current) return
    inFlight.current = true
    setBusy(true); setError(null)
    try {
      const created = await api('/api/preorders', {
        method: 'POST',
        body: { participantId: participant.id, productId: product.id, quantity, optionIds: chosenOptions },
      })
      setTaken((prev) => [{ id: created.id, participantName: participant.firstName + ' ' + participant.lastName,
                            productName: product.name, optionsLabel: created.optionsLabel, quantity }, ...prev])
      reset()
    } catch (e) {
      setError(e.message)
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  // Undo the last order this session — cancels the underlying PreOrder if it's still NEW.
  // If the kitchen has already started on it, the server refuses and we surface the message
  // rather than silently pretending it worked.
  async function undoLast() {
    const last = taken[0]
    // `undoBlocked` stops the retry loop: without it a refused cancel left the row at
    // position 0, so every further tap re-attempted the same failing request and the
    // seller got the same error with no signal that this one simply can't be undone.
    if (!last || last.undoBlocked || inFlight.current) return
    inFlight.current = true
    try {
      await api(`/api/preorders/${last.id}/cancel`, { method: 'POST' })
      setTaken((prev) => prev.slice(1))
    } catch (e) {
      // The kitchen already started it - mark the row so it stops being a retry target
      // and says so on the row itself, rather than only in the error banner.
      setTaken((prev) => prev.map((t, i) => (i === 0 ? { ...t, undoBlocked: true, blockedReason: e.message } : t)))
      setError(e.message)
    } finally {
      inFlight.current = false
    }
  }

  // group by category the same way the till does, so a seller who knows both flows
  // has a consistent visual layout
  const grouped = useMemo(() => groupByCategory(products), [products])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate('/preorders')}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Fertig
        </button>
        <span className="ml-auto text-xs text-gray-500 flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-success" /> {taken.length} aufgenommen
        </span>
      </div>
      <SectionHeader title="Rundgang" hint="Teilnehmer wählen · Produkt wählen · Bestätigen" />

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3">{error}</div>}

      {/* Step 1 — participant. The picker and the clear-X are SIBLINGS, not nested:
          a button inside a button is invalid HTML, and a click-handling <span> is
          unreachable by keyboard (not focusable, not announced as a control). */}
      <div className={`w-full flex items-center gap-3 rounded-xl transition ${
        participant ? 'bg-primary text-white' : 'bg-white border border-dashed border-gray-300 text-gray-500'
      }`}>
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          className={`flex-1 min-w-0 flex items-center gap-3 p-4 text-left rounded-xl ${
            participant ? '' : 'hover:bg-gray-50'
          }`}
        >
          <UserRound className={`w-6 h-6 shrink-0 ${participant ? 'opacity-90' : 'text-gray-400'}`} />
          <span className="flex-1 font-semibold truncate">
            {participant ? `${participant.firstName} ${participant.lastName}` : 'Teilnehmer wählen'}
          </span>
        </button>
        {participant && (
          <button type="button"
                  onClick={() => { setParticipant(null); setProduct(null) }}
                  className="shrink-0 p-4 opacity-80 hover:opacity-100 rounded-xl"
                  aria-label="Teilnehmer abwählen"
                  title="Anderen Teilnehmer wählen">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Step 2 — product (only once a participant is picked) */}
      {participant && (
        <section>
          <div className="text-xs font-semibold text-gray-500 mb-2">Was möchte {participant.firstName}?</div>
          {grouped.length === 0 && <div className="text-sm text-gray-400">Noch keine Produkte im Angebot.</div>}
          {grouped.map(([category, list]) => (
            <div key={category ?? '_'} className="mb-3">
              {category && <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1 px-1">{category}</div>}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {list.map((p) => (
                  <button key={p.id} onClick={() => { setProduct(p); setQuantity(1); setChosenOptions([]) }}
                          className={`rounded-xl p-3 text-left border transition ${
                            product?.id === p.id
                              ? 'bg-primary text-white border-primary'
                              : 'bg-white border-gray-200 hover:border-primary hover:shadow-sm'
                          }`}>
                    <div className="font-semibold text-sm truncate">{p.name}</div>
                    <div className={`text-xs mt-0.5 ${product?.id === p.id ? 'opacity-90' : 'text-gray-500'}`}>
                      {fmt(p.price)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Step 2b — extras for the chosen product (if it has any) */}
      {participant && product && productOptions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {productOptions.map((o) => {
            const on = chosenOptions.includes(o.id)
            return (
              <button key={o.id} onClick={() => toggleOption(o.id)}
                      className={`text-sm rounded-full border px-3 py-1.5 ${
                        on ? 'bg-primary text-white border-primary' : 'bg-white border-gray-300'
                      }`}>
                {on ? '✓ ' : '+ '}{o.name}{Number(o.surcharge) > 0 ? ` (${fmt(o.surcharge)})` : ''}
              </button>
            )
          })}
        </div>
      )}

      {/* Step 3 — confirm bar (docked at bottom of the main area) */}
      {participant && product && (
        <div className="bg-white rounded-xl shadow-sm p-3 flex items-center gap-3 sticky bottom-4">
          <div className="flex items-center gap-2">
            <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="border rounded-lg w-10 h-10 text-lg">−</button>
            <div className="w-8 text-center font-bold text-lg">{quantity}</div>
            <button onClick={() => setQuantity((q) => q + 1)} className="border rounded-lg w-10 h-10 text-lg">+</button>
          </div>
          <div className="flex-1 min-w-0 text-sm truncate text-gray-500">
            × {product.name} <span className="text-gray-300">·</span> {fmt((Number(product.price) + surcharge) * quantity)}
          </div>
          <button onClick={confirm} disabled={busy}
                  className="bg-primary text-white rounded-lg px-4 py-2.5 text-sm font-semibold flex items-center gap-1.5 disabled:opacity-40">
            <Check className="w-4 h-4" /> Bestätigen
          </button>
        </div>
      )}

      {/* Session tape — what has been placed in this rundgang */}
      {taken.length > 0 && (
        <section className="pt-2">
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs font-semibold text-gray-500">In diesem Rundgang</div>
            <button onClick={undoLast}
                    disabled={taken[0]?.undoBlocked}
                    className="text-xs text-gray-400 hover:text-accent flex items-center gap-1 disabled:opacity-40 disabled:hover:text-gray-400"
                    title={taken[0]?.undoBlocked
                      ? 'Diese Bestellung ist schon in der Küche und kann hier nicht mehr storniert werden'
                      : 'Letzte Bestellung stornieren'}>
              <Undo2 className="w-3.5 h-3.5" /> Letzte rückgängig
            </button>
          </div>
          <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100 overflow-hidden">
            {taken.map((t, i) => (
              <div key={t.id} className={`p-2.5 flex items-center gap-2 text-sm ${i === 0 ? '' : 'opacity-70'}`}>
                <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                <span className="truncate">{t.quantity}× {t.productName}{t.optionsLabel ? ` (${t.optionsLabel})` : ''} <span className="text-gray-400">·</span> {t.participantName}</span>
                {/* say it on the row, not just in the banner - the banner scrolls away */}
                {t.undoBlocked && (
                  <span className="ml-auto shrink-0 text-[11px] text-gray-400 italic">schon in der Küche</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {showPicker && (
        <ParticipantPickerSheet
          onSelect={(p) => { setParticipant(p); setShowPicker(false) }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  )
}
