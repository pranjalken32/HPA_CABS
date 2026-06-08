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
  Target,
  AlertTriangle,
} from 'lucide-react'

export default function More() {
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const [cngRate, setCngRate] = useState(localStorage.getItem('hpa_cng_rate') || '95')
  const [saved, setSaved] = useState(false)

  // Incentive defaults
  const [incBase, setIncBase] = useState(localStorage.getItem('hpa_incentive_base') || '500')
  const [incStep, setIncStep] = useState(localStorage.getItem('hpa_incentive_step') || '250')
  const [incSlab, setIncSlab] = useState(localStorage.getItem('hpa_incentive_slab') || '5000')
  const [incSaved, setIncSaved] = useState(false)

  // Revenue per KM threshold
  const [rpmThreshold, setRpmThreshold] = useState(localStorage.getItem('hpa_revenue_per_km_threshold') || '12')
  const [rpmSaved, setRpmSaved] = useState(false)

  const handleSaveRate = () => {
    const rate = Number(cngRate)
    if (rate > 0) {
      localStorage.setItem('hpa_cng_rate', String(rate))
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    }
  }

  const handleSaveIncentive = () => {
    localStorage.setItem('hpa_incentive_base', String(Number(incBase) || 500))
    localStorage.setItem('hpa_incentive_step', String(Number(incStep) || 250))
    localStorage.setItem('hpa_incentive_slab', String(Number(incSlab) || 5000))
    setIncSaved(true)
    setTimeout(() => setIncSaved(false), 1500)
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

      {/* Incentive Defaults */}
      <div className="bg-surface-card rounded-2xl p-4 border border-border-dim space-y-3">
        <div className="flex items-center gap-2">
          <Target size={18} className="text-income" />
          <h3 className="text-sm font-semibold text-white">Incentive Defaults</h3>
        </div>
        <p className="text-xs text-text-muted">
          Default values used when adding a new driver. You can override per-driver in their profile.
        </p>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-[9px] text-text-muted uppercase block mb-1">Base/week (₹)</label>
            <input
              type="number"
              inputMode="numeric"
              value={incBase}
              onChange={(e) => setIncBase(e.target.value)}
              className="w-full border border-border-dim bg-surface-elevated rounded-xl px-3 py-2.5 text-sm text-white focus:border-white focus:outline-none"
              placeholder="500"
            />
          </div>
          <div>
            <label className="text-[9px] text-text-muted uppercase block mb-1">Extra/slab (₹)</label>
            <input
              type="number"
              inputMode="numeric"
              value={incStep}
              onChange={(e) => setIncStep(e.target.value)}
              className="w-full border border-border-dim bg-surface-elevated rounded-xl px-3 py-2.5 text-sm text-white focus:border-white focus:outline-none"
              placeholder="250"
            />
          </div>
          <div>
            <label className="text-[9px] text-text-muted uppercase block mb-1">Slab size (₹)</label>
            <input
              type="number"
              inputMode="numeric"
              value={incSlab}
              onChange={(e) => setIncSlab(e.target.value)}
              className="w-full border border-border-dim bg-surface-elevated rounded-xl px-3 py-2.5 text-sm text-white focus:border-white focus:outline-none"
              placeholder="5000"
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-text-muted">
            Base ₹{incBase}/week + ₹{incStep} per extra ₹{incSlab} above target
          </p>
          <button
            onClick={handleSaveIncentive}
            className="bg-white text-black font-semibold px-4 py-2 rounded-xl text-sm hover:bg-gray-200 transition-all"
          >
            Save
          </button>
        </div>
        {incSaved && (
          <div className="flex items-center gap-2 text-income text-xs">
            <CheckCircle2 size={14} /> Incentive defaults saved!
          </div>
        )}
      </div>

      {/* Revenue per KM Alert */}
      <div className="bg-surface-card rounded-2xl p-4 border border-border-dim space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle size={18} className="text-expense" />
          <h3 className="text-sm font-semibold text-white">Revenue/KM Alert</h3>
        </div>
        <p className="text-xs text-text-muted">
          Alert threshold for revenue per km. If a car's ₹/km drops below this, it flags possible unreported offline rides.
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">₹</span>
            <input
              type="number"
              inputMode="decimal"
              value={rpmThreshold}
              onChange={(e) => setRpmThreshold(e.target.value)}
              className="w-full border border-border-dim bg-surface-elevated rounded-xl pl-7 pr-12 py-2.5 text-sm text-white focus:border-white focus:outline-none"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-xs">/km</span>
          </div>
          <button
            onClick={() => {
              localStorage.setItem('hpa_revenue_per_km_threshold', String(Number(rpmThreshold) || 12))
              setRpmSaved(true)
              setTimeout(() => setRpmSaved(false), 1500)
            }}
            className="bg-white text-black font-semibold px-4 py-2.5 rounded-xl text-sm hover:bg-gray-200 transition-all"
          >
            Save
          </button>
        </div>
        {rpmSaved && (
          <div className="flex items-center gap-2 text-income text-xs">
            <CheckCircle2 size={14} /> Threshold saved!
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
