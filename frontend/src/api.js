// The ONE place that talks to the backend. Every request goes through here,
// so the JWT header, error handling and "session expired" logic exist exactly once.

const USER_KEY = 'pos_user'

// The super admin's currently "entered" camp. Camp users don't need this - the server
// scopes them to their own camp - but a super admin has no camp of their own, so every
// camp-scoped call must say which camp. Kept here (not React state) so plain api() calls
// can read it. See campContext.jsx for the writer + the top-bar switcher.
export const ACTIVE_CAMP_KEY = 'pos_active_camp'

// Endpoints that resolve a camp on the server. For a super admin we transparently append
// their active camp, so these pages "just work" without every caller remembering to pass
// campId. A camp user is left untouched (passing a foreign campId would be a 403; their
// own camp is already implied). /api/camps and /api/users are deliberately NOT here - a
// super admin lists those across every camp.
const CAMP_SCOPED = ['/api/participants', '/api/products', '/api/sales', '/api/cash', '/api/import', '/api/audit', '/api/specials', '/api/preorders', '/api/ledger', '/api/review']

function withActiveCamp(path, user) {
  if (user?.role !== 'SUPER_ADMIN') return path
  if (/[?&]campId=/.test(path)) return path // caller already chose a camp
  const base = path.split('?')[0]
  const scoped = CAMP_SCOPED.some((p) => base === p || base.startsWith(p + '/'))
  if (!scoped) return path
  const campId = localStorage.getItem(ACTIVE_CAMP_KEY)
  if (!campId) return path
  return path + (path.includes('?') ? '&' : '?') + `campId=${campId}`
}

export function loadUser() {
  const raw = localStorage.getItem(USER_KEY)
  return raw ? JSON.parse(raw) : null
}

export function saveUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearUser() {
  localStorage.removeItem(USER_KEY)
}

export async function api(path, { method = 'GET', body } = {}) {
  const user = loadUser()
  path = withActiveCamp(path, user)

  const response = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      // attach the JWT if we have one - this is what authenticates us
      ...(user?.token ? { Authorization: `Bearer ${user.token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  // 401 = token expired or invalid -> throw away the session and start over at the login page
  if (response.status === 401 && !path.startsWith('/api/auth/')) {
    clearUser()
    window.location.href = '/login'
    throw new Error('Sitzung abgelaufen')
  }

  if (!response.ok) {
    // the backend puts a human-readable "message" into every error - surface it
    let message = `Fehler (${response.status})`
    try {
      const data = await response.json()
      if (data.message) message = data.message
      // validation errors carry a fields object: show the first field problem
      if (data.fields) message = Object.values(data.fields)[0]
    } catch {
      /* response had no JSON body - keep the generic message */
    }
    throw new Error(message)
  }

  // some endpoints return nothing
  const text = await response.text()
  return text ? JSON.parse(text) : null
}
