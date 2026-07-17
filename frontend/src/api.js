// The ONE place that talks to the backend. Every request goes through here,
// so the JWT header, error handling and "session expired" logic exist exactly once.

const USER_KEY = 'pos_user'

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
