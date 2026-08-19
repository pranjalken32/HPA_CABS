import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  useCar, useCarDocuments, useServiceRecords, useIncomes, useExpenses, useFuelLogs,
  addCarDocument, addServiceRecord, addFuelLog, updateFuelLog,
  deleteCarDocument, deleteServiceRecord, deleteCar, deleteFuelLog,
  uploadCarDocFile, getSignedUrl,
} from '../hooks/useSupabase'
import { useAuth } from '../AuthContext'
import { useLanguage } from '../LanguageContext'
import {
  ArrowLeft,
  FileText,
  Wrench,
  TrendingUp,
  Plus,
  Trash2,
  Edit2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Fuel,
  Upload,
  Eye,
} from 'lucide-react'

const DOC_TYPES = [
  'Insurance',
  'Permit',
  'PUC',
  'Fitness Certificate',
  'Road Tax',
  'Registration (RC)',
  'Other',
]

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function fmt(n: number): string {
  return n.toLocaleString('en-IN')
}

type Tab = 'docs' | 'recovery' | 'service' | 'fuel'

export default function CarDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { role } = useAuth()
  const { t } = useLanguage()
  const isOwner = role === 'owner'
  const carId = Number(id)

  const car = useCar(carId)
  const docs = useCarDocuments(carId)
  const services = useServiceRecords(carId)
  const incomes = useIncomes('2000-01-01', '2099-12-31')
  const carIncomes = incomes.filter((i) => i.car_id === carId)
  const allExpenses = useExpenses('2000-01-01', '2099-12-31')
  const carExpenses = allExpenses.filter((e) => e.car_id === carId)

  const fuelLogs = useFuelLogs(carId)
  const [tab, setTab] = useState<Tab>('docs')

  // Fuel form
  const [showFuelForm, setShowFuelForm] = useState(false)
  const [fuelDate, setFuelDate] = useState(todayStr())
  const [fuelAmount, setFuelAmount] = useState('')
  const [fuelOdo, setFuelOdo] = useState('')
  const [fuelType, setFuelType] = useState<'cng' | 'petrol'>('cng')
  const [editingFuelId, setEditingFuelId] = useState<number | null>(null)
  const cngRate = Number(localStorage.getItem('hpa_cng_rate') || '95')

  // Doc form
  const [showDocForm, setShowDocForm] = useState(false)
  const [docType, setDocType] = useState(DOC_TYPES[0])
  const [docExpiry, setDocExpiry] = useState('')
  const [docNote, setDocNote] = useState('')
  const [docFile, setDocFile] = useState<File | null>(null)
  const [docUploading, setDocUploading] = useState(false)

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'fuel' | 'service' | 'doc'; id: number } | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Service form
  const [showServiceForm, setShowServiceForm] = useState(false)
  const [svcDate, setSvcDate] = useState(todayStr())
  const [svcDesc, setSvcDesc] = useState('')
  const [svcCost, setSvcCost] = useState('')
  const [svcOdo, setSvcOdo] = useState('')

  const resetFuelForm = () => {
    setFuelDate(todayStr())
    setFuelAmount('')
    setFuelOdo('')
    setFuelType('cng')
    setEditingFuelId(null)
  }

  if (!car) {
    return (
      <div className="text-center py-12 text-text-muted">
        <p>Loading...</p>
      </div>
    )
  }

  const totalGrossIncome = carIncomes.reduce((s, i) => s + i.amount, 0)
  const nonServiceExpenses = carExpenses.filter((e) => e.category !== 'Service' && e.category !== 'service')
  const totalCarExpenses = nonServiceExpenses.reduce((s, e) => s + e.amount, 0)
  const totalServiceCost = services?.reduce((s, r) => s + r.cost, 0) ?? 0
  const totalRecovered = Math.max(totalGrossIncome - totalCarExpenses - totalServiceCost, 0)
  const recoveryPercent = car.total_cost > 0 ? Math.min((totalRecovered / car.total_cost) * 100, 100) : 0
  const remaining = Math.max(car.total_cost - totalRecovered, 0)

  // Estimate time to recover based on monthly average
  const monthsActive = (() => {
    if (carIncomes.length === 0) return 0
    const dates = carIncomes.map((i) => new Date(i.date).getTime())
    const earliest = Math.min(...dates)
    const latest = Math.max(...dates)
    const diffMs = latest - earliest
    return Math.max(diffMs / (1000 * 60 * 60 * 24 * 30), 1)
  })()
  const monthlyAvg = monthsActive > 0 ? totalRecovered / monthsActive : 0
  const monthsToRecover = monthlyAvg > 0 ? Math.ceil(remaining / monthlyAvg) : 0

  const handleAddDoc = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!docExpiry) return
    let file_url: string | null = null
    if (docFile) {
      setDocUploading(true)
      try {
        file_url = await uploadCarDocFile(docFile)
      } catch {
        // Continue without file if upload fails
      }
      setDocUploading(false)
    }
    await addCarDocument({
      car_id: carId,
      doc_type: docType,
      expiry_date: docExpiry,
      note: docNote.trim(),
      file_url,
    })
    setDocExpiry('')
    setDocNote('')
    setDocFile(null)
    setShowDocForm(false)
  }

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!svcDesc.trim()) return
    const cost = Number(svcCost) || 0
    await addServiceRecord({
      car_id: carId,
      date: svcDate,
      description: svcDesc.trim(),
      cost,
      odometer_km: Number(svcOdo) || 0,
    })
    setSvcDesc('')
    setSvcCost('')
    setSvcOdo('')
    setShowServiceForm(false)
  }

  const handleDeleteCar = async () => {
    if (!confirm(`Delete "${car.name}" and all its data?`)) return
    await deleteCar(carId)
    navigate('/cars')
  }

  const handleSaveFuel = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fuelAmount || Number(fuelAmount) <= 0) return
    const totalCost = Number(fuelAmount)
    const price = fuelType === 'cng' ? cngRate : 0
    const qty = price > 0 ? Math.round((totalCost / price) * 100) / 100 : 0
    const fuelData = {
      car_id: carId,
      date: fuelDate,
      quantity_kg: qty,
      price_per_kg: price,
      total_cost: totalCost,
      odometer_km: fuelType === 'cng' ? (Number(fuelOdo) || 0) : 0,
      fuel_type: fuelType,
    }
    if (editingFuelId !== null) {
      await updateFuelLog(editingFuelId, fuelData)
    } else {
      await addFuelLog(fuelData)
    }
    resetFuelForm()
    setShowFuelForm(false)
  }

  const handleEditFuel = (log: typeof fuelLogs[number]) => {
    setFuelDate(log.date)
    setFuelAmount(String(log.total_cost))
    setFuelOdo(log.odometer_km > 0 ? String(log.odometer_km) : '')
    setFuelType(log.fuel_type)
    setEditingFuelId(log.id)
    setShowFuelForm(true)
  }

  // Fuel efficiency calculation (CNG only)
  const cngLogs = fuelLogs.filter((l) => l.fuel_type !== 'petrol')
  const fuelEfficiency = (() => {
    if (cngLogs.length < 2) return null
    const sorted = [...cngLogs].sort((a, b) => a.odometer_km - b.odometer_km)
    const validLogs = sorted.filter((l) => l.odometer_km > 0)
    if (validLogs.length < 2) return null
    const totalKm = validLogs[validLogs.length - 1].odometer_km - validLogs[0].odometer_km
    const totalKg = validLogs.slice(1).reduce((s, l) => s + l.quantity_kg, 0)
    return totalKg > 0 ? totalKm / totalKg : null
  })()

  // Revenue per KM — detect offline rides (CNG odometer only)
  const revenuePerKm = (() => {
    const validLogs = [...cngLogs].filter((l) => l.odometer_km > 0).sort((a, b) => a.odometer_km - b.odometer_km)
    if (validLogs.length < 2) return null
    const firstLog = validLogs[0]
    const lastLog = validLogs[validLogs.length - 1]
    const totalKmDriven = lastLog.odometer_km - firstLog.odometer_km
    if (totalKmDriven <= 0) return null
    // Get income between the first and last fuel log dates
    const startD = firstLog.date
    const endD = lastLog.date
    const periodIncome = carIncomes.filter((i) => i.date >= startD && i.date <= endD)
    const periodRevenue = periodIncome.reduce((s, i) => s + i.amount, 0)
    return { perKm: periodRevenue / totalKmDriven, totalKm: totalKmDriven, revenue: periodRevenue }
  })()
  const revenuePerKmThreshold = Number(localStorage.getItem('hpa_revenue_per_km_threshold') || '12')

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'docs', label: 'Docs', icon: <FileText size={14} /> },
    { key: 'recovery', label: 'Recovery', icon: <TrendingUp size={14} /> },
    { key: 'service', label: 'Service', icon: <Wrench size={14} /> },
    { key: 'fuel', label: 'Fuel', icon: <Fuel size={14} /> },
  ]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/cars')} className="text-text-muted hover:text-text-primary transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-text-primary">{car.name}</h2>
          <p className="text-xs text-text-muted font-mono">{car.number}</p>
        </div>
        {isOwner && (
          <button onClick={handleDeleteCar} className="text-text-muted hover:text-expense transition-colors p-1">
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex bg-surface-card rounded-xl border border-border-dim p-1 gap-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
              tab === t.key
                ? 'bg-white text-black'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Documents Tab */}
      {tab === 'docs' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-secondary">Documents & Expiry</h3>
            {isOwner && (
              <button
                onClick={() => setShowDocForm(!showDocForm)}
                className="flex items-center gap-1 text-white text-xs font-semibold"
              >
                <Plus size={14} /> Add
              </button>
            )}
          </div>

          {showDocForm && (
            <form onSubmit={handleAddDoc} className="bg-surface-elevated rounded-xl p-3 border border-border-dim space-y-2">
              <div>
                <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">Document Type</label>
                <div className="flex flex-wrap gap-1.5">
                  {DOC_TYPES.map((dt) => (
                    <button
                      key={dt}
                      type="button"
                      onClick={() => setDocType(dt)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                        docType === dt
                          ? 'bg-white text-black'
                          : 'bg-surface-card text-text-muted border border-border-dim'
                      }`}
                    >
                      {dt}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">Expiry Date</label>
                <input
                  type="date"
                  value={docExpiry}
                  onChange={(e) => setDocExpiry(e.target.value)}
                  className="w-full border border-border-dim bg-surface-card rounded-lg px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">Note (optional)</label>
                <input
                  type="text"
                  value={docNote}
                  onChange={(e) => setDocNote(e.target.value)}
                  placeholder="e.g. Policy #12345"
                  className="w-full border border-border-dim bg-surface-card rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">Upload Document (optional)</label>
                <label className="flex items-center gap-2 border border-border-dim bg-surface-card rounded-lg px-3 py-2 cursor-pointer hover:border-white/30 transition-colors">
                  <Upload size={14} className="text-text-muted shrink-0" />
                  <span className="text-sm text-text-muted truncate">
                    {docFile ? docFile.name : 'Choose file (image/PDF)'}
                  </span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
              <button
                type="submit"
                disabled={docUploading}
                className="w-full bg-white text-black font-semibold py-2 rounded-lg text-xs disabled:opacity-50"
              >
                {docUploading ? 'Uploading...' : 'Save Document'}
              </button>
            </form>
          )}

          {(docs?.length ?? 0) === 0 && !showDocForm && (
            <p className="text-center text-text-muted text-sm py-6">No documents added yet</p>
          )}

          {docs?.sort((a, b) => a.expiry_date.localeCompare(b.expiry_date)).map((doc) => {
            const days = daysUntil(doc.expiry_date)
            const isExpired = days < 0
            const isExpiring = days >= 0 && days <= 30
            return (
              <div
                key={doc.id}
                className={`bg-surface-card rounded-xl p-3 border flex items-center gap-3 ${
                  isExpired
                    ? 'border-expense/40'
                    : isExpiring
                    ? 'border-yellow-500/40'
                    : 'border-border-dim'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    isExpired
                      ? 'bg-expense/10 text-expense'
                      : isExpiring
                      ? 'bg-yellow-500/10 text-yellow-400'
                      : 'bg-income/10 text-income'
                  }`}
                >
                  {isExpired ? <AlertTriangle size={16} /> : isExpiring ? <Clock size={16} /> : <CheckCircle2 size={16} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-primary">{doc.doc_type}</p>
                  <p className="text-[11px] text-text-muted">
                    {isExpired
                      ? `Expired ${Math.abs(days)} days ago`
                      : isExpiring
                      ? `Expires in ${days} days`
                      : `Valid until ${doc.expiry_date}`}
                  </p>
                  {doc.note && <p className="text-[10px] text-text-muted mt-0.5">{doc.note}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {doc.file_url && (
                    <button
                      onClick={async () => {
                        const url = await getSignedUrl(doc.file_url!)
                        if (url) window.open(url, '_blank')
                      }}
                      className="text-text-muted hover:text-income transition-colors"
                      title="View document"
                    >
                      <Eye size={14} />
                    </button>
                  )}
                  {isOwner && (
                    <button
                      onClick={() => setDeleteConfirm({ type: 'doc', id: doc.id })}
                      className="text-text-muted hover:text-expense transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Recovery Tab */}
      {tab === 'recovery' && (
        <div className="space-y-4">
          {/* Progress ring / bar */}
          <div className="bg-surface-card rounded-2xl p-5 border border-border-dim text-center space-y-4">
            <h3 className="text-sm font-semibold text-text-secondary">Net Recovery</h3>

            {/* Circular progress */}
            <div className="relative w-32 h-32 mx-auto">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#222222" strokeWidth="8" />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke={recoveryPercent >= 100 ? '#06c167' : '#ffffff'}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${recoveryPercent * 2.64} 264`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black text-text-primary">{recoveryPercent.toFixed(0)}%</span>
                <span className="text-[10px] text-text-muted">net recovered</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface-elevated rounded-xl p-3">
                <p className="text-[10px] text-text-muted uppercase tracking-wider">Car Cost</p>
                <p className="text-sm font-bold text-text-primary">₹{fmt(car.total_cost)}</p>
              </div>
              <div className="bg-surface-elevated rounded-xl p-3">
                <p className="text-[10px] text-text-muted uppercase tracking-wider">Net Recovered</p>
                <p className="text-sm font-bold text-income">₹{fmt(totalRecovered)}</p>
              </div>
              <div className="bg-surface-elevated rounded-xl p-3">
                <p className="text-[10px] text-text-muted uppercase tracking-wider">Gross Income</p>
                <p className="text-sm font-bold text-white">₹{fmt(totalGrossIncome)}</p>
              </div>
              <div className="bg-surface-elevated rounded-xl p-3">
                <p className="text-[10px] text-text-muted uppercase tracking-wider">Car Expenses</p>
                <p className="text-sm font-bold text-expense">₹{fmt(totalCarExpenses + totalServiceCost)}</p>
              </div>
              <div className="bg-surface-elevated rounded-xl p-3 col-span-2">
                <p className="text-[10px] text-text-muted uppercase tracking-wider">Remaining to Recover</p>
                <p className="text-sm font-bold text-yellow-400">₹{fmt(remaining)}</p>
              </div>
            </div>

            <div className="bg-surface-elevated rounded-xl p-3 text-left">
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Breakdown</p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-text-muted">Gross income from car</span><span className="text-white">₹{fmt(totalGrossIncome)}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">− Fuel/EMI/Expenses</span><span className="text-expense">−₹{fmt(totalCarExpenses)}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">− Service costs</span><span className="text-expense">−₹{fmt(totalServiceCost)}</span></div>
                <div className="flex justify-between border-t border-border-dim pt-1 mt-1"><span className="text-text-secondary font-semibold">= Net recovered</span><span className="text-income font-bold">₹{fmt(totalRecovered)}</span></div>
              </div>
            </div>

            {monthlyAvg > 0 && remaining > 0 && (
              <div className="bg-surface-elevated rounded-xl p-3">
                <p className="text-[10px] text-text-muted uppercase tracking-wider">Est. Time to Recover</p>
                <p className="text-sm font-bold text-white">
                  ~{monthsToRecover} month{monthsToRecover !== 1 ? 's' : ''}
                </p>
                <p className="text-[10px] text-text-muted mt-0.5">
                  Based on ₹{fmt(Math.round(monthlyAvg))}/month net avg
                </p>
              </div>
            )}

            {car.total_cost === 0 && (
              <p className="text-xs text-text-muted">Set car total cost to see recovery progress</p>
            )}
          </div>
        </div>
      )}

      {/* Fuel Tab */}
      {tab === 'fuel' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-secondary">CNG / Fuel Log</h3>
            {isOwner && (
              <button
                onClick={() => {
                  if (showFuelForm) {
                    resetFuelForm()
                    setShowFuelForm(false)
                  } else {
                    setEditingFuelId(null)
                    setShowFuelForm(true)
                  }
                }}
                className="flex items-center gap-1 text-white text-xs font-semibold"
              >
                <Plus size={14} /> {editingFuelId !== null ? 'Cancel Edit' : 'Add'}
              </button>
            )}
          </div>

          {/* Efficiency card */}
          {fuelEfficiency !== null && (
            <div className="bg-surface-card rounded-2xl p-4 border border-border-dim text-center">
              <p className="text-[10px] text-text-muted uppercase tracking-wider">Avg Fuel Efficiency</p>
              <p className="text-2xl font-black text-white">{fuelEfficiency.toFixed(1)} km/kg</p>
              <p className="text-[10px] text-text-muted mt-1">
                Based on {fuelLogs.length} fill-ups
              </p>
            </div>
          )}

          {/* Revenue per KM — owner only */}
          {isOwner && revenuePerKm && (
            <div className={`rounded-2xl p-4 border text-center ${
              revenuePerKm.perKm < revenuePerKmThreshold
                ? 'bg-expense/10 border-expense/30'
                : 'bg-surface-card border-border-dim'
            }`}>
              <p className="text-[10px] text-text-muted uppercase tracking-wider">Revenue per KM</p>
              <p className={`text-2xl font-black ${
                revenuePerKm.perKm < revenuePerKmThreshold ? 'text-expense' : 'text-income'
              }`}>
                ₹{revenuePerKm.perKm.toFixed(1)}/km
              </p>
              {revenuePerKm.perKm < revenuePerKmThreshold && (
                <p className="text-xs text-expense mt-1 font-semibold">
                  ⚠ Below ₹{revenuePerKmThreshold}/km — possible unreported rides
                </p>
              )}
              <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
                <div className="bg-black/20 rounded-lg p-2">
                  <p className="text-text-muted">KM Driven</p>
                  <p className="text-white font-bold">{fmt(revenuePerKm.totalKm)} km</p>
                </div>
                <div className="bg-black/20 rounded-lg p-2">
                  <p className="text-text-muted">Revenue Logged</p>
                  <p className="text-white font-bold">₹{fmt(revenuePerKm.revenue)}</p>
                </div>
              </div>
            </div>
          )}

          {showFuelForm && (
            <form onSubmit={handleSaveFuel} className="bg-surface-elevated rounded-xl p-3 border border-border-dim space-y-2">
              {/* Fuel Type Toggle */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFuelType('cng')}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
                    fuelType === 'cng' ? 'bg-white text-black' : 'bg-surface-card text-text-muted border border-border-dim'
                  }`}
                >
                  {t.cng}
                </button>
                <button
                  type="button"
                  onClick={() => setFuelType('petrol')}
                  className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
                    fuelType === 'petrol' ? 'bg-orange-500 text-white' : 'bg-surface-card text-text-muted border border-border-dim'
                  }`}
                >
                  {t.petrol}
                </button>
              </div>
              <div>
                <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">{t.date}</label>
                <input
                  type="date"
                  value={fuelDate}
                  onChange={(e) => setFuelDate(e.target.value)}
                  className="w-full border border-border-dim bg-surface-card rounded-lg px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">Amount Paid (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  value={fuelAmount}
                  onChange={(e) => setFuelAmount(e.target.value)}
                  placeholder="e.g. 800"
                  className="w-full border border-border-dim bg-surface-card rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
                  required
                />
                {fuelType === 'cng' && fuelAmount && Number(fuelAmount) > 0 && (
                  <p className="text-[10px] text-text-muted mt-1">≈ {(Number(fuelAmount) / cngRate).toFixed(2)} kg @ ₹{cngRate}/kg</p>
                )}
              </div>
              {fuelType === 'cng' && (
                <div>
                  <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">Odometer (km)</label>
                  <input
                    type="number"
                    value={fuelOdo}
                    onChange={(e) => setFuelOdo(e.target.value)}
                    placeholder="e.g. 15000"
                    className="w-full border border-border-dim bg-surface-card rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
                  />
                </div>
              )}
              <button
                type="submit"
                className="w-full bg-white text-black font-semibold py-2 rounded-lg text-xs"
              >
                {editingFuelId !== null ? 'Save Changes' : 'Save Fill-up'}
              </button>
            </form>
          )}

          {fuelLogs.length === 0 && !showFuelForm && (
            <p className="text-center text-text-muted text-sm py-6">No fuel logs yet. Add fill-ups to track efficiency.</p>
          )}

          {fuelLogs.map((log) => (
            <div key={log.id} className="bg-surface-card rounded-xl p-3 border border-border-dim flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                log.fuel_type === 'petrol' ? 'bg-yellow-500/10' : 'bg-orange-500/10'
              }`}>
                <Fuel size={16} className={log.fuel_type === 'petrol' ? 'text-yellow-400' : 'text-orange-400'} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-primary">
                  {log.fuel_type === 'petrol' ? 'Petrol' : `${log.quantity_kg} kg @ ₹${log.price_per_kg}/kg`}
                </p>
                <p className="text-[11px] text-text-muted">
                  {log.date}
                  {log.fuel_type !== 'petrol' && log.odometer_km > 0 && ` · ${fmt(log.odometer_km)} km`}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-bold text-expense">₹{fmt(log.total_cost)}</span>
                {isOwner && (
                  <>
                    <button
                      onClick={() => handleEditFuel(log)}
                      className="text-text-muted hover:text-text-primary transition-colors"
                      title="Edit fuel log"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm({ type: 'fuel', id: log.id })}
                      className="text-text-muted hover:text-expense transition-colors"
                      title="Delete fuel log"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Service Tab */}
      {tab === 'service' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-secondary">Service History</h3>
            {isOwner && (
              <button
                onClick={() => setShowServiceForm(!showServiceForm)}
                className="flex items-center gap-1 text-white text-xs font-semibold"
              >
                <Plus size={14} /> Add
              </button>
            )}
          </div>

          {showServiceForm && (
            <form onSubmit={handleAddService} className="bg-surface-elevated rounded-xl p-3 border border-border-dim space-y-2">
              <div>
                <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">Date</label>
                <input
                  type="date"
                  value={svcDate}
                  onChange={(e) => setSvcDate(e.target.value)}
                  className="w-full border border-border-dim bg-surface-card rounded-lg px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">Description</label>
                <input
                  type="text"
                  value={svcDesc}
                  onChange={(e) => setSvcDesc(e.target.value)}
                  placeholder="e.g. Oil change, tyre rotation"
                  className="w-full border border-border-dim bg-surface-card rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">Cost (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    value={svcCost}
                    onChange={(e) => setSvcCost(e.target.value)}
                    placeholder="e.g. 2500"
                    className="w-full border border-border-dim bg-surface-card rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">Odometer (km)</label>
                  <input
                    type="number"
                    value={svcOdo}
                    onChange={(e) => setSvcOdo(e.target.value)}
                    placeholder="e.g. 45000"
                    className="w-full border border-border-dim bg-surface-card rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-white text-black font-semibold py-2 rounded-lg text-xs"
              >
                Save Record
              </button>
            </form>
          )}

          {(services?.length ?? 0) === 0 && !showServiceForm && (
            <p className="text-center text-text-muted text-sm py-6">No service records yet</p>
          )}

          {services?.map((svc) => (
            <div key={svc.id} className="bg-surface-card rounded-xl p-3 border border-border-dim flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-yellow-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <Wrench size={16} className="text-yellow-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-primary">{svc.description}</p>
                <p className="text-[11px] text-text-muted">
                  {svc.date}
                  {svc.odometer_km > 0 && ` · ${fmt(svc.odometer_km)} km`}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {svc.cost > 0 && (
                  <span className="text-xs font-bold text-expense">₹{fmt(svc.cost)}</span>
                )}
                {isOwner && (
                  <button
                    onClick={() => setDeleteConfirm({ type: 'service', id: svc.id })}
                    className="text-text-muted hover:text-expense transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6">
          <div className="bg-surface-card rounded-2xl p-5 border border-border-dim max-w-sm w-full space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-expense/10 flex items-center justify-center">
                <AlertTriangle size={20} className="text-expense" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Delete {deleteConfirm.type === 'fuel' ? 'Fuel Log' : deleteConfirm.type === 'service' ? 'Service Record' : 'Document'}?</h3>
                <p className="text-xs text-text-muted">This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-surface-elevated text-text-secondary border border-border-dim"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setDeleting(true)
                  try {
                    if (deleteConfirm.type === 'fuel') await deleteFuelLog(deleteConfirm.id)
                    else if (deleteConfirm.type === 'service') await deleteServiceRecord(deleteConfirm.id)
                    else await deleteCarDocument(deleteConfirm.id)
                  } finally {
                    setDeleting(false)
                    setDeleteConfirm(null)
                  }
                }}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-expense text-white disabled:opacity-60"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
