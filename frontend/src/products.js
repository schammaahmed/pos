// Product helpers shared by every screen that lists products (self-serve menu,
// Rundgang, and anywhere else that needs the same visual grouping).

/**
 * Groups products into [category, products[]] pairs, preserving the order the API
 * returned them in (the backend already sorts by category, then name).
 *
 * Uncategorised products collapse under the '' key so callers can decide whether to
 * render a heading - `{category && <h3>…</h3>}` - rather than inventing a "Sonstige"
 * bucket that would need translating.
 */
export function groupByCategory(products) {
  const map = new Map()
  for (const p of products) {
    const key = p.category ?? ''
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(p)
  }
  return [...map.entries()]
}
