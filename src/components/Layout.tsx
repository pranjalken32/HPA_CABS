import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { LayoutDashboard, PlusCircle, MinusCircle, List, Car, BarChart3, LogOut } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '../AuthContext'

const navItems: { to: string; icon: LucideIcon; label: string; match?: string }[] = [
  { to: '/', icon: LayoutDashboard, label: 'Home' },
  { to: '/add-income', icon: PlusCircle, label: 'Income' },
  { to: '/add-expense', icon: MinusCircle, label: 'Expense' },
  { to: '/cars', icon: Car, label: 'Cars', match: '/cars' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/history', icon: List, label: 'History' },
]

export default function Layout() {
  const location = useLocation()
  const { signOut, displayName } = useAuth()

  return (
    <div className="min-h-screen bg-surface pb-20">
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
            <span className="text-xs text-text-muted ml-1 capitalize">{displayName}</span>
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

      <nav className="fixed bottom-0 left-0 right-0 bg-surface-card border-t border-border-dim z-30">
        <div className="max-w-lg mx-auto flex">
          {navItems.map(({ to, icon: Icon, label, match }) => {
            const isActive = match
              ? location.pathname.startsWith(match)
              : location.pathname === to
            return (
              <NavLink
                key={to}
                to={to}
                className={`flex-1 flex flex-col items-center py-2.5 text-[10px] transition-colors ${
                  isActive ? 'text-white font-semibold' : 'text-text-muted'
                }`}
              >
                <Icon size={20} />
                <span className="mt-0.5">{label}</span>
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
