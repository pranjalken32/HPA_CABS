import { useState } from 'react'
import { useAuth } from '../AuthContext'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const err = await signIn(email, password)
    setLoading(false)

    if (err) {
      setError(err)
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <svg className="w-16 h-16 mx-auto mb-3" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" rx="20" fill="#000000"/>
            <rect x="6" y="6" width="88" height="88" rx="16" fill="none" stroke="#222222" strokeWidth="1.5"/>
            <path d="M30 28 L30 72 M30 50 L70 50 M70 28 L70 72" stroke="#ffffff" strokeWidth="10" strokeLinecap="round" fill="none"/>
            <line x1="35" y1="90" x2="45" y2="90" stroke="#444444" strokeWidth="2" strokeLinecap="round"/>
            <line x1="50" y1="90" x2="60" y2="90" stroke="#444444" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <h1 className="text-2xl font-bold text-white tracking-tight">HPA Cabs</h1>
          <p className="text-sm text-text-muted mt-1">Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface-card rounded-2xl border border-border-dim p-6 space-y-4">
          {error && (
            <div className="bg-expense/10 border border-expense/30 rounded-xl px-3 py-2 text-sm text-expense">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-border-dim bg-surface-elevated rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-text-muted focus:border-white focus:outline-none transition-colors"
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-border-dim bg-surface-elevated rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-text-muted focus:border-white focus:outline-none transition-colors"
              placeholder="••••••••"
              minLength={6}
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-black font-semibold py-3 rounded-xl transition-all hover:bg-gray-200 disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
