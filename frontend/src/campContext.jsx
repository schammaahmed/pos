import { createContext, useContext, useEffect, useState } from 'react'
import { api, ACTIVE_CAMP_KEY } from './api'
import { useAuth } from './auth'

// The "which camp am I looking at" context. A super admin oversees every camp and has
// none of their own, so they carry an *active* camp that every camp-scoped page follows;
// switching it (top-bar switcher / clicking a camp in the overview) re-scopes the whole
// app at once. A camp user is simply pinned to their own camp - no switching.
//
// The active id is mirrored into localStorage (ACTIVE_CAMP_KEY) so the plain api() helper
// can read it without going through React - the two must never disagree, so setActiveCamp
// is the single writer.
const CampContext = createContext(null)

export function CampProvider({ children }) {
  const { user } = useAuth()
  const isSuper = user?.role === 'SUPER_ADMIN'

  const [camps, setCamps] = useState([])
  const [activeCampId, setActiveCampId] = useState(() =>
    isSuper ? Number(localStorage.getItem(ACTIVE_CAMP_KEY)) || null : user?.campId ?? null,
  )

  // load the camps this user may see (all for a super admin, just their own otherwise)
  function refreshCamps() {
    if (!user) return Promise.resolve([])
    return api('/api/camps')
      .then((list) => {
        setCamps(list)
        // a super admin with no valid active camp yet defaults to the first one, so the
        // camp-scoped pages have something to show instead of erroring
        if (isSuper) {
          setActiveCampId((current) => {
            if (current && list.some((c) => c.id === current)) return current
            const first = list[0]?.id ?? null
            if (first) localStorage.setItem(ACTIVE_CAMP_KEY, String(first))
            return first
          })
        }
        return list
      })
      .catch(() => {
        setCamps([])
        return []
      })
  }

  useEffect(() => {
    refreshCamps()
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function setActiveCamp(id) {
    setActiveCampId(id)
    if (id) localStorage.setItem(ACTIVE_CAMP_KEY, String(id))
    else localStorage.removeItem(ACTIVE_CAMP_KEY)
  }

  const activeCamp = camps.find((c) => c.id === activeCampId) ?? null

  return (
    <CampContext.Provider value={{ camps, activeCampId, activeCamp, setActiveCamp, refreshCamps, isSuper }}>
      {children}
    </CampContext.Provider>
  )
}

export function useCamp() {
  return useContext(CampContext)
}
