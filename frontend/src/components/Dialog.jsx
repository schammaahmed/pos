import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

// In-app replacements for window.prompt / window.confirm.
// The native ones are not just ugly: prompt() is outright unsupported in some
// browsers and embedded webviews (it throws), which silently broke "Einzahlen".

// Shared shell: dimmed backdrop, centred card on desktop, bottom sheet on a phone.
function Modal({ title, onClose, children }) {
  // Escape closes the dialog - expected on desktop
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
         onClick={onClose}>
      {/* stopPropagation so clicking inside the card doesn't close it */}
      <div onClick={(e) => e.stopPropagation()}
           className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" title="Schließen">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}

// Yes/no question. `tone="danger"` colours the confirm button in the debt accent.
export function ConfirmDialog({ title, message, confirmLabel = 'Bestätigen', tone = 'primary', onConfirm, onClose }) {
  const [busy, setBusy] = useState(false)

  async function confirm() {
    setBusy(true)
    try {
      await onConfirm()
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-sm text-gray-600">{message}</p>
      <div className="flex gap-2 mt-4">
        <button onClick={onClose} className="flex-1 border rounded-lg py-3 hover:bg-gray-50">Abbrechen</button>
        <button
          onClick={confirm}
          disabled={busy}
          className={`flex-1 text-white rounded-lg py-3 font-semibold disabled:opacity-50 ${
            tone === 'danger' ? 'bg-accent' : 'bg-primary'
          }`}
        >
          {busy ? 'Moment…' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

// Asks for a euro amount. Replaces window.prompt for deposits.
export function AmountDialog({ title, label = 'Betrag', confirmLabel = 'Speichern', quickAmounts = [5, 10, 20], onSubmit, onClose }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const amount = Number(value.replace(',', '.'))
  const valid = value !== '' && !Number.isNaN(amount) && amount > 0

  async function submit(event) {
    event.preventDefault()
    if (!valid) {
      setError('Bitte einen Betrag größer als 0 eingeben.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onSubmit(amount)
      onClose()
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="text-sm text-gray-600">{label}</span>
          <input
            autoFocus
            inputMode="decimal"
            placeholder="0,00"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-3 text-lg"
          />
        </label>

        <div className="flex gap-2">
          {quickAmounts.map((a) => (
            <button key={a} type="button" onClick={() => setValue(String(a))}
                    className="flex-1 border rounded-lg py-2 text-sm bg-gray-50 hover:bg-gray-100">
              {a} €
            </button>
          ))}
        </div>

        {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-2">{error}</div>}

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 border rounded-lg py-3 hover:bg-gray-50">
            Abbrechen
          </button>
          <button type="submit" disabled={busy}
                  className="flex-1 bg-primary text-white rounded-lg py-3 font-semibold disabled:opacity-50">
            {busy ? 'Moment…' : confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  )
}
