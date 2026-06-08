import { useState } from 'react'
import { useMonthFilter } from '../hooks/useMonthFilter'
import {
  useDriverProfiles,
  useExpenses,
  useIncomes,
  useCars,
  addDriverProfile,
  updateDriverProfile,
  deleteDriverProfile,
  uploadDriverDoc,
  getSignedUrl,
} from '../hooks/useSupabase'
import type { DriverProfileRow } from '../hooks/useSupabase'
import { Users, Plus, Edit2, Trash2, FileText, Upload, X, Calendar, Phone, IndianRupee, CheckCircle2, Target, TrendingUp } from 'lucide-react'

function getSettlementKey(driverName: string, month: string): string {
  return `hpa_settled_${driverName.toLowerCase().replace(/\s+/g, '_')}_${month}`
}

function getSettlement(driverName: string, month: string): { settled: boolean; date: string | null; amount: number } {
  const raw = localStorage.getItem(getSettlementKey(driverName, month))
  if (!raw) return { settled: false, date: null, amount: 0 }
  try {
    return JSON.parse(raw)
  } catch {
    return { settled: false, date: null, amount: 0 }
  }
}

function markSettled(driverName: string, month: string, amount: number): void {
  const today = new Date()
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  localStorage.setItem(
    getSettlementKey(driverName, month),
    JSON.stringify({ settled: true, date: dateStr, amount })
  )
}

function unmarkSettled(driverName: string, month: string): void {
  localStorage.removeItem(getSettlementKey(driverName, month))
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function calcProRatedSalary(
  monthlySalary: number,
  startDate: string,
  endDate: string | null,
  filterYear: number,
  filterMonth: number
): { proRated: number; workingDays: number; totalDays: number } {
  const totalDays = daysInMonth(filterYear, filterMonth)
  const monthStart = new Date(filterYear, filterMonth - 1, 1)
  const monthEnd = new Date(filterYear, filterMonth - 1, totalDays)

  const driverStart = new Date(startDate)
  const driverEnd = endDate ? new Date(endDate) : null

  // Driver hasn't started yet this month
  if (driverStart > monthEnd) return { proRated: 0, workingDays: 0, totalDays }
  // Driver left before this month
  if (driverEnd && driverEnd < monthStart) return { proRated: 0, workingDays: 0, totalDays }

  const effectiveStart = driverStart > monthStart ? driverStart : monthStart
  const effectiveEnd = driverEnd && driverEnd < monthEnd ? driverEnd : monthEnd

  const workingDays = Math.floor((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)) + 1

  const proRated = Math.round((monthlySalary / totalDays) * workingDays)
  return { proRated, workingDays, totalDays }
}

interface WeekIncentive {
  weekNum: number
  revenue: number
  target: number
  incentive: number
  hit: boolean
}

function calcWeeklyIncentives(
  incomes: { date: string; amount: number; car_id: number | null }[],
  carId: number | null,
  incentiveTarget: number,
  incentiveBase: number,
  incentiveStep: number,
  incentiveSlab: number,
  year: number,
  monthNum: number
): { weeks: WeekIncentive[]; totalIncentive: number } {
  if (!carId || incentiveTarget <= 0) return { weeks: [], totalIncentive: 0 }

  const weeklyTarget = incentiveTarget / 4
  const carIncomes = incomes.filter((i) => i.car_id === carId)

  // Group income by week of month
  const weekRevenues: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
  for (const inc of carIncomes) {
    const d = new Date(inc.date)
    if (d.getFullYear() !== year || d.getMonth() + 1 !== monthNum) continue
    const day = d.getDate()
    const weekNum = Math.min(Math.ceil(day / 7), 4)
    weekRevenues[weekNum] = (weekRevenues[weekNum] || 0) + inc.amount
  }

  const weeks: WeekIncentive[] = []
  let totalIncentive = 0
  for (let w = 1; w <= 4; w++) {
    const revenue = weekRevenues[w] || 0
    const hit = revenue >= weeklyTarget
    let incentive = 0
    if (hit && incentiveSlab > 0) {
      const extraSlabs = Math.floor((revenue - weeklyTarget) / incentiveSlab)
      incentive = incentiveBase + extraSlabs * incentiveStep
    } else if (hit) {
      incentive = incentiveBase
    }
    weeks.push({ weekNum: w, revenue, target: weeklyTarget, incentive, hit })
    totalIncentive += incentive
  }

  return { weeks, totalIncentive }
}

export default function Drivers() {
  const { month, setMonth, startDate, endDate } = useMonthFilter()
  const drivers = useDriverProfiles()
  const expenses = useExpenses(startDate, endDate)
  const incomes = useIncomes(startDate, endDate)
  const cars = useCars()
  const [showForm, setShowForm] = useState(false)
  const [editDriver, setEditDriver] = useState<DriverProfileRow | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [, setSettleTick] = useState(0)

  // Form state
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [startDateInput, setStartDateInput] = useState(todayStr())
  const [endDateInput, setEndDateInput] = useState('')
  const [salary, setSalary] = useState('')
  const [carIdInput, setCarIdInput] = useState<string>('')
  const [incTarget, setIncTarget] = useState('')
  const [incBase, setIncBase] = useState(localStorage.getItem('hpa_incentive_base') || '500')
  const [incStep, setIncStep] = useState(localStorage.getItem('hpa_incentive_step') || '250')
  const [incSlab, setIncSlab] = useState(localStorage.getItem('hpa_incentive_slab') || '5000')
  const [uploading, setUploading] = useState(false)

  const [filterYear, filterMonth] = month.split('-').map(Number)

  const fmt = (n: number) => Math.abs(n).toLocaleString('en-IN')

  const defaultBase = localStorage.getItem('hpa_incentive_base') || '500'
  const defaultStep = localStorage.getItem('hpa_incentive_step') || '250'
  const defaultSlab = localStorage.getItem('hpa_incentive_slab') || '5000'

  const resetForm = () => {
    setName('')
    setPhone('')
    setStartDateInput(todayStr())
    setEndDateInput('')
    setSalary('')
    setCarIdInput('')
    setIncTarget('')
    setIncBase(defaultBase)
    setIncStep(defaultStep)
    setIncSlab(defaultSlab)
    setEditDriver(null)
    setShowForm(false)
  }

  const openEditForm = (d: DriverProfileRow) => {
    setEditDriver(d)
    setName(d.name)
    setPhone(d.phone)
    setStartDateInput(d.start_date)
    setEndDateInput(d.end_date ?? '')
    setSalary(String(d.monthly_salary))
    setCarIdInput(d.car_id ? String(d.car_id) : '')
    setIncTarget(d.incentive_target ? String(d.incentive_target) : '')
    setIncBase(d.incentive_base ? String(d.incentive_base) : '500')
    setIncStep(d.incentive_step ? String(d.incentive_step) : '250')
    setIncSlab(d.incentive_slab ? String(d.incentive_slab) : '5000')
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !salary) return

    const payload = {
      name,
      phone,
      start_date: startDateInput,
      end_date: endDateInput || null,
      monthly_salary: Number(salary),
      car_id: carIdInput ? Number(carIdInput) : null,
      incentive_target: Number(incTarget) || 0,
      incentive_base: Number(incBase) || 500,
      incentive_step: Number(incStep) || 250,
      incentive_slab: Number(incSlab) || 5000,
      dl_url: editDriver?.dl_url ?? null,
      aadhaar_url: editDriver?.aadhaar_url ?? null,
      pan_url: editDriver?.pan_url ?? null,
      active: !endDateInput,
    }

    if (editDriver) {
      await updateDriverProfile(editDriver.id, payload)
    } else {
      await addDriverProfile(payload)
    }
    resetForm()
  }

  const handleDocUpload = async (driverId: number, docType: 'dl_url' | 'aadhaar_url' | 'pan_url', file: File) => {
    setUploading(true)
    try {
      const url = await uploadDriverDoc(file)
      await updateDriverProfile(driverId, { [docType]: url })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Users size={22} />
          Drivers
        </h2>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="border border-border-dim rounded-xl px-3 py-1.5 text-sm bg-surface-card text-white"
          />
          <button
            onClick={() => { resetForm(); setShowForm(true) }}
            className="bg-white text-black rounded-xl p-2"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-surface-card rounded-2xl p-4 border border-border-dim space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">
              {editDriver ? 'Edit Driver' : 'Add Driver'}
            </h3>
            <button type="button" onClick={resetForm} className="text-text-muted hover:text-white">
              <X size={18} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-text-muted uppercase block mb-1">Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-surface-elevated border border-border-dim rounded-xl px-3 py-2 text-sm text-white"
                placeholder="Driver name"
                required
              />
            </div>
            <div>
              <label className="text-[10px] text-text-muted uppercase block mb-1">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-surface-elevated border border-border-dim rounded-xl px-3 py-2 text-sm text-white"
                placeholder="9876543210"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-text-muted uppercase block mb-1">Start Date *</label>
              <input
                type="date"
                value={startDateInput}
                onChange={(e) => setStartDateInput(e.target.value)}
                className="w-full bg-surface-elevated border border-border-dim rounded-xl px-3 py-2 text-sm text-white"
                required
              />
            </div>
            <div>
              <label className="text-[10px] text-text-muted uppercase block mb-1">End Date</label>
              <input
                type="date"
                value={endDateInput}
                onChange={(e) => setEndDateInput(e.target.value)}
                className="w-full bg-surface-elevated border border-border-dim rounded-xl px-3 py-2 text-sm text-white"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-text-muted uppercase block mb-1">Monthly Salary (₹) *</label>
            <input
              type="number"
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
              className="w-full bg-surface-elevated border border-border-dim rounded-xl px-3 py-2 text-sm text-white"
              placeholder="10000"
              required
            />
          </div>

          {/* Car Assignment */}
          <div>
            <label className="text-[10px] text-text-muted uppercase block mb-1">Assigned Car</label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setCarIdInput('')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  !carIdInput ? 'bg-white text-black' : 'bg-surface-elevated text-text-muted border border-border-dim'
                }`}
              >
                None
              </button>
              {cars.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCarIdInput(String(c.id))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    carIdInput === String(c.id) ? 'bg-white text-black' : 'bg-surface-elevated text-text-muted border border-border-dim'
                  }`}
                >
                  {c.number || c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Incentive Config */}
          {carIdInput && (
            <div className="bg-surface-elevated rounded-xl p-3 border border-border-dim space-y-2">
              <p className="text-[10px] text-text-muted uppercase flex items-center gap-1">
                <Target size={10} /> Incentive Configuration
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-text-muted block mb-0.5">Monthly Target (₹)</label>
                  <input
                    type="number"
                    value={incTarget}
                    onChange={(e) => setIncTarget(e.target.value)}
                    className="w-full bg-surface-card border border-border-dim rounded-lg px-2.5 py-1.5 text-xs text-white"
                    placeholder="90000"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-text-muted block mb-0.5">Base/week (₹)</label>
                  <input
                    type="number"
                    value={incBase}
                    onChange={(e) => setIncBase(e.target.value)}
                    className="w-full bg-surface-card border border-border-dim rounded-lg px-2.5 py-1.5 text-xs text-white"
                    placeholder="500"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-text-muted block mb-0.5">Extra per slab (₹)</label>
                  <input
                    type="number"
                    value={incStep}
                    onChange={(e) => setIncStep(e.target.value)}
                    className="w-full bg-surface-card border border-border-dim rounded-lg px-2.5 py-1.5 text-xs text-white"
                    placeholder="250"
                  />
                </div>
                <div>
                  <label className="text-[9px] text-text-muted block mb-0.5">Slab size (₹)</label>
                  <input
                    type="number"
                    value={incSlab}
                    onChange={(e) => setIncSlab(e.target.value)}
                    className="w-full bg-surface-card border border-border-dim rounded-lg px-2.5 py-1.5 text-xs text-white"
                    placeholder="5000"
                  />
                </div>
              </div>
              {Number(incTarget) > 0 && (
                <p className="text-[9px] text-text-muted">
                  Weekly target: ₹{fmt(Number(incTarget) / 4)} · Base ₹{incBase}/week + ₹{incStep} per extra ₹{incSlab}
                </p>
              )}
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-white text-black font-semibold rounded-xl py-2.5 text-sm"
          >
            {editDriver ? 'Update Driver' : 'Add Driver'}
          </button>
        </form>
      )}

      {/* Driver List with Settlement */}
      {drivers.length === 0 && !showForm && (
        <div className="bg-surface-card rounded-2xl p-8 border border-border-dim text-center">
          <Users size={32} className="text-text-muted mx-auto mb-2" />
          <p className="text-text-muted text-sm">No drivers added yet</p>
          <p className="text-text-muted text-xs mt-1">Tap + to add your first driver</p>
        </div>
      )}

      {drivers.map((driver) => {
        const { proRated, workingDays, totalDays } = calcProRatedSalary(
          driver.monthly_salary,
          driver.start_date,
          driver.end_date,
          filterYear,
          filterMonth
        )

        const { weeks: incentiveWeeks, totalIncentive } = calcWeeklyIncentives(
          incomes ?? [],
          driver.car_id,
          driver.incentive_target,
          driver.incentive_base,
          driver.incentive_step,
          driver.incentive_slab,
          filterYear,
          filterMonth
        )

        const advanceEntries = (expenses ?? []).filter(
          (e) => e.category === 'driver_advance' && e.note?.toLowerCase().includes(driver.name.toLowerCase())
        )
        const totalAdvance = advanceEntries.reduce((s, e) => s + e.amount, 0)
        const netPayable = proRated + totalIncentive - totalAdvance

        const isExpanded = expandedId === driver.id

        return (
          <div key={driver.id} className="bg-surface-card rounded-2xl border border-border-dim overflow-hidden">
            {/* Driver Header */}
            <div
              className="px-4 py-3 flex items-center justify-between cursor-pointer"
              onClick={() => setExpandedId(isExpanded ? null : driver.id)}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-surface-elevated flex items-center justify-center">
                  <span className="text-sm font-bold text-white">
                    {driver.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{driver.name}</p>
                  <div className="flex items-center gap-2 text-[10px] text-text-muted">
                    {driver.phone && <span>{driver.phone}</span>}
                    <span className={driver.active ? 'text-income' : 'text-expense'}>
                      {driver.active ? '● Active' : '● Left'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                {getSettlement(driver.name, month).settled ? (
                  <>
                    <p className="text-sm font-bold text-income">Settled</p>
                    <p className="text-[10px] text-text-muted">₹{fmt(getSettlement(driver.name, month).amount)}</p>
                  </>
                ) : (
                  <>
                    <p className={`text-sm font-bold ${netPayable >= 0 ? 'text-expense' : 'text-income'}`}>
                      {netPayable >= 0 ? 'Pay' : 'Over'} ₹{fmt(netPayable)}
                    </p>
                    <p className="text-[10px] text-text-muted">this month</p>
                  </>
                )}
              </div>
            </div>

            {/* Expanded Details */}
            {isExpanded && (
              <div className="border-t border-border-dim px-4 py-3 space-y-3">
                {/* Salary Breakdown */}
                <div className={`grid ${totalIncentive > 0 ? 'grid-cols-4' : 'grid-cols-3'} gap-2`}>
                  <div className="bg-surface-elevated rounded-xl p-2.5 text-center">
                    <p className="text-[9px] text-text-muted uppercase">Salary</p>
                    <p className="text-sm font-bold text-white">₹{fmt(proRated)}</p>
                    <p className="text-[9px] text-text-muted">{workingDays}/{totalDays} days</p>
                  </div>
                  {totalIncentive > 0 && (
                    <div className="bg-surface-elevated rounded-xl p-2.5 text-center">
                      <p className="text-[9px] text-text-muted uppercase">Incentive</p>
                      <p className="text-sm font-bold text-income">+₹{fmt(totalIncentive)}</p>
                    </div>
                  )}
                  <div className="bg-surface-elevated rounded-xl p-2.5 text-center">
                    <p className="text-[9px] text-text-muted uppercase">Advance</p>
                    <p className="text-sm font-bold text-white">−₹{fmt(totalAdvance)}</p>
                  </div>
                  <div className="bg-surface-elevated rounded-xl p-2.5 text-center">
                    <p className="text-[9px] text-text-muted uppercase">Net Pay</p>
                    <p className={`text-sm font-bold ${netPayable >= 0 ? 'text-expense' : 'text-income'}`}>
                      ₹{fmt(netPayable)}
                    </p>
                  </div>
                </div>

                {/* Weekly Incentive Breakdown */}
                {incentiveWeeks.length > 0 && driver.incentive_target > 0 && (
                  <div className="bg-surface-elevated rounded-xl p-3 border border-border-dim">
                    <div className="flex items-center gap-1.5 mb-2">
                      <TrendingUp size={12} className="text-income" />
                      <p className="text-[10px] text-text-muted uppercase">Weekly Incentive (Target: ₹{fmt(driver.incentive_target / 4)}/wk)</p>
                    </div>
                    <div className="space-y-1.5">
                      {incentiveWeeks.map((w) => (
                        <div key={w.weekNum} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold ${
                              w.hit ? 'bg-income/10 text-income' : 'bg-surface-card text-text-muted'
                            }`}>
                              W{w.weekNum}
                            </span>
                            <span className="text-text-secondary">₹{fmt(w.revenue)}</span>
                          </div>
                          <span className={`font-semibold ${w.hit ? 'text-income' : 'text-text-muted'}`}>
                            {w.hit ? `+₹${fmt(w.incentive)}` : 'Missed'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Settlement Status */}
                {(() => {
                  const settlement = getSettlement(driver.name, month)
                  return (
                    <div className="bg-surface-elevated rounded-xl p-3">
                      {settlement.settled ? (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 size={16} className="text-income" />
                            <div>
                              <p className="text-xs font-semibold text-income">Settled</p>
                              <p className="text-[10px] text-text-muted">Paid ₹{fmt(settlement.amount)} on {settlement.date}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => { unmarkSettled(driver.name, month); setSettleTick(t => t + 1) }}
                            className="text-[10px] text-text-muted hover:text-white underline"
                          >
                            Undo
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { markSettled(driver.name, month, netPayable); setSettleTick(t => t + 1) }}
                          disabled={netPayable <= 0}
                          className={`w-full py-2 rounded-lg text-sm font-semibold transition-all ${
                            netPayable > 0
                              ? 'bg-white text-black hover:bg-gray-200'
                              : 'bg-surface-card text-text-muted cursor-not-allowed'
                          }`}
                        >
                          {netPayable > 0 ? `Mark Settled — ₹${fmt(netPayable)}` : 'Nothing to settle'}
                        </button>
                      )}
                    </div>
                  )
                })()}

                {/* Info */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1.5 text-text-secondary">
                    <Calendar size={12} />
                    <span>Start: {driver.start_date}</span>
                  </div>
                  {driver.end_date && (
                    <div className="flex items-center gap-1.5 text-text-secondary">
                      <Calendar size={12} />
                      <span>End: {driver.end_date}</span>
                    </div>
                  )}
                  {driver.phone && (
                    <div className="flex items-center gap-1.5 text-text-secondary">
                      <Phone size={12} />
                      <span>{driver.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-text-secondary">
                    <IndianRupee size={12} />
                    <span>₹{fmt(driver.monthly_salary)}/month</span>
                  </div>
                </div>

                {/* Documents */}
                <div>
                  <p className="text-[10px] text-text-muted uppercase mb-2">Documents</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(['dl_url', 'aadhaar_url', 'pan_url'] as const).map((docType) => {
                      const labels = { dl_url: 'DL', aadhaar_url: 'Aadhaar', pan_url: 'PAN' }
                      const url = driver[docType]
                      return (
                        <div key={docType} className="relative">
                          {url ? (
                            <button
                              onClick={async () => {
                                const signedUrl = await getSignedUrl(url)
                                if (signedUrl) window.open(signedUrl, '_blank')
                              }}
                              className="w-full flex flex-col items-center gap-1 bg-surface-elevated rounded-xl p-2.5 border border-border-dim hover:border-white/30 transition-colors"
                            >
                              <FileText size={16} className="text-income" />
                              <span className="text-[10px] text-text-secondary">{labels[docType]}</span>
                            </button>
                          ) : (
                            <label className="flex flex-col items-center gap-1 bg-surface-elevated rounded-xl p-2.5 border border-border-dim border-dashed cursor-pointer hover:border-white/30 transition-colors">
                              <Upload size={16} className="text-text-muted" />
                              <span className="text-[10px] text-text-muted">{labels[docType]}</span>
                              <input
                                type="file"
                                accept="image/*,.pdf"
                                className="hidden"
                                disabled={uploading}
                                onChange={(e) => {
                                  const file = e.target.files?.[0]
                                  if (file) handleDocUpload(driver.id, docType, file)
                                }}
                              />
                            </label>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => openEditForm(driver)}
                    className="flex items-center gap-1 text-xs text-text-secondary hover:text-white transition-colors"
                  >
                    <Edit2 size={12} /> Edit
                  </button>
                  <button
                    onClick={async () => {
                      if (confirm(`Remove ${driver.name}?`)) {
                        await deleteDriverProfile(driver.id)
                      }
                    }}
                    className="flex items-center gap-1 text-xs text-expense hover:text-red-300 transition-colors"
                  >
                    <Trash2 size={12} /> Remove
                  </button>
                </div>

                {/* Advance log */}
                {advanceEntries.length > 0 && (
                  <div className="border-t border-border-dim pt-2">
                    <p className="text-[10px] text-text-muted uppercase mb-1">Advances this month</p>
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {advanceEntries.map((e) => (
                        <div key={e.id} className="flex items-center justify-between text-xs">
                          <span className="text-text-secondary">{e.date}</span>
                          <span className="text-income font-medium">₹{fmt(e.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Info note */}
      <div className="bg-surface-card rounded-2xl p-3 border border-border-dim">
        <p className="text-[10px] text-text-muted leading-relaxed">
          💡 <strong className="text-text-secondary">Pro-rated salary</strong> is calculated based on the driver's start/end date
          within the selected month. To track advances, add an expense with category "Driver Advance" and include the
          driver's name in the note field.
        </p>
      </div>
    </div>
  )
}
