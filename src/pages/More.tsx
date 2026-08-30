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
  const [dailySlabs, setDailySlabs] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('hpa_incentive_slabs') || 'null')
      if (Array.isArray(stored)) {
        return stored.map((slab) => ({
          revenue: String(slab.revenue ?? ''),
          incentive: String(slab.incentive ?? ''),
        }))
      }
    } catch {
      // Use the agreed defaults below.
    }
    return [
      { revenue: '3000', incentive: '100' },
      { revenue: '3500', incentive: '200' },
      { revenue: '4000', incentive: '400' },
      { revenue: '4500', incentive: '650' },
    ]
  })
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
    const slabs = dailySlabs.map((slab) => ({
      revenue: parseNonNegativeNumber(slab.revenue),
      incentive: parseNonNegativeNumber(slab.incentive),
    }))
    if (slabs.some((slab) => slab.revenue === null || slab.incentive === null)) {
      notifyApp('error', t.invalidIncentiveValues)
      return
    }
    localStorage.setItem('hpa_incentive_slabs', JSON.stringify(slabs))
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
        <div className="space-y-2">
          {dailySlabs.map((slab, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="text-xs text-text-muted">{t.revenueThreshold}</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={slab.revenue}
                onChange={(e) => setDailySlabs((current) => current.map((item, i) => i === index ? { ...item, revenue: e.target.value } : item))}
                className="w-24 border border-border-dim bg-surface-elevated rounded-xl px-2 py-2 text-sm text-white focus:border-white focus:outline-none"
              />
              <span className="text-xs text-text-muted">{t.incentiveAmount}</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={slab.incentive}
                onChange={(e) => setDailySlabs((current) => current.map((item, i) => i === index ? { ...item, incentive: e.target.value } : item))}
                className="w-24 border border-border-dim bg-surface-elevated rounded-xl px-2 py-2 text-sm text-white focus:border-white focus:outline-none"
              />
              <button type="button" onClick={() => setDailySlabs((current) => current.filter((_, i) => i !== index))} className="text-text-muted hover:text-white">
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setDailySlabs((current) => [...current, { revenue: '', incentive: '' }])}
            className="text-xs text-text-secondary underline"
          >
            + {t.addSlab}
          </button>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-text-muted">{t.defaultDailySlabs}</p>
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
