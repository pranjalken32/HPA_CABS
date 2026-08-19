import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { LayoutDashboard, PlusCircle, MinusCircle, Car, Users, MoreHorizontal } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '../useAuth'
import { useLanguage } from '../useLanguage'
import Logo from './Logo'
import AppNotifications from './AppNotifications'

type NavItem = { to: string; icon: LucideIcon; labelKey: 'dashboard' | 'income' | 'expenses' | 'cars' | 'drivers' | 'more'; match?: string }

const navItems: NavItem[] = [
  { to: '/', icon: LayoutDashboard, labelKey: 'dashboard' },
  { to: '/add-income', icon: PlusCircle, labelKey: 'income' },
  { to: '/add-expense', icon: MinusCircle, labelKey: 'expenses' },
  { to: '/cars', icon: Car, labelKey: 'cars', match: '/cars' },
  { to: '/drivers', icon: Users, labelKey: 'drivers' },
  { to: '/more', icon: MoreHorizontal, labelKey: 'more', match: '/more' },
]

export default function Layout() {
  const location = useLocation()
  const { displayName } = useAuth()
  const { t } = useLanguage()

  return (
    <div className="min-h-screen bg-surface pb-20">
      <AppNotifications />
      <header className="bg-surface-card border-b border-border-dim px-4 py-3 sticky top-0 z-30">
        <div className="max-w-lg mx-auto flex items-center gap-2">
          <Logo size={32} />
          <h1 className="text-lg font-bold tracking-tight text-white">
            HPA <span className="text-text-secondary">Cabs</span>
          </h1>
          {displayName && (
            <span className="text-xs text-text-muted ml-auto capitalize">{displayName}</span>
          )}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-4">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-surface-card border-t border-border-dim z-30">
        <div className="max-w-lg mx-auto flex">
          {navItems.map(({ to, icon: Icon, labelKey, match }) => {
            const isActive = match === '/more'
              ? ['/more', '/analytics', '/history'].some(p => location.pathname.startsWith(p))
              : match
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
                <span className="mt-0.5">{t[labelKey]}</span>
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
