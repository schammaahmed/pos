import { useEffect, useState } from 'react'
import { Banknote, Check, CheckCircle2, ChevronRight, Flag, PackageOpen, Receipt, RotateCcw, Tent } from 'lucide-react'
import { api } from '../api'
import { useAuth, isLead } from '../auth'
import { fmt } from '../money'
import { ConfirmDialog } from '../components/Dialog'
import { Avatar, Badge, EmptyState, SectionHeader } from '../components/ui'

// The lead's oversight page, two parts:
//  1. Zu entscheiden — flagged sales a seller was unsure about; the lead clears or undoes them.
//  2. Stornierungen — EVERY cancellation across sales/Aktionen/Vorbestellungen, so nothing is
//     undone unnoticed. A lead's own cancels arrive already checked; a seller's or a
//     participant's stay pending until a lead ticks them off.
export default function Review() {
  const { user } = useAuth()
  const [flagged, setFlagged] = useState([])
  const [cancellations, setCancellations] = useState([])
  const [confirm, setConfirm] = useState(null) // { sale, kind: 'reverse' | 'ok' }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [showChecked, setShowChecked] = useState(false)

  async function reload() {
    try {
      const [f, c] = await Promise.all([
        api('/api/sales/flagged'),
        api('/api/review/cancellations'),
      ])
      setFlagged(f)
      setCancellations(c)
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => { reload() }, [])

  async function act() {
    const { sale, kind } = confirm
    setBusy(true); setError(null)
    try {
      await api(`/api/sales/${sale.id}/${kind === 'reverse' ? 'reverse' : 'approve-reversal'}`, { method: 'POST' })
      await reload()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false); setConfirm(null)
    }
  }

  async function acknowledge(c) {
    setError(null)
    try {
      await api(`/api/review/cancellations/${c.kind}/${c.id}/reviewed`, { method: 'POST' })
      await reload()
    } catch (e) { setError(e.message) }
  }

  const pending = cancellations.filter((c) => c.pending)
  const checked = cancellations.filter((c) => !c.pending)

  return (
    <div className="space-y-6">
      <SectionHeader title="Prüfen" hint="Offene Fragen & alle Stornierungen dieses Camps" />

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3">{error}</div>}

      {/* ------------------------------------------------ flagged sales */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-500">Zu entscheiden</h2>
        {flagged.length === 0 ? (
          <EmptyState icon={CheckCircle2}>Keine offenen Fragen.</EmptyState>
        ) : (
          <div className="space-y-3">
            {flagged.map((sale) => {
              const reversed = sale.status === 'REVERSED'
              return (
                <div key={sale.id} className="bg-white rounded-xl shadow-sm p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    {sale.participantName ? <Avatar name={sale.participantName} size="sm" /> : (
                      <span className="w-8 h-8 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center shrink-0">
                        <Banknote className="w-4 h-4" />
                      </span>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium flex items-center gap-2 flex-wrap">
                        {sale.participantName ?? <span className="italic font-normal text-gray-500">Barverkauf</span>}
                        {reversed && <Badge tone="neutral">bereits storniert</Badge>}
                        <Badge tone="warning">zu prüfen</Badge>
                      </div>
                      <div className="text-sm text-gray-600">
                        {sale.items.map((i) => `${i.quantity}× ${i.productName}`).join(', ')}
                      </div>
                      <div className="text-xs text-gray-400">
                        #{sale.id} · gebucht von {sale.sellerName} · {new Date(sale.createdAt).toLocaleString('de-AT')}
                      </div>
                      {sale.flaggedByName && (
                        <div className="text-xs text-warning flex items-center gap-1 mt-0.5">
                          <Flag className="w-3 h-3" /> markiert von {sale.flaggedByName}
                          {sale.flaggedAt && ` · ${new Date(sale.flaggedAt).toLocaleString('de-AT')}`}
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`font-bold ${reversed ? 'line-through text-gray-400' : ''}`}>{fmt(sale.totalAmount)}</div>
                      <div className="text-[11px] text-gray-400">
                        {Number(sale.debtAmount) > 0 ? 'Schulden' : Number(sale.paidFromBalance) > 0 ? 'Guthaben' : 'Bar'}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => setConfirm({ sale, kind: 'ok' })} disabled={busy}
                            className="flex-1 bg-primary text-white rounded-lg py-2.5 font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50">
                      <Check className="w-4 h-4" /> Passt so
                    </button>
                    {isLead(user) && !reversed && (
                      <button onClick={() => setConfirm({ sale, kind: 'reverse' })} disabled={busy}
                              className="flex-1 border border-accent text-accent rounded-lg py-2.5 font-semibold flex items-center justify-center gap-1.5 hover:bg-accent-soft disabled:opacity-50">
                        <RotateCcw className="w-4 h-4" /> Stornieren
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* --------------------------------------------- cancellations oversight */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-500">
          Stornierungen prüfen {pending.length > 0 && <Badge tone="warning">{pending.length}</Badge>}
        </h2>
        {pending.length === 0 && checked.length === 0 ? (
          <EmptyState icon={CheckCircle2}>Noch nichts storniert.</EmptyState>
        ) : (
          <>
            {pending.length === 0 && (
              <div className="text-sm text-gray-400">Alle Stornierungen sind geprüft.</div>
            )}
            <div className="space-y-2">
              {pending.map((c) => (
                <CancellationRow key={`${c.kind}-${c.id}`} c={c}
                                 canAck={isLead(user)} onAck={() => acknowledge(c)} />
              ))}
            </div>

            {checked.length > 0 && (
              <div>
                <button onClick={() => setShowChecked((s) => !s)}
                        className="text-xs font-semibold text-gray-500 hover:text-gray-700 flex items-center gap-1 mt-2">
                  <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showChecked ? 'rotate-90' : ''}`} />
                  Bereits geprüft ({checked.length})
                </button>
                {showChecked && (
                  <div className="space-y-2 mt-2">
                    {checked.map((c) => (
                      <CancellationRow key={`${c.kind}-${c.id}`} c={c} canAck={false} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {confirm && (
        <ConfirmDialog
          title={confirm.kind === 'reverse' ? 'Verkauf stornieren' : 'Verkauf freigeben'}
          message={
            confirm.kind === 'reverse'
              ? `Der Verkauf über ${fmt(confirm.sale.totalAmount)} wird rückgängig gemacht${
                  confirm.sale.participantName ? ` und ${confirm.sale.participantName} gutgeschrieben` : ''
                }.`
              : 'Der Verkauf bleibt bestehen und verschwindet aus der Prüfliste.'
          }
          confirmLabel={confirm.kind === 'reverse' ? 'Stornieren' : 'Passt so'}
          tone={confirm.kind === 'reverse' ? 'danger' : 'primary'}
          onConfirm={act}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  )
}

const KIND_LABEL = { SALE: 'Kasse', SPECIAL: 'Aktion', PREORDER: 'Vorbestellung' }
const KIND_TONE = { SALE: 'neutral', SPECIAL: 'info', PREORDER: 'primary' }
const KIND_ICON = { SALE: Receipt, SPECIAL: Tent, PREORDER: PackageOpen }

function CancellationRow({ c, canAck, onAck }) {
  const KindIcon = KIND_ICON[c.kind]
  return (
    <div className={`bg-white rounded-xl shadow-sm p-3 flex items-center gap-3 ${c.pending ? '' : 'opacity-70'}`}>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate flex items-center gap-2">
          {c.participantName ?? <span className="italic font-normal text-gray-500">Barverkauf</span>}
          <Badge tone={KIND_TONE[c.kind]}>
            <KindIcon className="w-3 h-3 inline -mt-0.5 mr-0.5" />{KIND_LABEL[c.kind]}
          </Badge>
        </div>
        <div className="text-xs text-gray-500 truncate">{c.description}</div>
        <div className="text-[11px] text-accent">
          storniert von {c.cancelledByName ?? 'Teilnehmer:in selbst'}
          {c.cancelledAt && ` · ${new Date(c.cancelledAt).toLocaleString('de-AT')}`}
        </div>
        {!c.pending && c.reviewedByName && (
          <div className="text-[11px] text-success">geprüft von {c.reviewedByName}</div>
        )}
      </div>
      <div className="text-right shrink-0">
        <div className="font-semibold">{fmt(c.totalAmount)}</div>
      </div>
      {c.pending ? (
        canAck ? (
          <button onClick={onAck}
                  className="shrink-0 bg-primary text-white rounded-lg px-3 py-2 text-sm font-semibold flex items-center gap-1">
            <Check className="w-4 h-4" /> Geprüft
          </button>
        ) : (
          <Badge tone="warning">offen</Badge>
        )
      ) : (
        <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
      )}
    </div>
  )
}
