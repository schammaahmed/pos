import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CircleAlert, Clock, LogOut, Tent, UserRound } from 'lucide-react'
import { selfApi, loadSelf, saveSelf, clearSelf } from '../selfApi'
import { fmt } from '../money'

// Public landing for the QR-scan flow: the stand's QR encodes /self?t=<selfServeToken>.
// If the visitor already has a valid session for THIS camp we skip identify and go
// straight to the menu; otherwise we show a "wer bist du?" name form.
export default function Self() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('t')

  const [camp, setCamp] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!token) { setError('Kein QR-Code erkannt. Bitte den Code am Stand scannen.'); return }
    selfApi(`/api/public/camp?t=${encodeURIComponent(token)}`)
      .then((c) => {
        setCamp(c)
        // if we already have a session for this camp, jump straight in - no re-typing
        const self = loadSelf()
        if (self?.token && self.campId === c.campId) navigate('/self/menu', { replace: true })
      })
      .catch((e) => setError(e.message))
  }, [token, navigate])

  if (error) return <SelfShell><ErrorCard message={error} /></SelfShell>
  if (!camp) return null

  return (
    <SelfShell>
      <div className="text-center space-y-2 mb-6">
        <div className="inline-flex items-center gap-2 bg-primary-soft text-primary px-3 py-1 rounded-full text-xs font-semibold">
          <Tent className="w-3.5 h-3.5" /> {camp.name}
        </div>
        <h1 className="text-2xl font-bold">Vorbestellen</h1>
        <StatusLine camp={camp} />
      </div>

      <IdentifyForm token={token} onDone={() => navigate('/self/menu', { replace: true })} />
    </SelfShell>
  )
}

function StatusLine({ camp }) {
  if (!camp.active) {
    return <p className="text-sm text-accent">Dieses Camp ist abgeschlossen.</p>
  }
  if (!camp.acceptingOrders) {
    return (
      <p className="text-sm text-warning flex items-center justify-center gap-1">
        <Clock className="w-4 h-4" />
        Zurzeit geschlossen{camp.openFrom && camp.openUntil ? ` · offen ${fmtTime(camp.openFrom)}–${fmtTime(camp.openUntil)}` : ''}
      </p>
    )
  }
  return (
    <p className="text-sm text-gray-500 flex items-center justify-center gap-1">
      <Clock className="w-4 h-4 text-success" />
      Geöffnet{camp.openFrom && camp.openUntil ? ` · ${fmtTime(camp.openFrom)}–${fmtTime(camp.openUntil)}` : ''}
    </p>
  )
}

function IdentifyForm({ token, onDone }) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      const res = await selfApi('/api/public/identify', {
        method: 'POST',
        body: { selfServeToken: token, firstName: firstName.trim(), lastName: lastName.trim() },
      })
      if (res.status === 'OK') {
        // Fill in the rest of the session context from /self/me so the header shows the camp name.
        saveSelf({ token: res.token, participantId: res.participantId, firstName: res.firstName, lastName: res.lastName })
        const me = await selfApi('/api/self/me')
        saveSelf({ token: res.token, participantId: res.participantId, firstName: res.firstName, lastName: res.lastName, campId: me.campId, campName: me.campName })
        onDone()
      } else if (res.status === 'NOT_FOUND') {
        setError('Diesen Namen finden wir nicht. Bitte prüfen – oder bei der Stand-Leitung melden.')
      } else {
        setError('Es gibt mehrere Teilnehmer:innen mit diesem Namen. Bitte bei der Stand-Leitung melden.')
      }
    } catch (e) { setError(e.message) }
    setBusy(false)
  }

  return (
    <form onSubmit={submit} className="space-y-3 bg-white rounded-2xl shadow-sm p-5">
      <div>
        <label className="block text-sm text-gray-600 mb-1">Vorname</label>
        <input required value={firstName} onChange={(e) => setFirstName(e.target.value)}
               autoComplete="off" spellCheck="false"
               className="w-full border rounded-lg px-3 py-3 text-lg" />
      </div>
      <div>
        <label className="block text-sm text-gray-600 mb-1">Nachname</label>
        <input required value={lastName} onChange={(e) => setLastName(e.target.value)}
               autoComplete="off" spellCheck="false"
               className="w-full border rounded-lg px-3 py-3 text-lg" />
      </div>
      {error && <ErrorCard message={error} />}
      <button type="submit" disabled={busy || !firstName.trim() || !lastName.trim()}
              className="w-full bg-primary text-white rounded-lg py-3 text-lg font-semibold disabled:opacity-40">
        <UserRound className="w-5 h-5 inline -mt-0.5 mr-1.5" /> Weiter
      </button>
      <p className="text-xs text-gray-400 text-center pt-1">
        Deine Daten bleiben nur auf diesem Gerät gespeichert. Beim nächsten Scan bist du direkt drin.
      </p>
    </form>
  )
}

// The wrapper used by every /self/* page: no side nav, no top staff bar, mobile-first.
export function SelfShell({ children, subheader }) {
  const self = loadSelf()
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-page">
      <header className="sticky top-0 bg-white border-b border-gray-200 z-10">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-2">
          <span className="font-bold text-primary">Verkaufsstand</span>
          {self && (
            <>
              <span className="text-gray-300">·</span>
              <span className="text-sm text-gray-600 truncate">
                {self.firstName} {self.lastName}
              </span>
              <button onClick={() => { clearSelf(); navigate('/self', { replace: false }) }}
                      className="ml-auto text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
                      title="Von diesem Gerät abmelden">
                <LogOut className="w-3.5 h-3.5" /> Abmelden
              </button>
            </>
          )}
        </div>
        {subheader}
      </header>
      <main className="max-w-lg mx-auto p-4">{children}</main>
    </div>
  )
}

function ErrorCard({ message }) {
  return (
    <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3 flex items-start gap-2">
      <CircleAlert className="w-4 h-4 shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  )
}

function fmtTime(t) {
  return String(t).slice(0, 5) // "12:00:00" -> "12:00"
}
