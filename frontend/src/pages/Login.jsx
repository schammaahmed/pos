import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault() // stop the browser from doing a full-page form submit
    setError(null)
    setBusy(true)
    try {
      const user = await login(email, password)
      // everyone lands on the seller panel except the super admin (no camp -> admin area)
      navigate(user.role === 'SUPER_ADMIN' ? '/admin' : '/sell')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-page flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow p-6 w-full max-w-sm space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Verkaufsstand</h1>
          <p className="text-sm text-gray-500">Verkaufsstand-Login</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3">{error}</div>
        )}

        <input
          type="email"
          required
          autoComplete="email"
          placeholder="E-Mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base"
        />
        <input
          type="password"
          required
          autoComplete="current-password"
          placeholder="Passwort"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-3 text-base"
        />

        <button
          type="submit"
          disabled={busy}
          className="w-full bg-primary text-white rounded-lg py-3 font-semibold disabled:opacity-50"
        >
          {busy ? 'Anmelden…' : 'Anmelden'}
        </button>
      </form>
    </div>
  )
}
