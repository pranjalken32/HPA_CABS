import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { LayoutDashboard, PlusCircle, MinusCircle, List, Car, BarChart3 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

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

  return (
    <div className="min-h-screen bg-surface pb-20">
      <header className="bg-surface-card/80 backdrop-blur-xl border-b border-border-dim px-4 py-3 sticky top-0 z-30">
        <div className="max-w-lg mx-auto flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-purple-500 flex items-center justify-center text-white text-xs font-black">
            H
          </div>
          <h1 className="text-lg font-bold tracking-tight text-text-primary">
            HPA <span className="text-accent-light">Cabs</span>
          </h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-surface-card/90 backdrop-blur-xl border-t border-border-dim z-30">
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
                  isActive ? 'text-accent-light font-semibold' : 'text-text-muted'
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
