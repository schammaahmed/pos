import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth, isLead } from '../auth'
import { fmt } from '../money'

// Participant list with balance, history, deposit and (for leads) debt settlement.
export default function Participants() {
  const { user } = useAuth()
  const [participants, setParticipants] = useState([])
  const [search, setSearch] = useState('')
  const [openId, setOpenId] = useState(null) // which row is expanded
  const [error, setError] = useState(null)
  const [showCreate, setShowCreate] = useState(false)

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
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Suchen…"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-3"
        />
        {isLead(user) && (
          <button onClick={() => setShowCreate(true)} className="bg-blue-600 text-white rounded-lg px-4 font-semibold">
            + Neu
          </button>
        )}
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3">{error}</div>}

      {openDebts.length > 0 && (
        <div className="text-sm text-gray-500">
          {openDebts.length} Teilnehmer mit offenen Schulden (
          {fmt(openDebts.reduce((sum, p) => sum + Number(p.balance), 0))})
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm divide-y">
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
        {participants.length === 0 && <div className="p-4 text-gray-400 text-sm">Keine Teilnehmer gefunden.</div>}
      </div>

      {showCreate && <CreateParticipantForm onClose={() => setShowCreate(false)} onCreated={reload} />}
    </div>
  )
}

function ParticipantRow({ participant, open, onToggle, canSettle, onChanged }) {
  const [history, setHistory] = useState(null)
  const [sales, setSales] = useState(null)
  const [error, setError] = useState(null)

  // load the details only when the row is opened - not for all 80 participants upfront
  useEffect(() => {
    if (!open) return
    api(`/api/participants/${participant.id}/history`).then(setHistory).catch(() => setHistory([]))
    api(`/api/sales?participantId=${participant.id}`).then(setSales).catch(() => setSales([]))
  }, [open, participant.id])

  async function deposit() {
    const input = window.prompt('Betrag einzahlen (€):')
    if (!input) return
    try {
      await api(`/api/participants/${participant.id}/deposit`, {
        method: 'POST',
        body: { amount: Number(input.replace(',', '.')) },
      })
      onChanged()
    } catch (e) {
      setError(e.message)
    }
  }

  async function settleDebt() {
    if (!window.confirm(`Schulden von ${fmt(participant.balance)} als bezahlt markieren?`)) return
    try {
      await api(`/api/participants/${participant.id}/settle-debt`, { method: 'POST' })
      onChanged()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div>
      <button onClick={onToggle} className="w-full flex justify-between items-center p-4">
        <span className="font-medium">
          {participant.firstName} {participant.lastName}
        </span>
        <span className={participant.inDebt ? 'text-red-600 font-semibold' : 'text-green-700'}>
          {fmt(participant.balance)}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-2">{error}</div>}

          <div className="flex gap-2">
            <button onClick={deposit} className="flex-1 bg-green-600 text-white rounded-lg py-2 text-sm font-semibold">
              💶 Einzahlen
            </button>
            {canSettle && participant.inDebt && (
              <button onClick={settleDebt} className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-semibold">
                Schulden beglichen
              </button>
            )}
          </div>

          {/* purchase history */}
          {sales?.length > 0 && (
            <div className="text-sm space-y-1">
              <div className="font-semibold text-gray-600">Einkäufe</div>
              {sales.map((s) => (
                <div key={s.id} className={`flex justify-between ${s.status === 'REVERSED' ? 'line-through text-gray-400' : ''}`}>
                  <span>{s.items.map((i) => `${i.quantity}× ${i.productName}`).join(', ')}</span>
                  <span>{fmt(s.totalAmount)}</span>
                </div>
              ))}
            </div>
          )}

          {/* deposits & settlements */}
          {history?.length > 0 && (
            <div className="text-sm space-y-1">
              <div className="font-semibold text-gray-600">Ein-/Auszahlungen</div>
              {history.map((h) => (
                <div key={h.id} className="flex justify-between">
                  <span>
                    {h.type === 'DEPOSIT' ? 'Einzahlung' : 'Schulden beglichen'} · {h.performedBy}
                  </span>
                  <span>{fmt(h.amount)}</span>
                </div>
              ))}
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
        <input placeholder="Startguthaben € (optional)" inputMode="decimal" value={initialBalance} onChange={(e) => setInitialBalance(e.target.value)} className="w-full border rounded-lg px-3 py-3" />
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 border rounded-lg py-3">Abbrechen</button>
          <button type="submit" className="flex-1 bg-blue-600 text-white rounded-lg py-3 font-semibold">Anlegen</button>
        </div>
      </form>
    </div>
  )
}
