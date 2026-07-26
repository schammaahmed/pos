import { useEffect, useState } from 'react'
import {
  ArrowDownToLine, ArrowUpFromLine, Banknote, Calculator, Coins, Wallet,
} from 'lucide-react'
import { api } from '../api'
import { fmt } from '../money'
import { AmountDialog } from './Dialog'
import { SectionHeader } from './ui'

// The camp cash box (Kassenbuch). Expected cash is derived on the server from the
// float + cash sales + top-ups − withdrawals; here we just show it and let the
// leadership record movements and reconcile against a physical count.
export default function CashBox({ campId }) {
  const [book, setBook] = useState(null)
  const [dialog, setDialog] = useState(null) // 'deposit' | 'withdrawal' | null
  const [counted, setCounted] = useState('')
  const [reconcile, setReconcile] = useState(null)
  const [error, setError] = useState(null)

  const query = campId ? `?campId=${campId}` : ''

  async function reload() {
    try {
      setBook(await api(`/api/cash${query}`))
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => {
    reload()
  }, [campId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function addMovement(type, amount, note) {
    setError(null)
    const updated = await api(`/api/cash${query}`, { method: 'POST', body: { type, amount, note } })
    setBook(updated)
    setReconcile(null) // the target moved, so an old count is stale
  }

  async function doReconcile(e) {
    e.preventDefault()
    setError(null)
    try {
      setReconcile(await api(`/api/cash/reconcile${query}`, {
        method: 'POST',
        body: { countedCash: Number(counted.replace(',', '.')) },
      }))
    } catch (err) {
      setError(err.message)
    }
  }

  if (!book) return null

  return (
    <section>
      <SectionHeader title="Kasse" hint="Bargeld im Verkaufsstand" />
      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3 mb-3">{error}</div>}

      <div className="bg-white rounded-xl shadow-sm p-4 space-y-4">
        {/* how the expected amount is built up, line by line, so it can be checked */}
        <div className="space-y-1.5 text-sm">
          <Line icon={Wallet} label="Startgeld" value={book.startingCash} />
          <Line icon={Banknote} label="Barverkäufe" value={book.cashSales} />
          {/* only show the Aktionen line when relevant, so casual cash books stay uncluttered */}
          {Number(book.specialsCash) > 0 && (
            <Line icon={Banknote} label="Aktionen (bar)" value={book.specialsCash} />
          )}
          <Line icon={ArrowDownToLine} label="Nachlagen" value={book.deposits} />
          <Line icon={ArrowUpFromLine} label="Entnahmen" value={book.withdrawals} negative />
          <div className="flex justify-between items-center border-t border-gray-100 pt-2 mt-1 font-bold">
            <span className="flex items-center gap-2"><Coins className="w-4 h-4 text-primary" /> Soll (erwartet)</span>
            <span className="text-primary text-lg">{fmt(book.expected)}</span>
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={() => setDialog('deposit')}
                  className="flex-1 border rounded-lg py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-gray-50">
            <ArrowDownToLine className="w-4 h-4 text-success" /> Nachlegen
          </button>
          <button onClick={() => setDialog('withdrawal')}
                  className="flex-1 border rounded-lg py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-gray-50">
            <ArrowUpFromLine className="w-4 h-4 text-accent" /> Entnahme
          </button>
        </div>

        {/* Soll-Ist-Abgleich */}
        <form onSubmit={doReconcile} className="border-t border-gray-100 pt-4 space-y-2">
          <div className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
            <Calculator className="w-3.5 h-3.5" /> KASSENSTURZ
          </div>
          <div className="flex gap-2">
            <input
              inputMode="decimal"
              value={counted}
              onChange={(e) => setCounted(e.target.value)}
              placeholder="Gezähltes Bargeld…"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm"
            />
            <button type="submit" disabled={counted === ''}
                    className="bg-primary text-white rounded-lg px-4 text-sm font-semibold disabled:opacity-40">
              Abgleichen
            </button>
          </div>

          {reconcile && (
            <div className={`rounded-lg p-3 text-sm ${
              Number(reconcile.difference) === 0 ? 'bg-success-soft text-success'
                : Number(reconcile.difference) > 0 ? 'bg-info-soft text-info' : 'bg-accent-soft text-accent'
            }`}>
              <div className="flex justify-between"><span>Gezählt</span><span>{fmt(reconcile.counted)}</span></div>
              <div className="flex justify-between"><span>Erwartet</span><span>{fmt(reconcile.expected)}</span></div>
              <div className="flex justify-between font-bold mt-1 pt-1 border-t border-current/20">
                <span>
                  {Number(reconcile.difference) === 0 ? 'Stimmt genau'
                    : Number(reconcile.difference) > 0 ? 'Überschuss' : 'Fehlbetrag'}
                </span>
                <span>{Number(reconcile.difference) > 0 ? '+' : ''}{fmt(reconcile.difference)}</span>
              </div>
            </div>
          )}
        </form>

        {/* movement history */}
        {book.movements.length > 0 && (
          <div className="border-t border-gray-100 pt-3">
            <div className="text-xs font-semibold text-gray-500 mb-1.5">BEWEGUNGEN</div>
            <div className="divide-y divide-gray-100">
              {book.movements.map((m) => (
                <div key={m.id} className="flex items-center gap-2 py-2 text-sm">
                  {m.type === 'DEPOSIT'
                    ? <ArrowDownToLine className="w-4 h-4 text-success shrink-0" />
                    : <ArrowUpFromLine className="w-4 h-4 text-accent shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{m.note || (m.type === 'DEPOSIT' ? 'Nachlegen' : 'Entnahme')}</div>
                    <div className="text-[11px] text-gray-400">
                      {new Date(m.createdAt).toLocaleString('de-AT')} · {m.byName}
                    </div>
                  </div>
                  <span className={`font-semibold shrink-0 ${m.type === 'DEPOSIT' ? 'text-success' : 'text-accent'}`}>
                    {m.type === 'DEPOSIT' ? '+' : '−'}{fmt(m.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {dialog && (
        <AmountDialog
          title={dialog === 'deposit' ? 'Bargeld nachlegen' : 'Bargeld entnehmen'}
          label={dialog === 'deposit' ? 'Betrag, der in die Kasse kommt' : 'Betrag, der entnommen wird'}
          confirmLabel={dialog === 'deposit' ? 'Nachlegen' : 'Entnehmen'}
          onSubmit={(amount) => addMovement(dialog === 'deposit' ? 'DEPOSIT' : 'WITHDRAWAL', amount)}
          onClose={() => setDialog(null)}
        />
      )}
    </section>
  )
}

function Line({ icon: Icon, label, value, negative }) {
  return (
    <div className="flex justify-between items-center text-gray-600">
      <span className="flex items-center gap-2"><Icon className="w-4 h-4 text-gray-400" /> {label}</span>
      <span>{negative ? '−' : ''}{fmt(value)}</span>
    </div>
  )
}
