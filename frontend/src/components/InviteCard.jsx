import { useState } from 'react'
import { Check, Copy, X } from 'lucide-react'
import { roleLabel } from '../auth'

// Shown right after a user is created. The system cannot send email (that needs
// an SMTP provider and belongs with deployment), so instead it produces a ready
// message to send via WhatsApp - the way a camp team actually communicates.
export default function InviteCard({ invite, onClose }) {
  const [copied, setCopied] = useState(false)
  const loginUrl = window.location.origin

  const message =
    `Hallo ${invite.firstName}!\n\n` +
    `Du bist als ${roleLabel(invite.role)} für den Verkaufsstand eingetragen` +
    (invite.campName ? ` (${invite.campName}).` : '.') +
    `\n\nAnmelden: ${loginUrl}\n` +
    `E-Mail: ${invite.email}\n` +
    `Temporäres Passwort: ${invite.password}\n\n` +
    `Beim ersten Login wirst du aufgefordert, ein eigenes Passwort zu setzen. ` +
    `Danach führt dich eine kurze Einführung durch die App.`

  async function copy() {
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false) // clipboard blocked - the text is selectable below anyway
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
         onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
           className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div>
            <h2 className="font-semibold">Zugang für {invite.firstName} {invite.lastName}</h2>
            <p className="text-xs text-gray-500">Diese Daten persönlich weitergeben</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" title="Schließen">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between gap-3">
              <span className="text-gray-500">Anmelden</span>
              <span className="font-medium truncate">{loginUrl}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-gray-500">E-Mail</span>
              <span className="font-medium truncate">{invite.email}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-gray-500">Passwort</span>
              <span className="font-mono font-semibold">{invite.password}</span>
            </div>
          </div>

          <div className="bg-primary-soft text-primary-dark text-xs rounded-lg p-3">
            Das Passwort ist nur temporär: beim ersten Login muss {invite.firstName} ein eigenes
            setzen, danach startet automatisch die Einführung.
          </div>

          {/* the full message, selectable in case the clipboard API is blocked */}
          <textarea
            readOnly
            value={message}
            rows={7}
            className="w-full border rounded-lg p-2 text-xs text-gray-600 bg-white"
          />

          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 border rounded-lg py-3 hover:bg-gray-50">Fertig</button>
            <button onClick={copy}
                    className="flex-1 bg-primary text-white rounded-lg py-3 font-semibold flex items-center justify-center gap-2">
              {copied ? <><Check className="w-4 h-4" /> Kopiert</> : <><Copy className="w-4 h-4" /> Nachricht kopieren</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
