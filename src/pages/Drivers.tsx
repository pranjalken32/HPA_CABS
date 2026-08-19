import { useState } from 'react'
import { useMonthFilter } from '../hooks/useMonthFilter'
import {
  notifyApp,
  useDriverProfiles,
  useExpenses,
  useIncomes,
  useCars,
  addDriverProfile,
  updateDriverProfile,
  deleteDriverProfile,
  uploadDriverDoc,
  getSignedUrl,
  useDriverSettlements,
  addSettlement,
  removeSettlement,
  getSettlementErrorMessage,
  useDriverUsers,
} from '../hooks/useSupabase'
import type { DriverProfileRow, DriverSettlementRow } from '../hooks/useSupabase'
import { Users, Plus, Edit2, Trash2, FileText, Upload, X, Calendar, Phone, IndianRupee, CheckCircle2, Target, TrendingUp } from 'lucide-react'
import { useLanguage } from '../useLanguage'
import { getWeekEnd, getWeeksCoveringRange, isValidCalendarDate, lastDayOfMonth, todayStr } from '../utils/date'
import { fmt, parseNonNegativeNumber, parsePositiveAmount } from '../utils/money'
import {
  calculateWeeklyIncentiveForRange,
  calculateWeeklyIncentives,
  prorateSalary,
  prorateSalaryForWeek,
} from '../utils/calculations'

function prevMonthEnd(startDate: string): string {
  const [year, month] = startDate.split('-').map(Number)
  const d = new Date(year, month - 1, 0)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getMonthsBetween(from: string, toMonth: string): string[] {
  const months: string[] = []
  const [fy, fm] = from.slice(0, 7).split('-').map(Number)
  const [ty, tm] = toMonth.split('-').map(Number)
  let y = fy, m = fm
  while (y < ty || (y === ty && m < tm)) {
    months.push(`${y}-${String(m).padStart(2, '0')}`)
    m++
    if (m > 12) { m = 1; y++ }
  }
  return months
}

interface WeeklySettlementRow {
  weekStart: string
  weekEnd: string
  salary: number
  incentive: number
  advance: number
  carryForward: number
  netPayable: number
  projected: boolean
  settlement: DriverSettlementRow | undefined
}

function WeeklySettlementPanel({
  rows,
  settlingId,
  onSettle,
  onUndo,
  t,
}: {
  rows: WeeklySettlementRow[]
  settlingId: number | null
  onSettle: (row: WeeklySettlementRow) => void
  onUndo: (settlement: DriverSettlementRow) => void
  t: ReturnType<typeof useLanguage>['t']
}) {
  return (
    <div className="space-y-2">
      <div className="bg-surface-elevated rounded-xl p-3 border border-border-dim">
        <p className="text-[10px] text-text-muted uppercase">{t.weeklySettlement}</p>
        <p className="text-[10px] text-text-secondary mt-1">
          {t.weeklySettlement}
        </p>
      </div>
      {rows.map((row) => (
        <div key={row.weekStart} className="bg-surface-elevated rounded-xl p-3 border border-border-dim space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">{row.weekStart} → {row.weekEnd}</p>
              {row.projected && (
                <p className="text-[10px] text-text-muted">{t.projected} · {t.settlesOn} {row.weekEnd}</p>
              )}
            </div>
            {row.settlement && (
              <span className="text-[10px] font-semibold text-income flex items-center gap-1">
                <CheckCircle2 size={13} /> {t.settled}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="bg-surface-card rounded-lg p-2">
              <p className="text-[9px] text-text-muted uppercase">{t.weekSalary}</p>
              <p className="text-xs font-bold text-white">₹{fmt(row.salary)}</p>
            </div>
            <div className="bg-surface-card rounded-lg p-2">
              <p className="text-[9px] text-text-muted uppercase">{t.weekIncentive}</p>
              <p className="text-xs font-bold text-income">+₹{fmt(row.incentive)}</p>
            </div>
            <div className="bg-surface-card rounded-lg p-2">
              <p className="text-[9px] text-text-muted uppercase">{t.weekAdvance}</p>
              <p className="text-xs font-bold text-white">−₹{fmt(row.advance)}</p>
            </div>
            <div className="bg-surface-card rounded-lg p-2">
              <p className="text-[9px] text-text-muted uppercase">{t.weekNet}</p>
              <p className={`text-xs font-bold ${row.netPayable >= 0 ? 'text-expense' : 'text-income'}`}>
                ₹{fmt(row.netPayable)}
              </p>
            </div>
          </div>
          {row.settlement ? (
            <div className="flex items-center justify-between text-[10px] text-text-muted">
              <span>{t.paidOn} {row.settlement.settled_date} · ₹{fmt(row.settlement.amount)}</span>
              <button
                disabled={settlingId !== null}
                onClick={() => onUndo(row.settlement!)}
                className="underline hover:text-white disabled:opacity-50"
              >
                {t.undo}
              </button>
            </div>
          ) : row.projected ? (
            <p className="text-[10px] text-text-muted text-center">{t.settlesOn} {row.weekEnd}</p>
          ) : (
            <button
              disabled={row.netPayable <= 0 || settlingId !== null}
              onClick={() => onSettle(row)}
              className="w-full py-2 rounded-lg text-sm font-semibold bg-white text-black disabled:bg-surface-card disabled:text-text-muted"
            >
              {row.netPayable > 0 ? `${t.markSettled} — ₹${fmt(row.netPayable)}` : t.noDrivers}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

export default function Drivers() {
  const { month, setMonth, startDate, endDate } = useMonthFilter()
  const { t } = useLanguage()
  const drivers = useDriverProfiles()
  const expenses = useExpenses(startDate, endDate)
  const incomes = useIncomes(startDate, endDate)
  const prevEnd = prevMonthEnd(startDate)
  const allPrevExpenses = useExpenses('2000-01-01', prevEnd)
  const allPrevIncomes = useIncomes('2000-01-01', prevEnd)
  const cars = useCars()
  const settlements = useDriverSettlements({})
  const [showForm, setShowForm] = useState(false)
  const [editDriver, setEditDriver] = useState<DriverProfileRow | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month')

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
  const [authUserIdInput, setAuthUserIdInput] = useState<string>('')
  const driverUsers = useDriverUsers()

  const [filterYear, filterMonth] = month.split('-').map(Number)

  const [submitting, setSubmitting] = useState(false)
  const [settlingId, setSettlingId] = useState<number | null>(null)
  const [removingId, setRemovingId] = useState<number | null>(null)
  const currentDate = todayStr()
  const currentWeekEnd = getWeekEnd(currentDate)

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
    setAuthUserIdInput('')
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
    setAuthUserIdInput(d.auth_user_id ?? '')
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const monthlySalary = parsePositiveAmount(salary)
    const carId = carIdInput === '' ? null : parseNonNegativeNumber(carIdInput)
    const incentiveTarget = incTarget === '' ? 0 : parseNonNegativeNumber(incTarget)
    const incentiveBase = incBase === '' ? 500 : parseNonNegativeNumber(incBase)
    const incentiveStep = incStep === '' ? 250 : parseNonNegativeNumber(incStep)
    const incentiveSlab = incSlab === '' ? 5000 : parseNonNegativeNumber(incSlab)
    if (!name.trim() || monthlySalary === null || (carIdInput !== '' && carId === null) || incentiveTarget === null || incentiveBase === null || incentiveStep === null || incentiveSlab === null ||
      !isValidCalendarDate(startDateInput) || (endDateInput !== '' && !isValidCalendarDate(endDateInput))) {
      notifyApp('error', 'Enter valid driver, date, salary, and incentive values.')
      return
    }

    const payload = {
      name,
      phone,
      start_date: startDateInput,
      end_date: endDateInput || null,
      monthly_salary: monthlySalary,
      car_id: carId,
      incentive_target: incentiveTarget,
      incentive_base: incentiveBase,
      incentive_step: incentiveStep,
      incentive_slab: incentiveSlab,
      dl_url: editDriver?.dl_url ?? null,
      aadhaar_url: editDriver?.aadhaar_url ?? null,
      pan_url: editDriver?.pan_url ?? null,
      active: !endDateInput,
      auth_user_id: authUserIdInput || null,
    }

    setSubmitting(true)
    try {
      if (editDriver) {
        await updateDriverProfile(editDriver.id, payload)
      } else {
        await addDriverProfile(payload)
      }
      resetForm()
    } catch (error) {
      console.error('Driver save failed:', error)
      notifyApp('error', 'Driver could not be saved.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDocUpload = async (driverId: number, docType: 'dl_url' | 'aadhaar_url' | 'pan_url', file: File) => {
    setUploading(true)
    try {
      const url = await uploadDriverDoc(file)
      await updateDriverProfile(driverId, { [docType]: url })
    } catch (error) {
      console.error('Driver document upload failed:', error)
      notifyApp('error', 'Driver document could not be uploaded.')
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
          {t.drivers}
        </h2>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="border border-border-dim rounded-xl px-3 py-1.5 text-sm bg-surface-card text-white"
          />
          <div className="flex rounded-xl border border-border-dim overflow-hidden">
            {(['month', 'week'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-2.5 py-1.5 text-xs ${viewMode === mode ? 'bg-white text-black' : 'bg-surface-card text-text-muted'}`}
              >
                {mode === 'month' ? t.monthlyView : t.weeklyView}
              </button>
            ))}
          </div>
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
              {editDriver ? t.editDriver : t.addDriver}
            </h3>
            <button type="button" onClick={resetForm} className="text-text-muted hover:text-white">
              <X size={18} />
            </button>
          </div>

          {/* Link Auth User */}
          <div>
            <label className="text-[10px] text-text-muted uppercase block mb-1">Link Auth User</label>
            <select
              value={authUserIdInput}
              onChange={(e) => {
                const uid = e.target.value
                setAuthUserIdInput(uid)
                if (uid) {
                  const user = driverUsers.find((u) => u.id === uid)
                  if (user) setName(user.display_name)
                }
              }}
              className="w-full bg-surface-elevated border border-border-dim rounded-xl px-3 py-2 text-sm text-white"
            >
              <option value="">— Select driver user —</option>
              {driverUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.display_name} ({u.id.slice(0, 8)}…)
                </option>
              ))}
            </select>
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
              step="0.01"
              inputMode="decimal"
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
                    step="0.01"
                    inputMode="decimal"
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
                    step="0.01"
                    inputMode="decimal"
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
                    step="0.01"
                    inputMode="decimal"
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
                    step="0.01"
                    inputMode="decimal"
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
            disabled={submitting}
            className="w-full bg-white text-black font-semibold rounded-xl py-2.5 text-sm"
          >
            {submitting ? 'Saving...' : editDriver ? t.updateDriver : t.addDriver}
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
        const { amount: proRated, workingDays, totalDays } = prorateSalary(
          driver.monthly_salary, driver.start_date, driver.end_date, filterYear, filterMonth
        )

        const driverSettlements = settlements.filter(
          (settlement) => settlement.driver_profile_id === driver.id || settlement.driver_name === driver.name
        )
        const monthlySettlement = driverSettlements.find(
          (settlement) => (settlement.period_type ?? 'month') === 'month' && settlement.month === month
        )
        const allDriverIncomes = [...(allPrevIncomes ?? []), ...(incomes ?? [])]
        const allDriverExpenses = [...(allPrevExpenses ?? []), ...(expenses ?? [])]
        const { weeks: incentiveWeeks, totalIncentive } = calculateWeeklyIncentives(
          allDriverIncomes,
          driver.car_id,
          driver.incentive_target,
          driver.incentive_base,
          driver.incentive_step,
          driver.incentive_slab,
          filterYear,
          filterMonth
        )

        const advanceEntries = (expenses ?? []).filter(
          (e) => e.category === 'driver_advance' && (
            e.driver_profile_id === driver.id || e.note?.toLowerCase().includes(driver.name.toLowerCase())
          )
        )
        const totalAdvance = advanceEntries.reduce((s, e) => s + e.amount, 0)

        // Carry-forward: sum unsettled balances from all previous months
        const driverStartMonth = driver.start_date.slice(0, 7)
        const prevMonths = getMonthsBetween(driverStartMonth, month)
        let carryForward = 0
        for (const pm of prevMonths) {
          const settled = driverSettlements.find((s) => (s.period_type ?? 'month') === 'month' && s.month === pm)
          if (settled) continue
          const [py, pmm] = pm.split('-').map(Number)
          const { amount: pmSalary } = prorateSalary(driver.monthly_salary, driver.start_date, driver.end_date, py, pmm)
          const pmStart = `${pm}-01`
          const pmEnd = `${pm}-${String(lastDayOfMonth(py, pmm)).padStart(2, '0')}`
          const pmAdvances = (allPrevExpenses ?? []).filter(
            (e) => e.category === 'driver_advance' && (
              e.driver_profile_id === driver.id || e.note?.toLowerCase().includes(driver.name.toLowerCase())
            ) && e.date >= pmStart && e.date <= pmEnd
          ).reduce((s, e) => s + e.amount, 0)
          const { totalIncentive: pmIncentive } = calculateWeeklyIncentives(
            allDriverIncomes,
            driver.car_id, driver.incentive_target, driver.incentive_base, driver.incentive_step, driver.incentive_slab, py, pmm
          )
          const pmWeeklySettled = driverSettlements
            .filter((s) => (s.period_type ?? 'month') === 'week' && s.period_end.slice(0, 7) === pm)
            .reduce((sum, s) => sum + s.amount, 0)
          carryForward += pmSalary + pmIncentive - pmAdvances - pmWeeklySettled
        }

        const weeklySettledInsideMonth = driverSettlements
          .filter((s) => (s.period_type ?? 'month') === 'week' && s.period_end.slice(0, 7) === month)
          .reduce((sum, s) => sum + s.amount, 0)
        const netPayable = proRated + totalIncentive - totalAdvance + carryForward - weeklySettledInsideMonth

        let weeklyCarryForward = 0
        const weeklyRows = getWeeksCoveringRange(
          driver.start_date,
          driver.end_date && driver.end_date < currentDate ? driver.end_date : currentDate
        )
          .filter((week) => week.start <= currentWeekEnd)
          .map((week) => {
            const weekSalary = prorateSalaryForWeek(
              driver.monthly_salary,
              driver.start_date,
              driver.end_date,
              week
            ).amount
            const weekIncentive = calculateWeeklyIncentiveForRange(
              allDriverIncomes,
              driver.car_id,
              driver.incentive_target,
              driver.incentive_base,
              driver.incentive_step,
              driver.incentive_slab,
              week
            ).incentive
            const weekAdvance = allDriverExpenses
              .filter((expense) => expense.category === 'driver_advance' && (
                expense.driver_profile_id === driver.id ||
                expense.note?.toLowerCase().includes(driver.name.toLowerCase())
              ) && expense.date >= week.start && expense.date <= week.end)
              .reduce((sum, expense) => sum + expense.amount, 0)
            const settlement = driverSettlements.find(
              (s) => (s.period_type ?? 'month') === 'week' && s.period_start === week.start
            )
            const base = weekSalary + weekIncentive - weekAdvance
            const row = {
              weekStart: week.start,
              weekEnd: week.end,
              salary: weekSalary,
              incentive: weekIncentive,
              advance: weekAdvance,
              carryForward: weeklyCarryForward,
              netPayable: base + weeklyCarryForward,
              projected: week.end > currentDate,
              settlement,
            }
            weeklyCarryForward = settlement ? 0 : row.netPayable
            return row
          })
          .reverse()

        const isExpanded = expandedId === driver.id

        const handleWeeklySettle = async (row: WeeklySettlementRow) => {
          setSettlingId(driver.id)
          try {
            await addSettlement({
              driver_name: driver.name,
              driver_profile_id: driver.id,
              month: row.weekEnd.slice(0, 7),
              amount: row.netPayable,
              settled_date: row.weekEnd,
              period_type: 'week',
              period_start: row.weekStart,
              period_end: row.weekEnd,
            })
          } catch (error) {
            console.error('Weekly settlement save failed:', error)
            notifyApp('error', getSettlementErrorMessage(error))
          } finally {
            setSettlingId(null)
          }
        }

        const handleWeeklyUndo = async (settlement: DriverSettlementRow) => {
          setSettlingId(driver.id)
          try {
            await removeSettlement(settlement.id)
          } catch (error) {
            console.error('Weekly settlement undo failed:', error)
            notifyApp('error', 'Settlement could not be undone.')
          } finally {
            setSettlingId(null)
          }
        }
        const handleMonthlySettle = async () => {
          setSettlingId(driver.id)
          try {
            const earlier = prevMonths.filter((pm) => pm < month && !driverSettlements.some((s) => (
              (s.period_type ?? 'month') === 'month' && s.month === pm
            )))
            for (const pm of earlier) {
              const [py, pmm] = pm.split('-').map(Number)
              await addSettlement({
                driver_name: driver.name,
                driver_profile_id: driver.id,
                month: pm,
                amount: 0,
                settled_date: currentDate,
                period_type: 'month',
                period_start: `${pm}-01`,
                period_end: `${pm}-${String(lastDayOfMonth(py, pmm)).padStart(2, '0')}`,
              })
            }
            await addSettlement({
              driver_name: driver.name,
              driver_profile_id: driver.id,
              month,
              amount: netPayable,
              settled_date: currentDate,
              period_type: 'month',
              period_start: `${month}-01`,
              period_end: `${month}-${String(lastDayOfMonth(filterYear, filterMonth)).padStart(2, '0')}`,
            })
          } catch (error) {
            console.error('Settlement save failed:', error)
            notifyApp('error', getSettlementErrorMessage(error))
          } finally {
            setSettlingId(null)
          }
        }

        const handleMonthlyUndo = async (settlement: DriverSettlementRow) => {
          setSettlingId(driver.id)
          try {
            await removeSettlement(settlement.id)
          } catch (error) {
            console.error('Settlement undo failed:', error)
            notifyApp('error', 'Settlement could not be undone.')
          } finally {
            setSettlingId(null)
          }
        }
        const headerWeeklyRow = weeklyRows[0]
        const headerSettlement = viewMode === 'month' ? monthlySettlement : headerWeeklyRow?.settlement

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
                {headerSettlement ? (
                  <>
                    <p className="text-sm font-bold text-income">Settled</p>
                    <p className="text-[10px] text-text-muted">₹{fmt(headerSettlement.amount)}</p>
                  </>
                ) : (
                  <>
                    <p className={`text-sm font-bold ${(viewMode === 'month' ? netPayable : headerWeeklyRow?.netPayable ?? 0) >= 0 ? 'text-expense' : 'text-income'}`}>
                      {(viewMode === 'month' ? netPayable : headerWeeklyRow?.netPayable ?? 0) >= 0 ? 'Pay' : 'Over'} ₹{fmt(viewMode === 'month' ? netPayable : headerWeeklyRow?.netPayable ?? 0)}
                    </p>
                    <p className="text-[10px] text-text-muted">{viewMode === 'month' ? t.monthlyView : t.thisWeek}</p>
                  </>
                )}
              </div>
            </div>

            {/* Expanded Details */}
            {isExpanded && (
              <div className="border-t border-border-dim px-4 py-3 space-y-3">
                {viewMode === 'week' ? (
                  <WeeklySettlementPanel
                    rows={weeklyRows}
                    settlingId={settlingId}
                    onSettle={handleWeeklySettle}
                    onUndo={handleWeeklyUndo}
                    t={t}
                  />
                ) : (
                <div className="space-y-3">
                {/* Salary Breakdown */}
                <div className="grid grid-cols-3 gap-2">
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
                  {carryForward !== 0 && (
                    <div className="bg-surface-elevated rounded-xl p-2.5 text-center">
                      <p className="text-[9px] text-text-muted uppercase">Carry Fwd</p>
                      <p className={`text-sm font-bold ${carryForward >= 0 ? 'text-expense' : 'text-income'}`}>
                        {carryForward >= 0 ? '+' : ''}₹{fmt(carryForward)}
                      </p>
                      <p className="text-[9px] text-text-muted">prev months</p>
                    </div>
                  )}
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
                  const settlement = monthlySettlement
                  return (
                    <div className="bg-surface-elevated rounded-xl p-3">
                      {settlement ? (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 size={16} className="text-income" />
                            <div>
                              <p className="text-xs font-semibold text-income">Settled</p>
                              <p className="text-[10px] text-text-muted">Paid ₹{fmt(settlement.amount)} on {settlement.settled_date}</p>
                            </div>
                          </div>
                          <button
                            disabled={settlingId === driver.id}
                            onClick={() => handleMonthlyUndo(settlement)}
                            className="text-[10px] text-text-muted hover:text-white underline"
                          >
                            Undo
                          </button>
                        </div>
                      ) : (
                        <button
                          disabled={netPayable <= 0 || settlingId === driver.id || weeklySettledInsideMonth > 0}
                          onClick={handleMonthlySettle}
                          className={`w-full py-2 rounded-lg text-sm font-semibold transition-all ${
                            netPayable > 0 && weeklySettledInsideMonth === 0
                              ? 'bg-white text-black hover:bg-gray-200'
                              : 'bg-surface-card text-text-muted cursor-not-allowed'
                          }`}
                        >
                          {weeklySettledInsideMonth > 0
                            ? 'Weekly portions already settled'
                            : netPayable > 0
                              ? `Mark Settled — ₹${fmt(netPayable)}`
                              : 'Nothing to settle'}
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
                                try {
                                  const signedUrl = await getSignedUrl(url)
                                  if (signedUrl) window.open(signedUrl, '_blank')
                                } catch (error) {
                                  console.error('Driver document link failed:', error)
                                  notifyApp('error', 'Document could not be opened.')
                                }
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
                    disabled={removingId === driver.id}
                    onClick={async () => {
                      if (confirm(`Remove ${driver.name}?`)) {
                        setRemovingId(driver.id)
                        try {
                          await deleteDriverProfile(driver.id)
                        } catch (error) {
                          console.error('Driver removal failed:', error)
                          notifyApp('error', 'Driver could not be removed.')
                        } finally {
                          setRemovingId(null)
                        }
                      }
                    }}
                    className="flex items-center gap-1 text-xs text-expense hover:text-red-300 transition-colors disabled:opacity-50"
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
            )}
          </div>
        )
      })}

      {/* Info note */}
      <div className="bg-surface-card rounded-2xl p-3 border border-border-dim">
        <p className="text-[10px] text-text-muted leading-relaxed">
          💡 <strong className="text-text-secondary">Pro-rated salary</strong> is calculated based on the driver's start/end date
          within the selected month. Unsettled balances from previous months are automatically carried forward.
          To track advances, add an expense with category "Driver Advance" and select the driver.
        </p>
      </div>
    </div>
  )
}
