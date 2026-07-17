import { useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'

// Password change form. Used in two ways:
// - forced=true: full screen, no way around it (first login with a temporary password)
// - forced=false: voluntary change from the header, can be cancelled
export default function ChangePassword({ forced, onClose }) {
  const { updateUser } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    if (newPassword !== repeat) {
      setError('Die Passwörter stimmen nicht überein')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await api('/api/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } })
      updateUser({ mustChangePassword: false }) // unblocks the app
      onClose?.()
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  return (
    <div className={forced ? 'p-4 max-w-md mx-auto' : 'fixed inset-0 bg-black/40 z-30 flex items-end sm:items-center justify-center'}
         onClick={forced ? undefined : onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow p-5 w-full max-w-md space-y-3 mt-6">
        <h2 className="font-bold text-lg">Passwort ändern</h2>

        {forced && (
          <div className="bg-primary/10 text-primary-dark text-sm rounded-lg p-3">
            Dein Passwort wurde von einem Admin vergeben. Bitte wähle jetzt dein eigenes,
            bevor es weitergeht.
          </div>
        )}
        {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-2">{error}</div>}

        <input
          type="password"
          required
          autoComplete="current-password"
          placeholder={forced ? 'Temporäres Passwort' : 'Aktuelles Passwort'}
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="w-full border rounded-lg px-3 py-3"
        />
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="Neues Passwort (min. 8 Zeichen)"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full border rounded-lg px-3 py-3"
        />
        <input
          type="password"
          required
          autoComplete="new-password"
          placeholder="Neues Passwort wiederholen"
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
          className="w-full border rounded-lg px-3 py-3"
        />

        <div className="flex gap-2">
          {!forced && (
            <button type="button" onClick={onClose} className="flex-1 border rounded-lg py-3">
              Abbrechen
            </button>
          )}
          <button type="submit" disabled={busy}
                  className="flex-1 bg-primary text-white rounded-lg py-3 font-semibold disabled:opacity-50">
            {busy ? 'Wird gespeichert…' : 'Passwort speichern'}
          </button>
        </div>
      </form>
    </div>
  )
}
