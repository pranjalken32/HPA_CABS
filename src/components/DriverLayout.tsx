import { Outlet } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuth } from '../useAuth'
import { useLanguage } from '../useLanguage'
import Logo from './Logo'
import AppNotifications from './AppNotifications'

export default function DriverLayout() {
  const { signOut, displayName } = useAuth()
  const { t } = useLanguage()

  return (
    <div className="min-h-screen bg-surface">
      <AppNotifications />
      <header className="bg-surface-card border-b border-border-dim px-4 py-3 sticky top-0 z-30">
        <div className="max-w-lg mx-auto flex items-center gap-2">
          <Logo size={32} />
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
            title={t.signOut}
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
