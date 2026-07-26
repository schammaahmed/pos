// The participant side has its own auth and its own tiny API helper. Kept COMPLETELY
// separate from the staff api()/loadUser so the two token schemes can never mix up:
// a participant hitting a staff endpoint or vice versa would be a bug that must not
// silently look like it works.

const SELF_KEY = 'pos_self'

// { token, participantId, firstName, lastName, campId, campName }
export function loadSelf() {
  const raw = localStorage.getItem(SELF_KEY)
  return raw ? JSON.parse(raw) : null
}
export function saveSelf(self) {
  localStorage.setItem(SELF_KEY, JSON.stringify(self))
}
export function clearSelf() {
  localStorage.removeItem(SELF_KEY)
}

/** Calls /api/public/* and /api/self/*. Adds the participant JWT for /api/self/*. */
export async function selfApi(path, { method = 'GET', body } = {}) {
  const self = loadSelf()
  const needsAuth = path.startsWith('/api/self/')

  const response = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(needsAuth && self?.token ? { Authorization: `Bearer ${self.token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  // 401 on a /self/* call = the token's dead. Wipe it and start over at the QR landing.
  if (response.status === 401 && needsAuth) {
    clearSelf()
    // no hard redirect here - the caller decides whether the page should re-mount
    throw new Error('Sitzung abgelaufen – bitte QR-Code erneut scannen.')
  }

  if (!response.ok) {
    let message = `Fehler (${response.status})`
    try {
      const data = await response.json()
      if (data.message) message = data.message
      if (data.fields) message = Object.values(data.fields)[0]
    } catch { /* body wasn't JSON */ }
    throw new Error(message)
  }

  const text = await response.text()
  return text ? JSON.parse(text) : null
}
