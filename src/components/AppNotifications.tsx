import { useEffect, useState } from 'react'
import { WifiOff, X } from 'lucide-react'
import {
  subscribeNotifications,
  type AppNotification,
} from '../hooks/useSupabase'
import { getPendingCount, subscribeOfflineState } from '../utils/offline'

export default function AppNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [pendingCount, setPendingCount] = useState(getPendingCount())
  const [offline, setOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const unsubscribe = subscribeNotifications((notification) => {
      setNotifications((current) => [...current.filter((item) => item.message !== notification.message), notification].slice(-3))
      if (notification.kind === 'success') {
        setTimeout(() => setNotifications((current) => current.filter((item) => item.id !== notification.id)), 4000)
      }
    })
    const unsubscribeOffline = subscribeOfflineState((state) => {
      setPendingCount(state.pendingCount)
      setOffline(state.offline)
    })
    return () => {
      unsubscribe()
      unsubscribeOffline()
    }
  }, [])

  return (
    <div className="fixed top-16 left-0 right-0 z-40 px-4 pointer-events-none">
      <div className="max-w-lg mx-auto space-y-2">
        {offline && (
          <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-expense/30 bg-expense/10 px-3 py-2 text-xs text-expense">
            <WifiOff size={15} />
            <span className="flex-1">Connection unavailable. Changes may be saved offline.</span>
          </div>
        )}
        {pendingCount > 0 && (
          <div className="pointer-events-auto rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-xs text-text-primary">
            {pendingCount} offline change{pendingCount === 1 ? '' : 's'} waiting to sync.
          </div>
        )}
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`pointer-events-auto flex items-start gap-2 rounded-xl border px-3 py-2 text-xs ${
              notification.kind === 'network'
                ? 'border-expense/30 bg-expense/10 text-expense'
                : notification.kind === 'success'
                  ? 'border-income/30 bg-income/10 text-income'
                  : 'border-border-dim bg-surface-card text-text-secondary'
            }`}
          >
            <span className="min-w-0 flex-1 break-words">{notification.message}</span>
            <button
              type="button"
              onClick={() => {
                setNotifications((current) => current.filter((item) => item.id !== notification.id))
              }}
              className="min-h-6 min-w-6 shrink-0 p-1 text-current opacity-70 hover:opacity-100"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
