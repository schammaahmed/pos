import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth, isLead } from '../auth'
import { fmt } from '../money'

// Product management. Sellers see the list read-only; leads/admins can
// add, edit, and activate/deactivate ("ausverkauft").
export default function Products() {
  const { user } = useAuth()
  const canEdit = isLead(user)
  const [products, setProducts] = useState([])
  const [editing, setEditing] = useState(null) // null | 'new' | product object
  const [error, setError] = useState(null)

  async function reload() {
    try {
      // admins also want to see deactivated products; sellers only active ones
      setProducts(await api(`/api/products?activeOnly=${!canEdit}`))
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => {
    reload()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleActive(product) {
    try {
      await api(`/api/products/${product.id}/${product.active ? 'deactivate' : 'activate'}`, { method: 'POST' })
      reload()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <button onClick={() => setEditing('new')} className="w-full bg-blue-600 text-white rounded-lg py-3 font-semibold">
          + Produkt anlegen
        </button>
      )}
      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3">{error}</div>}

      <div className="bg-white rounded-xl shadow-sm divide-y">
        {products.map((p) => (
          <div key={p.id} className={`flex items-center gap-3 p-3 ${p.active ? '' : 'opacity-50'}`}>
            {p.imageUrl ? (
              <img src={p.imageUrl} alt={p.name} className="w-12 h-12 rounded-lg object-cover" />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-xl">🛍️</div>
            )}
            <div className="flex-1">
              <div className="font-medium">{p.name}</div>
              <div className="text-sm text-gray-500">
                {p.category || 'Ohne Kategorie'} · {fmt(p.price)}
                {!p.active && ' · deaktiviert'}
              </div>
            </div>
            {canEdit && (
              <>
                <button onClick={() => setEditing(p)} className="text-sm border rounded-lg px-3 py-2">
                  ✏️
                </button>
                <button onClick={() => toggleActive(p)} className="text-sm border rounded-lg px-3 py-2">
                  {p.active ? '⏸' : '▶️'}
                </button>
              </>
            )}
          </div>
        ))}
        {products.length === 0 && <div className="p-4 text-gray-400 text-sm">Noch keine Produkte.</div>}
      </div>

      {editing && (
        <ProductForm
          product={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={reload}
        />
      )}
    </div>
  )
}

function ProductForm({ product, onClose, onSaved }) {
  const [name, setName] = useState(product?.name ?? '')
  const [price, setPrice] = useState(product ? String(product.price) : '')
  const [category, setCategory] = useState(product?.category ?? '')
  const [imageUrl, setImageUrl] = useState(product?.imageUrl ?? '')
  const [error, setError] = useState(null)

  async function submit(event) {
    event.preventDefault()
    const body = {
      name,
      price: Number(String(price).replace(',', '.')),
      category: category || null,
      imageUrl: imageUrl || null,
    }
    try {
      if (product) {
        await api(`/api/products/${product.id}`, { method: 'PUT', body })
      } else {
        await api('/api/products', { method: 'POST', body })
      }
      onSaved()
      onClose()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-30 flex items-end sm:items-center justify-center" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="bg-white rounded-t-2xl sm:rounded-2xl p-4 w-full max-w-md space-y-3">
        <h2 className="font-bold text-lg">{product ? 'Produkt bearbeiten' : 'Produkt anlegen'}</h2>
        {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-2">{error}</div>}
        <input required placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="w-full border rounded-lg px-3 py-3" />
        <input required placeholder="Preis € (z.B. 1,50)" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full border rounded-lg px-3 py-3" />
        <input placeholder="Kategorie (z.B. Getränke)" value={category} onChange={(e) => setCategory(e.target.value)} className="w-full border rounded-lg px-3 py-3" />
        <input placeholder="Bild-URL (optional)" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="w-full border rounded-lg px-3 py-3" />
        {imageUrl && <img src={imageUrl} alt="Vorschau" className="w-20 h-20 rounded-lg object-cover" />}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 border rounded-lg py-3">Abbrechen</button>
          <button type="submit" className="flex-1 bg-blue-600 text-white rounded-lg py-3 font-semibold">Speichern</button>
        </div>
      </form>
    </div>
  )
}
