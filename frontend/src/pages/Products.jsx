import { useEffect, useState } from 'react'
import { Eye, EyeOff, Package, Pencil, X } from 'lucide-react'
import { api } from '../api'
import { useAuth, isLead } from '../auth'
import { fmt } from '../money'
import { Badge, EmptyState, ViewToggle } from '../components/ui'

const VIEW_KEY = 'pos_products_view'

// Product management. Sellers see the list read-only; leads/admins can
// add, edit, and activate/deactivate ("ausverkauft").
export default function Products() {
  const { user } = useAuth()
  const canEdit = isLead(user)
  const [products, setProducts] = useState([])
  const [editing, setEditing] = useState(null) // null | 'new' | product object
  const [view, setView] = useState(() => localStorage.getItem(VIEW_KEY) || 'list')
  const [error, setError] = useState(null)

  function changeView(next) {
    setView(next)
    localStorage.setItem(VIEW_KEY, next)
  }

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
      <div className="flex gap-2 items-center">
        {canEdit && (
          <button onClick={() => setEditing('new')} className="flex-1 bg-primary text-white rounded-lg py-3 font-semibold">
            + Produkt anlegen
          </button>
        )}
        <ViewToggle view={view} onChange={changeView} />
      </div>
      {error && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3">{error}</div>}

      {products.length === 0 ? (
        <EmptyState icon={Package}>Noch keine Produkte.</EmptyState>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {products.map((p) => (
            // a deactivated product is dimmed AND outlined in red so it's obvious at a glance
            <div key={p.id}
                 className={`bg-white rounded-xl shadow-sm overflow-hidden ${p.active ? '' : 'opacity-60 ring-1 ring-red-300'}`}>
              <div className="aspect-[4/3] bg-gray-100 flex items-center justify-center">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                ) : (
                  <Package className="w-8 h-8 text-gray-300" />
                )}
              </div>
              <div className="p-3 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-sm leading-tight">{p.name}</span>
                  <Badge tone={p.active ? 'success' : 'accent'}>{p.active ? 'Aktiv' : 'Inaktiv'}</Badge>
                </div>
                <div className="text-sm text-gray-500">
                  {p.category || 'Ohne Kategorie'} · {fmt(p.price)}
                </div>
                {canEdit && (
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => setEditing(p)} title="Bearbeiten"
                            className="flex-1 border rounded-lg p-2 text-gray-600 hover:bg-gray-100 flex justify-center">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => toggleActive(p)} title={p.active ? 'Deaktivieren' : 'Aktivieren'}
                            className="flex-1 border rounded-lg p-2 text-gray-600 hover:bg-gray-100 flex justify-center">
                      {p.active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100 overflow-hidden">
          {products.map((p) => (
            <div key={p.id}
                 className={`flex items-center gap-3 p-3 hover:bg-gray-50 ${p.active ? '' : 'opacity-60'}`}>
              {/* colour strip: green = sellable, red = deactivated */}
              <span className={`w-1.5 self-stretch rounded-full shrink-0 ${p.active ? 'bg-green-500' : 'bg-red-400'}`} />
              {p.imageUrl ? (
                <img src={p.imageUrl} alt={p.name} className="w-12 h-12 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                  <Package className="w-5 h-5 text-gray-300" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate flex items-center gap-2">
                  {p.name}
                  <Badge tone={p.active ? 'success' : 'accent'}>{p.active ? 'Aktiv' : 'Inaktiv'}</Badge>
                </div>
                <div className="text-sm text-gray-500">
                  {p.category || 'Ohne Kategorie'} · {fmt(p.price)}
                </div>
              </div>
              {canEdit && (
                <>
                  <button onClick={() => setEditing(p)} title="Bearbeiten"
                          className="border rounded-lg p-2 text-gray-600 hover:bg-gray-100">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => toggleActive(p)} title={p.active ? 'Deaktivieren' : 'Aktivieren'}
                          className="border rounded-lg p-2 text-gray-600 hover:bg-gray-100">
                    {p.active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {editing && (
        <ProductForm
          product={editing === 'new' ? null : editing}
          // existing categories, derived from the products we already loaded - no extra endpoint needed
          categories={[...new Set(products.map((p) => p.category).filter(Boolean))]}
          onClose={() => setEditing(null)}
          onSaved={reload}
        />
      )}
    </div>
  )
}

function ProductForm({ product, categories, onClose, onSaved }) {
  const [name, setName] = useState(product?.name ?? '')
  const [price, setPrice] = useState(product ? String(product.price) : '')
  const [category, setCategory] = useState(product?.category ?? '')
  // "new category" mode: the chip row is replaced by a free-text input
  const [newCategoryMode, setNewCategoryMode] = useState(false)
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
        {/* category as BUTTONS: tap an existing one, or create a new one manually */}
        <div className="space-y-2">
          <span className="text-sm font-medium">Kategorie</span>
          {newCategoryMode ? (
            <div className="flex gap-2">
              <input
                autoFocus
                placeholder="Neue Kategorie…"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="flex-1 border rounded-lg px-3 py-3"
              />
              <button type="button" onClick={() => { setNewCategoryMode(false); setCategory('') }}
                      className="border rounded-lg px-3 text-gray-500 hover:bg-gray-50 flex items-center">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  // tapping the selected chip again deselects it (product without category)
                  onClick={() => setCategory(category === c ? '' : c)}
                  className={`rounded-full px-4 py-2 text-sm border ${
                    category === c ? 'bg-primary text-white border-primary' : 'bg-white border-gray-300'
                  }`}
                >
                  {c}
                </button>
              ))}
              <button type="button" onClick={() => { setNewCategoryMode(true); setCategory('') }}
                      className="rounded-full px-4 py-2 text-sm border border-dashed border-gray-400 text-gray-600">
                + Neue Kategorie
              </button>
            </div>
          )}
        </div>
        <input placeholder="Bild-URL (optional)" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="w-full border rounded-lg px-3 py-3" />
        {imageUrl && <img src={imageUrl} alt="Vorschau" className="w-20 h-20 rounded-lg object-cover" />}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 border rounded-lg py-3">Abbrechen</button>
          <button type="submit" className="flex-1 bg-primary text-white rounded-lg py-3 font-semibold">Speichern</button>
        </div>
      </form>
    </div>
  )
}
