import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../useAuth'
import { useLanguage } from '../useLanguage'
import { LANGUAGES } from '../i18n'
import { notifyApp } from '../hooks/useSupabase'
import { parseNonNegativeNumber } from '../utils/money'
import {
  BarChart3,
  Clock,
  Fuel,
  LogOut,
  ChevronRight,
  CheckCircle2,
  Target,
  AlertTriangle,
  Globe,
} from 'lucide-react'

export default function More() {
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const { lang, t, setLang } = useLanguage()
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
    const rate = parseNonNegativeNumber(cngRate)
    if (rate !== null && rate > 0) {
      localStorage.setItem('hpa_cng_rate', String(rate))
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
    } else {
      notifyApp('error', t.invalidPositiveCngRate)
    }
  }

  const handleSaveIncentive = () => {
    const base = incBase === '' ? 500 : parseNonNegativeNumber(incBase)
    const step = incStep === '' ? 250 : parseNonNegativeNumber(incStep)
    const slab = incSlab === '' ? 5000 : parseNonNegativeNumber(incSlab)
    if (base === null || step === null || slab === null) {
      notifyApp('error', t.invalidIncentiveValues)
      return
    }
    localStorage.setItem('hpa_incentive_base', String(base))
    localStorage.setItem('hpa_incentive_step', String(step))
    localStorage.setItem('hpa_incentive_slab', String(slab))
    setIncSaved(true)
    setTimeout(() => setIncSaved(false), 1500)
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white">{t.more}</h2>

      {/* Navigation Items */}
      <div className="bg-surface-card rounded-2xl border border-border-dim overflow-hidden divide-y divide-border-dim">
        <button
          onClick={() => navigate('/analytics')}
          className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-surface-elevated transition-colors"
        >
          <div className="flex items-center gap-3">
            <BarChart3 size={18} className="text-white" />
            <span className="text-sm font-medium text-white">{t.analytics}</span>
          </div>
          <ChevronRight size={16} className="text-text-muted" />
        </button>
        <button
          onClick={() => navigate('/history')}
          className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-surface-elevated transition-colors"
        >
          <div className="flex items-center gap-3">
            <Clock size={18} className="text-white" />
            <span className="text-sm font-medium text-white">{t.history}</span>
          </div>
          <ChevronRight size={16} className="text-text-muted" />
        </button>
      </div>

      {/* Language Selector */}
      <div className="bg-surface-card rounded-2xl p-4 border border-border-dim space-y-3">
        <div className="flex items-center gap-2">
          <Globe size={18} className="text-blue-400" />
          <h3 className="text-sm font-semibold text-white">{t.language}</h3>
        </div>
        <p className="text-xs text-text-muted">{t.languageDesc}</p>
        <div className="grid grid-cols-2 gap-2">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => setLang(l.code)}
              className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                lang === l.code
                  ? 'bg-white text-black'
                  : 'bg-surface-elevated text-text-muted border border-border-dim hover:border-white/30'
              }`}
            >
              {l.native}
            </button>
          ))}
        </div>
      </div>

      {/* CNG Price Setting */}
      <div className="bg-surface-card rounded-2xl p-4 border border-border-dim space-y-3">
        <div className="flex items-center gap-2">
          <Fuel size={18} className="text-orange-400" />
          <h3 className="text-sm font-semibold text-white">{t.cngPriceSetting}</h3>
        </div>
        <p className="text-xs text-text-muted">
          {t.cngRateDesc}
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">₹</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
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
            {t.save}
          </button>
        </div>
        {saved && (
          <div className="flex items-center gap-2 text-income text-xs">
            <CheckCircle2 size={14} /> {t.cngRateSaved}
          </div>
        )}
      </div>

      {/* Incentive Defaults */}
      <div className="bg-surface-card rounded-2xl p-4 border border-border-dim space-y-3">
        <div className="flex items-center gap-2">
          <Target size={18} className="text-income" />
          <h3 className="text-sm font-semibold text-white">{t.incentiveDefaults}</h3>
        </div>
        <p className="text-xs text-text-muted">
          {t.incentiveDefaultsDesc}
        </p>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-[9px] text-text-muted uppercase block mb-1">{t.basePerWeek}</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={incBase}
              onChange={(e) => setIncBase(e.target.value)}
              className="w-full border border-border-dim bg-surface-elevated rounded-xl px-3 py-2.5 text-sm text-white focus:border-white focus:outline-none"
              placeholder="500"
            />
          </div>
          <div>
            <label className="text-[9px] text-text-muted uppercase block mb-1">{t.extraPerSlab}</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={incStep}
              onChange={(e) => setIncStep(e.target.value)}
              className="w-full border border-border-dim bg-surface-elevated rounded-xl px-3 py-2.5 text-sm text-white focus:border-white focus:outline-none"
              placeholder="250"
            />
          </div>
          <div>
            <label className="text-[9px] text-text-muted uppercase block mb-1">{t.slabSize}</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
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
            {t.save}
          </button>
        </div>
        {incSaved && (
          <div className="flex items-center gap-2 text-income text-xs">
            <CheckCircle2 size={14} /> {t.incentiveSaved}
          </div>
        )}
      </div>

      {/* Revenue per KM Alert */}
      <div className="bg-surface-card rounded-2xl p-4 border border-border-dim space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle size={18} className="text-expense" />
          <h3 className="text-sm font-semibold text-white">{t.revenueKmAlert}</h3>
        </div>
        <p className="text-xs text-text-muted">
          {t.revenueKmAlertDesc}
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">₹</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={rpmThreshold}
              onChange={(e) => setRpmThreshold(e.target.value)}
              className="w-full border border-border-dim bg-surface-elevated rounded-xl pl-7 pr-12 py-2.5 text-sm text-white focus:border-white focus:outline-none"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted text-xs">/km</span>
          </div>
          <button
            onClick={() => {
              const threshold = rpmThreshold === '' ? 12 : parseNonNegativeNumber(rpmThreshold)
              if (threshold === null || threshold <= 0) {
                notifyApp('error', t.invalidRevenueKmThreshold)
                return
              }
              localStorage.setItem('hpa_revenue_per_km_threshold', String(threshold))
              setRpmSaved(true)
              setTimeout(() => setRpmSaved(false), 1500)
            }}
            className="bg-white text-black font-semibold px-4 py-2.5 rounded-xl text-sm hover:bg-gray-200 transition-all"
          >
            {t.save}
          </button>
        </div>
        {rpmSaved && (
          <div className="flex items-center gap-2 text-income text-xs">
            <CheckCircle2 size={14} /> {t.thresholdSaved}
          </div>
        )}
      </div>

      {/* Logout */}
      <button
        onClick={signOut}
        className="w-full bg-surface-card rounded-2xl p-4 border border-border-dim flex items-center gap-3 hover:border-expense/30 transition-colors"
      >
        <LogOut size={18} className="text-expense" />
        <span className="text-sm font-medium text-expense">{t.signOut}</span>
      </button>
    </div>
  )
}
