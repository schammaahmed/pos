import { createContext, useContext, useState } from 'react'
import { api, loadUser, saveUser, clearUser } from './api'

// React Context = data available to EVERY component without passing props down.
// Here: "who is logged in" - needed by the router, the nav bar, and every page.
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // initial value comes from localStorage, so a page refresh keeps you logged in
  const [user, setUser] = useState(loadUser)

  async function login(email, password) {
    const data = await api('/api/auth/login', { method: 'POST', body: { email, password } })
    saveUser(data) // token + name + role + camp, all in one object
    setUser(data)
    return data
  }

  function logout() {
    clearUser()
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}

// convenience: is this role allowed to manage things? (products, participants, reversal review)
export function isLead(user) {
  return ['SUPER_ADMIN', 'CAMP_ADMIN', 'SELLER_LEAD'].includes(user?.role)
}
