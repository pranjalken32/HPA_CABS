import { useState } from 'react'
import { useAuth } from '../AuthContext'

export default function Login() {
  const { signIn, signUp } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [signUpSuccess, setSignUpSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const err = isSignUp
      ? await signUp(email, password)
      : await signIn(email, password)

    setLoading(false)

    if (err) {
      setError(err)
    } else if (isSignUp) {
      setSignUpSuccess(true)
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
          <p className="text-sm text-text-muted mt-1">
            {isSignUp ? 'Create your account' : 'Sign in to continue'}
          </p>
        </div>

        {signUpSuccess ? (
          <div className="bg-surface-card rounded-2xl border border-border-dim p-6 text-center">
            <p className="text-income font-medium mb-2">Account created!</p>
            <p className="text-sm text-text-secondary">
              Check your email to confirm, then sign in.
            </p>
            <button
              onClick={() => { setIsSignUp(false); setSignUpSuccess(false) }}
              className="mt-4 text-accent text-sm font-medium"
            >
              Go to Sign In
            </button>
          </div>
        ) : (
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
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-accent to-accent-light text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-accent/20 disabled:opacity-60"
            >
              {loading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
            </button>

            <p className="text-center text-sm text-text-muted">
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
              <button
                type="button"
                onClick={() => { setIsSignUp(!isSignUp); setError(null) }}
                className="text-accent font-medium"
              >
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
