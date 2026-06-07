import { Outlet } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuth } from '../AuthContext'

export default function DriverLayout() {
  const { signOut, displayName } = useAuth()

  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-surface-card border-b border-border-dim px-4 py-3 sticky top-0 z-30">
        <div className="max-w-lg mx-auto flex items-center gap-2">
          <svg className="w-8 h-8" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" rx="20" fill="#000000"/>
            <rect x="6" y="6" width="88" height="88" rx="16" fill="none" stroke="#222222" strokeWidth="1.5"/>
            <path d="M30 28 L30 72 M30 50 L70 50 M70 28 L70 72" stroke="#ffffff" strokeWidth="10" strokeLinecap="round" fill="none"/>
          </svg>
          <h1 className="text-lg font-bold tracking-tight text-white">
            HPA <span className="text-text-secondary">Cabs</span>
          </h1>
          {displayName && (
            <span className="text-xs bg-white/10 text-text-secondary px-2 py-0.5 rounded-full ml-1 capitalize">
              {displayName} · Driver
            </span>
          )}
          <button
            onClick={() => signOut()}
            className="ml-auto text-text-muted hover:text-white transition-colors"
            title="Sign out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4">
        <Outlet />
      </main>
    </div>
  )
}
