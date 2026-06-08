import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import {
  BarChart3,
  Clock,
  Fuel,
  LogOut,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react'

export default function More() {
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const [cngRate, setCngRate] = useState(localStorage.getItem('hpa_cng_rate') || '95')
  const [saved, setSaved] = useState(false)

  const handleSaveRate = () => {
    const rate = Number(cngRate)
    if (rate > 0) {
      localStorage.setItem('hpa_cng_rate', String(rate))
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white">More</h2>

      {/* Navigation Items */}
      <div className="bg-surface-card rounded-2xl border border-border-dim overflow-hidden divide-y divide-border-dim">
        <button
          onClick={() => navigate('/analytics')}
          className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-surface-elevated transition-colors"
        >
          <div className="flex items-center gap-3">
            <BarChart3 size={18} className="text-white" />
            <span className="text-sm font-medium text-white">Analytics</span>
          </div>
          <ChevronRight size={16} className="text-text-muted" />
        </button>
        <button
          onClick={() => navigate('/history')}
          className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-surface-elevated transition-colors"
        >
          <div className="flex items-center gap-3">
            <Clock size={18} className="text-white" />
            <span className="text-sm font-medium text-white">History</span>
          </div>
          <ChevronRight size={16} className="text-text-muted" />
        </button>
      </div>

      {/* CNG Price Setting */}
      <div className="bg-surface-card rounded-2xl p-4 border border-border-dim space-y-3">
        <div className="flex items-center gap-2">
          <Fuel size={18} className="text-orange-400" />
          <h3 className="text-sm font-semibold text-white">CNG Price Setting</h3>
        </div>
        <p className="text-xs text-text-muted">
          Set the current CNG rate. This is used to auto-calculate quantity (kg) when you enter fuel amount.
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">₹</span>
            <input
              type="number"
              inputMode="decimal"
              value={cngRate}
              onChange={(e) => setCngRate(e.target.value)}
              className="w-full border border-border-dim bg-surface-elevated rounded-xl pl-7 pr-12 py-2.5 text-sm text-white focus:border-white focus:outline-none"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-xs">/kg</span>
          </div>
          <button
            onClick={handleSaveRate}
            className="bg-white text-black font-semibold px-4 py-2.5 rounded-xl text-sm hover:bg-gray-200 transition-all"
          >
            Save
          </button>
        </div>
        {saved && (
          <div className="flex items-center gap-2 text-income text-xs">
            <CheckCircle2 size={14} /> CNG rate saved!
          </div>
        )}
      </div>

      {/* Logout */}
      <button
        onClick={signOut}
        className="w-full bg-surface-card rounded-2xl p-4 border border-border-dim flex items-center gap-3 hover:border-expense/30 transition-colors"
      >
        <LogOut size={18} className="text-expense" />
        <span className="text-sm font-medium text-expense">Sign Out</span>
      </button>
    </div>
  )
}
