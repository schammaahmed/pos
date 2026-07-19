import { useMemo } from 'react'
import { Banknote, Flag, Mail, RotateCcw, ShieldCheck, X } from 'lucide-react'
import { roleLabel } from '../auth'
import { fmt } from '../money'
import { Avatar, Badge } from './ui'

// Everything one team member did: what they sold, what they reversed and what is
// flagged on them. Accountability is the point - a shared stand needs to be able
// to answer "who booked this?" without digging through the whole log.
export default function TeamMemberDialog({ member, sales, onClose }) {
  const mine = useMemo(
    () => sales.filter((s) => s.sellerId === member.id),
    [sales, member.id],
  )

  const booked = mine.filter((s) => s.status === 'COMPLETED')
  const reversed = mine.filter((s) => s.status === 'REVERSED')
  const flagged = mine.filter((s) => s.flaggedForReview)
  const revenue = booked.reduce((sum, s) => sum + Number(s.totalAmount), 0)

  const status = !member.active
    ? { tone: 'accent', text: 'deaktiviert' }
    : member.lastLoginAt
      ? { tone: 'success', text: 'aktiv' }
      : { tone: 'warning', text: 'eingeladen' }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
         onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
           className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[85vh]">
        {/* who */}
        <div className="flex items-start gap-3 p-4 border-b border-gray-100 shrink-0">
          <Avatar name={`${member.firstName} ${member.lastName}`} />
          <div className="flex-1 min-w-0">
            <div className="font-semibold flex items-center gap-2">
              {member.firstName} {member.lastName}
              <Badge tone={status.tone}>{status.text}</Badge>
            </div>
            <div className="text-xs text-gray-500">{roleLabel(member.role)}{member.campName ? ` · ${member.campName}` : ''}</div>
            <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
              <Mail className="w-3 h-3" /> {member.email}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" title="Schließen">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* invite / login state - answers "hat die Person sich schon angemeldet?" */}
        <div className="px-4 py-3 border-b border-gray-100 text-sm shrink-0">
          {member.lastLoginAt ? (
            <div className="flex items-center gap-2 text-gray-600">
              <ShieldCheck className="w-4 h-4 text-success" />
              Zuletzt angemeldet: {new Date(member.lastLoginAt).toLocaleString('de-AT')}
              {member.mustChangePassword && ' · Passwort noch temporär'}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-warning">
              <Mail className="w-4 h-4" />
              Eingeladen, aber noch nie angemeldet – Zugangsdaten nochmal weitergeben?
            </div>
          )}
        </div>

        {/* what they did */}
        <div className="grid grid-cols-3 gap-2 p-4 shrink-0">
          <Figure label="Verkäufe" value={booked.length} />
          <Figure label="Umsatz" value={fmt(revenue)} />
          <Figure label="Storniert" value={reversed.length} tone={reversed.length ? 'accent' : undefined} />
        </div>

        {flagged.length > 0 && (
          <div className="mx-4 mb-3 bg-warning-soft text-warning text-xs rounded-lg p-2.5 flex items-center gap-2 shrink-0">
            <Flag className="w-4 h-4 shrink-0" />
            {flagged.length} {flagged.length === 1 ? 'Buchung ist' : 'Buchungen sind'} zur Prüfung markiert.
          </div>
        )}

        <div className="overflow-y-auto border-t border-gray-100">
          <div className="px-4 py-2 text-xs font-semibold text-gray-400 sticky top-0 bg-white">AKTIVITÄT</div>
          {mine.length === 0 && (
            <div className="p-6 text-center text-gray-400 text-sm">Diese Person hat noch nichts gebucht.</div>
          )}
          <div className="divide-y divide-gray-100">
            {mine.map((s) => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                {s.status === 'REVERSED'
                  ? <RotateCcw className="w-4 h-4 text-accent shrink-0" />
                  : <Banknote className="w-4 h-4 text-gray-300 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className={`text-sm truncate ${s.status === 'REVERSED' ? 'line-through text-gray-400' : ''}`}>
                    {s.participantName ?? 'Barverkauf'} · {s.items.map((i) => `${i.quantity}× ${i.productName}`).join(', ')}
                  </div>
                  <div className="text-[11px] text-gray-400">
                    {new Date(s.createdAt).toLocaleString('de-AT')}
                    {s.flaggedForReview && ' · zu prüfen'}
                  </div>
                </div>
                <span className="text-sm font-semibold shrink-0">{fmt(s.totalAmount)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Figure({ label, value, tone }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 text-center">
      <div className={`text-lg font-bold ${tone === 'accent' ? 'text-accent' : ''}`}>{value}</div>
      <div className="text-[11px] text-gray-500">{label}</div>
    </div>
  )
}
