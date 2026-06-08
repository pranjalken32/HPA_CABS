import { useState, useEffect } from 'react'
import { useMonthFilter } from '../hooks/useMonthFilter'
import { useExpenses, useIncomes, useCars, useFuelLogs, addFuelLog, useDriverProfiles } from '../hooks/useSupabase'
import { useAuth } from '../AuthContext'
import { Fuel, Car, Wallet, ArrowUpCircle, ChevronRight, CheckCircle2, Target } from 'lucide-react'

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function DriverHome() {
  const { month, setMonth, startDate, endDate } = useMonthFilter()
  const { displayName } = useAuth()
  const expenses = useExpenses(startDate, endDate)
  const cars = useCars()
  const driverProfiles = useDriverProfiles()
  const [selectedCarId, setSelectedCarId] = useState<number | null>(null)
  const [showFuelForm, setShowFuelForm] = useState(false)
  const [fuelDate, setFuelDate] = useState(todayStr())
  const [fuelAmount, setFuelAmount] = useState('')
  const [fuelOdo, setFuelOdo] = useState('')
  const [saved, setSaved] = useState(false)
  const cngRate = Number(localStorage.getItem('hpa_cng_rate') || '95')

  // Find this driver's profile by matching display name
  const myProfile = driverProfiles.find(
    (d) => d.name && displayName && d.name.toLowerCase() === displayName.toLowerCase()
  )
  const myName = myProfile?.name || displayName || ''
  const assignedCarId = myProfile?.car_id ?? null

  // Auto-select assigned car on load
  useEffect(() => {
    if (assignedCarId && !selectedCarId) {
      setSelectedCarId(assignedCarId)
      setShowFuelForm(true)
    }
  }, [assignedCarId]) // eslint-disable-line react-hooks/exhaustive-deps

  const selectedCar = cars.find((c) => c.id === selectedCarId)
  const fuelLogs = useFuelLogs(selectedCarId ?? 0)

  // Only show advances that match this driver's name
  const advanceEntries = (expenses ?? []).filter(
    (e) => e.category === 'driver_advance' && myName && e.note?.toLowerCase().includes(myName.toLowerCase())
  )
  const totalAdvance = advanceEntries.reduce((s, e) => s + e.amount, 0)

  // Calculate salary from driver profile (pro-rated)
  const totalSalary = myProfile?.monthly_salary ?? 0
  const balance = totalSalary - totalAdvance

  // ---- Incentive Calculation ----
  const incomes = useIncomes(startDate, endDate)
  const incentiveTarget = myProfile?.incentive_target ?? 0
  const incentiveBase = myProfile?.incentive_base ?? 500
  const incentiveStep = myProfile?.incentive_step ?? 250
  const incentiveSlab = myProfile?.incentive_slab ?? 5000
  const weeklyTarget = incentiveTarget > 0 ? incentiveTarget / 4 : 0

  // Current week number (1-4)
  const today = new Date()
  const currentWeekNum = Math.min(Math.ceil(today.getDate() / 7), 4)

  // Calculate weekly incentives
  const [filterYear, filterMonth] = month.split('-').map(Number)
  const weeklyData = (() => {
    if (!assignedCarId || incentiveTarget <= 0) return []
    const carIncomes = (incomes ?? []).filter((i) => i.car_id === assignedCarId)
    const weekRevenues: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
    for (const inc of carIncomes) {
      const d = new Date(inc.date)
      if (d.getFullYear() !== filterYear || d.getMonth() + 1 !== filterMonth) continue
      const day = d.getDate()
      const wk = Math.min(Math.ceil(day / 7), 4)
      weekRevenues[wk] = (weekRevenues[wk] || 0) + inc.amount
    }
    const weeks = []
    for (let w = 1; w <= 4; w++) {
      const revenue = weekRevenues[w] || 0
      const hit = revenue >= weeklyTarget
      let incentive = 0
      if (hit && incentiveSlab > 0) {
        incentive = incentiveBase + Math.floor((revenue - weeklyTarget) / incentiveSlab) * incentiveStep
      } else if (hit) {
        incentive = incentiveBase
      }
      weeks.push({ weekNum: w, revenue, incentive, hit })
    }
    return weeks
  })()

  const currentWeek = weeklyData.find((w) => w.weekNum === currentWeekNum)
  const totalMonthIncentive = weeklyData.reduce((s, w) => s + w.incentive, 0)
  const currentRevenue = currentWeek?.revenue ?? 0
  const remainingForTarget = Math.max(weeklyTarget - currentRevenue, 0)

  const fmt = (n: number) => Math.abs(n).toLocaleString('en-IN')

  const handleAddFuel = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCarId || !fuelAmount || Number(fuelAmount) <= 0) return
    const totalCost = Number(fuelAmount)
    const price = cngRate
    const qty = price > 0 ? Math.round((totalCost / price) * 100) / 100 : 0
    await addFuelLog({
      car_id: selectedCarId,
      date: fuelDate,
      quantity_kg: qty,
      price_per_kg: price,
      total_cost: totalCost,
      odometer_km: Number(fuelOdo) || 0,
    })
    setSaved(true)
    setTimeout(() => {
      setSaved(false)
      setFuelAmount('')
      setFuelOdo('')
    }, 1200)
  }

  // Fuel efficiency
  const fuelEfficiency = (() => {
    if (fuelLogs.length < 2) return null
    const sorted = [...fuelLogs].sort((a, b) => a.odometer_km - b.odometer_km)
    const validLogs = sorted.filter((l) => l.odometer_km > 0)
    if (validLogs.length < 2) return null
    const totalKm = validLogs[validLogs.length - 1].odometer_km - validLogs[0].odometer_km
    const totalKg = validLogs.slice(1).reduce((s, l) => s + l.quantity_kg, 0)
    return totalKg > 0 ? totalKm / totalKg : null
  })()

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Driver Panel</h2>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="border border-border-dim rounded-xl px-3 py-1.5 text-sm bg-surface-card text-white"
        />
      </div>

      {/* Settlement Summary */}
      <div className="bg-surface-card rounded-2xl p-4 border border-border-dim">
        <div className="flex items-center gap-2 mb-3">
          <Wallet size={18} className="text-white" />
          <h3 className="text-sm font-semibold text-white">
            {myName ? `${myName}'s Settlement` : 'My Settlement'}
          </h3>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-surface-elevated rounded-xl p-3 text-center">
            <p className="text-[10px] text-text-muted uppercase">Salary</p>
            <p className="text-sm font-bold text-white">₹{fmt(totalSalary)}</p>
          </div>
          <div className="bg-surface-elevated rounded-xl p-3 text-center">
            <p className="text-[10px] text-text-muted uppercase">Advance</p>
            <p className="text-sm font-bold text-income">₹{fmt(totalAdvance)}</p>
          </div>
          <div className="bg-surface-elevated rounded-xl p-3 text-center">
            <p className="text-[10px] text-text-muted uppercase">{balance >= 0 ? 'Due' : 'Overpaid'}</p>
            <p className={`text-sm font-bold ${balance >= 0 ? 'text-expense' : 'text-income'}`}>₹{fmt(balance)}</p>
          </div>
        </div>

        {advanceEntries.length > 0 && (
          <div className="mt-3 border-t border-border-dim pt-3">
            <p className="text-[10px] text-text-muted uppercase mb-2">Recent Advances</p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {advanceEntries.slice(0, 5).map((e) => (
                <div key={e.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ArrowUpCircle size={14} className="text-income" />
                    <span className="text-xs text-text-secondary">{e.date}</span>
                    {e.note && <span className="text-xs text-text-muted">· {e.note}</span>}
                  </div>
                  <span className="text-xs font-bold text-income">+₹{fmt(e.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Incentive Tracker — only show if incentive is configured */}
      {weeklyTarget > 0 && (
        <div className="bg-surface-card rounded-2xl p-4 border border-border-dim space-y-4">
          <div className="flex items-center gap-2">
            <Target size={18} className="text-income" />
            <h3 className="text-sm font-semibold text-white">My Incentive</h3>
          </div>

          {/* This Week Progress */}
          <div className="bg-surface-elevated rounded-xl p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-text-muted">Week {currentWeekNum} Progress</span>
              <span className="text-xs font-bold text-white">
                ₹{fmt(currentRevenue)} / ₹{fmt(weeklyTarget)}
              </span>
            </div>
            <div className="w-full h-4 bg-black/30 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  currentRevenue >= weeklyTarget ? 'bg-income' : 'bg-white'
                }`}
                style={{ width: `${Math.min(100, weeklyTarget > 0 ? (currentRevenue / weeklyTarget) * 100 : 0)}%` }}
              />
            </div>
            {remainingForTarget > 0 ? (
              <p className="text-sm font-bold text-center mt-3 text-white">
                ₹{fmt(remainingForTarget)} more to earn target
              </p>
            ) : (
              <p className="text-sm font-bold text-center mt-3 text-income">
                Target hit! Earned ₹{fmt(currentWeek?.incentive ?? 0)} bonus
              </p>
            )}
          </div>

          {/* Monthly Summary — big simple numbers */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-surface-elevated rounded-xl p-3 text-center">
              <p className="text-[10px] text-text-muted uppercase">This Month Bonus</p>
              <p className="text-xl font-black text-income">₹{fmt(totalMonthIncentive)}</p>
            </div>
            <div className="bg-surface-elevated rounded-xl p-3 text-center">
              <p className="text-[10px] text-text-muted uppercase">Weekly Target</p>
              <p className="text-xl font-black text-white">₹{fmt(weeklyTarget)}</p>
            </div>
          </div>

          {/* Week-by-week status — simple dots */}
          <div className="flex justify-between px-2">
            {weeklyData.map((w) => (
              <div key={w.weekNum} className="text-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  w.weekNum === currentWeekNum
                    ? w.hit ? 'bg-income text-black' : 'bg-white text-black'
                    : w.hit ? 'bg-income/20 text-income' : 'bg-surface-elevated text-text-muted'
                }`}>
                  W{w.weekNum}
                </div>
                <p className="text-[9px] mt-1 text-text-muted">
                  {w.hit ? `+₹${w.incentive}` : w.weekNum <= currentWeekNum ? 'Miss' : '—'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Car Selection + Fuel Entry */}
      <div className="bg-surface-card rounded-2xl p-4 border border-border-dim">
        <div className="flex items-center gap-2 mb-3">
          <Fuel size={18} className="text-white" />
          <h3 className="text-sm font-semibold text-white">Fuel / CNG Log</h3>
        </div>

        {/* Car selector — if driver has assigned car, show only that; otherwise show all */}
        {(() => {
          const availableCars = assignedCarId
            ? cars.filter((c) => c.id === assignedCarId)
            : cars
          if (availableCars.length === 0) {
            return <p className="text-sm text-text-muted text-center py-4">No car assigned yet</p>
          }
          return (
            <div className="space-y-2 mb-3">
              {availableCars.map((car) => (
                <button
                  key={car.id}
                  onClick={() => {
                    setSelectedCarId(car.id)
                    setShowFuelForm(true)
                  }}
                  className={`w-full rounded-xl p-3 border flex items-center gap-3 text-left transition-colors ${
                    selectedCarId === car.id
                      ? 'border-white bg-white/5'
                      : 'border-border-dim hover:border-white/20'
                  }`}
                >
                  <Car size={18} className={selectedCarId === car.id ? 'text-white' : 'text-text-muted'} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{car.name}</p>
                    <p className="text-[10px] text-text-muted font-mono">{car.number}</p>
                  </div>
                  <ChevronRight size={16} className="text-text-muted" />
                </button>
              ))}
            </div>
          )
        })()}

        {/* Fuel form */}
        {showFuelForm && selectedCar && (
          <>
            {saved && (
              <div className="bg-income/10 text-income border border-income/20 rounded-xl p-2 mb-3 flex items-center gap-2 text-sm">
                <CheckCircle2 size={16} /> Fuel entry saved!
              </div>
            )}

            {fuelEfficiency !== null && (
              <div className="bg-surface-elevated rounded-xl p-3 mb-3 text-center">
                <p className="text-[10px] text-text-muted uppercase">Fuel Efficiency</p>
                <p className="text-lg font-bold text-white">{fuelEfficiency.toFixed(1)} km/kg</p>
              </div>
            )}

            <form onSubmit={handleAddFuel} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Date</label>
                <input
                  type="date"
                  value={fuelDate}
                  onChange={(e) => setFuelDate(e.target.value)}
                  className="w-full border border-border-dim bg-surface-elevated rounded-xl px-3 py-2.5 text-sm text-white focus:border-white focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Amount Paid (₹)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={fuelAmount}
                  onChange={(e) => setFuelAmount(e.target.value)}
                  placeholder="e.g. 800"
                  className="w-full border border-border-dim bg-surface-elevated rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-text-muted focus:border-white focus:outline-none"
                  min="1"
                  required
                />
                {fuelAmount && Number(fuelAmount) > 0 && (
                  <p className="text-[10px] text-text-muted mt-1">≈ {(Number(fuelAmount) / cngRate).toFixed(2)} kg @ ₹{cngRate}/kg</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Odometer Reading (km)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={fuelOdo}
                  onChange={(e) => setFuelOdo(e.target.value)}
                  placeholder="e.g. 45230"
                  className="w-full border border-border-dim bg-surface-elevated rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-text-muted focus:border-white focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-white text-black font-semibold py-3 rounded-xl hover:bg-gray-200 transition-all"
              >
                Save Fuel Entry
              </button>
            </form>

            {/* Recent fuel logs */}
            {fuelLogs.length > 0 && (
              <div className="mt-4 border-t border-border-dim pt-3">
                <p className="text-[10px] text-text-muted uppercase mb-2">Recent Fills</p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {fuelLogs.slice(0, 10).map((log) => (
                    <div key={log.id} className="flex items-center justify-between bg-surface-elevated rounded-lg px-3 py-2">
                      <div>
                        <span className="text-xs text-white">{log.date}</span>
                        <span className="text-xs text-text-muted ml-2">{log.quantity_kg} kg</span>
                        {log.odometer_km > 0 && (
                          <span className="text-xs text-text-muted ml-2">{log.odometer_km.toLocaleString()} km</span>
                        )}
                      </div>
                      <span className="text-xs font-bold text-white">₹{log.total_cost.toLocaleString('en-IN')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
