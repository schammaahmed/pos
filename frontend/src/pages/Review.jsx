import { useEffect, useState } from 'react'
import { Banknote, Check, CheckCircle2, Flag, RotateCcw } from 'lucide-react'
import { api } from '../api'
import { useAuth, isLead } from '../auth'
import { fmt } from '../money'
import { ConfirmDialog } from '../components/Dialog'
import { Avatar, Badge, EmptyState, SectionHeader } from '../components/ui'

// The lead's queue: everything someone raised a concern about. This is where a
// sale is either cleared or actually undone - reversing is only possible from a
// flagged state, so this panel is the single place cancellations happen.
export default function Review() {
  const { user } = useAuth()
  const [sales, setSales] = useState([])
  const [confirm, setConfirm] = useState(null) // { sale, kind: 'reverse' | 'ok' }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function reload() {
    try {
      setSales(await api('/api/sales/flagged'))
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => {
    reload()
  }, [])

  async function act() {
    const { sale, kind } = confirm
    setBusy(true)
    setError(null)
    try {
      await api(`/api/sales/${sale.id}/${kind === 'reverse' ? 'reverse' : 'approve-reversal'}`, { method: 'POST' })
      await reload()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <SectionHeader title="Prüfen" hint="Verkäufe, bei denen jemand unsicher war" />

      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3">{error}</div>}

      {sales.length === 0 ? (
        <EmptyState icon={CheckCircle2}>Nichts zu prüfen – alles sauber!</EmptyState>
      ) : (
        <div className="space-y-3">
          {sales.map((sale) => {
            const reversed = sale.status === 'REVERSED'
            return (
              <div key={sale.id} className="bg-white rounded-xl shadow-sm p-4 space-y-3">
                <div className="flex items-start gap-3">
                  {sale.participantName ? (
                    <Avatar name={sale.participantName} size="sm" />
                  ) : (
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
                      #{sale.id} · gebucht von {sale.sellerName} ·{' '}
                      {new Date(sale.createdAt).toLocaleString('de-AT')}
                    </div>
                    {/* who raised it - so the lead knows who to ask */}
                    {sale.flaggedByName && (
                      <div className="text-xs text-warning flex items-center gap-1 mt-0.5">
                        <Flag className="w-3 h-3" />
                        markiert von {sale.flaggedByName}
                        {sale.flaggedAt && ` · ${new Date(sale.flaggedAt).toLocaleString('de-AT')}`}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`font-bold ${reversed ? 'line-through text-gray-400' : ''}`}>
                      {fmt(sale.totalAmount)}
                    </div>
                    <div className="text-[11px] text-gray-400">
                      {Number(sale.debtAmount) > 0 ? 'Schulden' : Number(sale.paidFromBalance) > 0 ? 'Guthaben' : 'Bar'}
                    </div>
                  </div>
                </div>

                {/* Two ways out: it was fine, or it has to be undone. Reversing is
                    only offered here, and only to leads. */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirm({ sale, kind: 'ok' })}
                    disabled={busy}
                    className="flex-1 bg-primary text-white rounded-lg py-2.5 font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" /> Passt so
                  </button>
                  {isLead(user) && !reversed && (
                    <button
                      onClick={() => setConfirm({ sale, kind: 'reverse' })}
                      disabled={busy}
                      className="flex-1 border border-accent text-accent rounded-lg py-2.5 font-semibold flex items-center justify-center gap-1.5 hover:bg-accent-soft disabled:opacity-50"
                    >
                      <RotateCcw className="w-4 h-4" /> Stornieren
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

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
