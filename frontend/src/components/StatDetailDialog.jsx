import { useEffect } from 'react'
import { X } from 'lucide-react'

// "Where does that number come from?" - every stat tile can open this and show
// the exact rows behind it, so a figure can be double-checked on the spot
// instead of being taken on trust.
export default function StatDetailDialog({ title, subtitle, rows, total, emptyText = 'Keine Einträge.', onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
         onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
           className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col max-h-[85vh]">
        <div className="flex items-start justify-between px-4 py-3 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="font-semibold">{title}</h2>
            {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" title="Schließen">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto divide-y divide-gray-100">
          {rows.length === 0 && <div className="p-6 text-center text-gray-400 text-sm">{emptyText}</div>}
          {rows.map((row, i) => (
            <div key={row.key ?? i} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{row.label}</div>
                {row.hint && <div className="text-xs text-gray-500 truncate">{row.hint}</div>}
              </div>
              {row.value && <div className="text-sm font-semibold shrink-0">{row.value}</div>}
            </div>
          ))}
        </div>

        {/* the sum of the rows, so it can be checked against the tile it came from */}
        {total && (
          <div className="flex justify-between px-4 py-3 border-t border-gray-100 font-bold shrink-0">
            <span>{total.label}</span>
            <span>{total.value}</span>
          </div>
        )}
      </div>
    </div>
  )
}
