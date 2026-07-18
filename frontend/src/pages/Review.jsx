import { useEffect, useState } from 'react'
import { Check, CheckCircle2 } from 'lucide-react'
import { api } from '../api'
import { fmt } from '../money'

// The SELLER_LEAD's queue: reversals done by plain sellers, waiting for a double check.
// (Route is only shown to leads; the backend enforces the role anyway.)
export default function Review() {
  const [sales, setSales] = useState([])
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

  async function approve(sale) {
    try {
      await api(`/api/sales/${sale.id}/approve-reversal`, { method: 'POST' })
      reload()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="font-bold text-lg">Stornierungen prüfen</h2>
      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3">{error}</div>}

      {sales.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-400">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          Nichts zu prüfen – alles sauber!
        </div>
      )}

      {sales.map((sale) => (
        <div key={sale.id} className="bg-white rounded-xl shadow-sm p-4 space-y-2">
          <div className="flex justify-between text-sm text-gray-500">
            <span>#{sale.id} · {sale.sellerName}</span>
            <span>{new Date(sale.createdAt).toLocaleString('de-AT')}</span>
          </div>
          <div className="font-medium">
            {sale.items.map((i) => `${i.quantity}× ${i.productName}`).join(', ')} · {fmt(sale.totalAmount)}
          </div>
          <div className="text-sm text-gray-600">
            {sale.participantName ? `Teilnehmer: ${sale.participantName}` : 'Barverkauf'} · storniert
          </div>
          <button onClick={() => approve(sale)}
                  className="w-full bg-primary text-white rounded-lg py-2 font-semibold flex items-center justify-center gap-1.5">
            <Check className="w-4 h-4" /> Geprüft und in Ordnung
          </button>
        </div>
      ))}
    </div>
  )
}
