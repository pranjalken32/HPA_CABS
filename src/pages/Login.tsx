import { useState } from 'react'
import { useAuth } from '../AuthContext'
import { Shield } from 'lucide-react'

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
    <div className="min-h-screen bg-surface-base flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent to-accent-light flex items-center justify-center text-white font-bold text-2xl mx-auto mb-3">
            H
          </div>
          <h1 className="text-2xl font-bold text-text-primary">HPA Cabs</h1>
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
              className="w-full border border-border-dim bg-surface-elevated rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none transition-colors"
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
              className="w-full border border-border-dim bg-surface-elevated rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none transition-colors"
              placeholder="••••••••"
              minLength={6}
              required
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-accent to-accent-light text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-accent/20 disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 bg-surface-card rounded-2xl border border-border-dim p-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield size={16} className="text-accent" />
            <span className="text-xs font-medium text-text-secondary">Authorized Users Only</span>
          </div>
          <div className="flex gap-2">
            {['Hemant', 'Anurag', 'Pranjal'].map((name) => (
              <span
                key={name}
                className="px-3 py-1 bg-accent/10 border border-accent/20 rounded-full text-xs text-accent font-medium"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
