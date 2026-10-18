import { useState } from 'react'
import {
  notifyApp,
  useDriverProfiles,
  useAllExpenses,
  useAllIncomes,
  useCars,
  addDriverProfile,
  updateDriverProfile,
  deleteDriverProfile,
  uploadDriverDoc,
  getSignedUrl,
  useDriverSettlements,
  useDriverDailyIncentives,
  upsertDriverDailyIncentive,
  removeDriverDailyIncentive,
  addSettlement,
  updateSettlementAmount,
  removeSettlement,
  getSettlementErrorKind,
  useDriverUsers,
} from '../hooks/useSupabase'
import type { DriverProfileRow } from '../hooks/useSupabase'
import { Users, Plus, Edit2, Trash2, FileText, Upload, X, CheckCircle2, Target, ChevronLeft, ChevronRight } from 'lucide-react'
import { useLanguage } from '../useLanguage'
import { isValidCalendarDate, parseLocalDate, todayStr } from '../utils/date'
import { fmt, parseNonNegativeNumber, parsePositiveAmount } from '../utils/money'
import {
  deriveDailySettlementDays,
  deriveWeeklySettlementRows,
  getWeekBalanceAsOf,
} from '../utils/calculations'
import type { WeeklySettlementLike, WeeklySettlementRow } from '../utils/calculations'

type SlabInput = { revenue: string; incentive: string }

const FALLBACK_DAILY_SLABS: SlabInput[] = [
  { revenue: '3000', incentive: '100' },
  { revenue: '3500', incentive: '200' },
  { revenue: '4000', incentive: '400' },
  { revenue: '4500', incentive: '650' },
]

function getDefaultDailySlabs(): SlabInput[] {
  try {
    const stored = JSON.parse(localStorage.getItem('hpa_incentive_slabs') || 'null')
    if (Array.isArray(stored)) {
      return stored.map((slab) => ({
        revenue: String(slab.revenue ?? ''),
        incentive: String(slab.incentive ?? ''),
      }))
    }
  } catch {
    // Fall through to the agreed defaults.
  }
  return FALLBACK_DAILY_SLABS.map((slab) => ({ ...slab }))
}

function formatDayLabel(date: string): string {
  return parseLocalDate(date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
}

function formatShortDay(date: string): string {
  return parseLocalDate(date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' })
}

function money(value: number, decimals = 0): string {
  const factor = 10 ** decimals
  return fmt(Math.round(value * factor) / factor)
}

function signedMoney(value: number, currency = true): string {
  const rounded = currency ? Math.round(value * 100) / 100 : Math.round(value)
  return `${rounded < 0 ? '−' : '+'}${currency ? '₹' : ''}${fmt(rounded)}`
}

function balanceClass(value: number): string {
  return Math.round(value) >= 0 ? 'text-expense' : 'text-income'
}

function DriverWeekTable({
  rows,
  driver,
  incomes,
  expenses,
  today,
  busy,
  onPay,
  onUndo,
  t,
}: {
  rows: WeeklySettlementRow[]
  driver: DriverProfileRow
  incomes: Parameters<typeof deriveDailySettlementDays>[2]
  expenses: Parameters<typeof deriveDailySettlementDays>[3]
  today: string
  busy: boolean
  onPay: (row: WeeklySettlementRow, amount: number) => Promise<void>
  onUndo: (settlement: WeeklySettlementLike) => void
  t: ReturnType<typeof useLanguage>['t']
}) {
  const [weekIndex, setWeekIndex] = useState(0)
  const [payOpen, setPayOpen] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const index = Math.min(weekIndex, rows.length - 1)
  const row = rows[index]
  if (!row) return null

  const coveredByMonth = row.coverage === 'monthly' || row.coverage === 'partial'
  const days = coveredByMonth ? [] : deriveDailySettlementDays(driver, row, incomes, expenses)
  const totalRevenue = days.reduce((sum, day) => sum + day.revenue, 0)
  const weeklyTargetIncentive = row.incentive - days.reduce((sum, day) => sum + day.incentive, 0)
  const latestPaidIndex = rows.findIndex((candidate) => candidate.settlement)
  const carriedForward = latestPaidIndex !== -1 && index > latestPaidIndex && !row.settlement
  const balance = getWeekBalanceAsOf(row, days, today)
  const settledUp = Math.abs(balance) < 0.5
  const cell = 'py-1.5 px-0.5 text-right whitespace-nowrap'

  const goToWeek = (next: number) => {
    setWeekIndex(next)
    setPayOpen(false)
    setPayAmount('')
  }

  const submitPayment = async (event: React.FormEvent) => {
    event.preventDefault()
    const amount = Number(payAmount)
    if (payAmount.trim() === '' || !Number.isFinite(amount) || Math.round(amount * 100) === 0) {
      notifyApp('error', t.invalidPaymentAmount)
      return
    }
    await onPay(row, amount)
    setPayOpen(false)
    setPayAmount('')
  }

  return (
    <div className="bg-surface-elevated rounded-xl p-3 border border-border-dim space-y-2">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label={t.previousWeek}
          disabled={index >= rows.length - 1}
          onClick={() => goToWeek(index + 1)}
          className="p-1.5 rounded-lg bg-surface-card text-text-secondary disabled:opacity-30"
        >
          <ChevronLeft size={16} />
        </button>
        <p className="text-xs font-semibold text-white text-center">
          {formatDayLabel(row.weekStart)} – {formatDayLabel(row.weekEnd)}
        </p>
        <button
          type="button"
          aria-label={t.nextWeek}
          disabled={index === 0}
          onClick={() => goToWeek(index - 1)}
          className="p-1.5 rounded-lg bg-surface-card text-text-secondary disabled:opacity-30"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {coveredByMonth ? (
        <p className="text-[10px] text-text-secondary">
          {row.coverage === 'monthly' ? t.coveredByMonthlySettlement : t.partiallyCoveredByMonthlySettlement}
        </p>
      ) : (
        <>
          <p className="text-[10px] text-text-muted">
            {t.carriedIn}: <span className={`font-semibold ${balanceClass(row.carryForward)}`}>{signedMoney(row.carryForward)}</span>
          </p>
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-[10px] tabular-nums">
              <thead>
                <tr className="text-[8px] uppercase text-text-muted align-bottom">
                  <th className="py-1 px-0.5 text-left font-medium">{t.date}</th>
                  <th className="py-1 px-0.5 text-right font-medium">{t.revenue}</th>
                  <th className="py-1 px-0.5 text-right font-medium">{t.salary}</th>
                  <th className="py-1 px-0.5 text-right font-medium">{t.incentive}</th>
                  <th className="py-1 px-0.5 text-right font-medium">{t.advances}</th>
                  <th className="py-1 px-0.5 text-right font-medium">{t.dayNet}</th>
                  <th className="py-1 px-0.5 text-right font-medium">{t.running}</th>
                </tr>
              </thead>
              <tbody>
                {days.map((day) => (
                  <tr key={day.date} className={`border-t border-border-dim ${day.date > today ? 'opacity-40' : ''}`}>
                    <td className="py-1.5 px-0.5 text-left whitespace-nowrap text-text-secondary">{formatShortDay(day.date)}</td>
                    <td className={`${cell} text-white`}>{day.revenue > 0 ? money(day.revenue) : '—'}</td>
                    <td className={`${cell} text-text-secondary`}>{money(day.salary)}</td>
                    <td className={`${cell} text-income`}>
                      {day.incentive > 0 ? money(day.incentive) : '—'}
                      {day.incentiveSource === 'manual' && <span className="ml-0.5 text-[9px] font-bold text-accent">M</span>}
                    </td>
                    <td className={`${cell} text-text-secondary`}>{day.advance > 0 ? money(day.advance) : '—'}</td>
                    <td className={`${cell} ${balanceClass(day.dayNet)}`}>{signedMoney(day.dayNet, false)}</td>
                    <td className={`${cell} font-semibold ${balanceClass(day.running)}`}>{signedMoney(day.running, false)}</td>
                  </tr>
                ))}
                {weeklyTargetIncentive > 0.005 && (
                  <tr className="border-t border-border-dim">
                    <td colSpan={3} className="py-1.5 px-1 text-left text-text-secondary">{t.weekIncentive}</td>
                    <td className={`${cell} text-income`}>{money(weeklyTargetIncentive)}</td>
                    <td colSpan={3} />
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t border-border-dim font-bold text-white">
                  <td className="py-1.5 px-0.5 text-left">{t.total}</td>
                  <td className={cell}>{money(totalRevenue)}</td>
                  <td className={cell}>{money(row.salary)}</td>
                  <td className={`${cell} text-income`}>{money(row.incentive)}</td>
                  <td className={cell}>{money(row.advance)}</td>
                  <td className={`${cell} ${balanceClass(row.basePayable)}`}>{signedMoney(row.basePayable, false)}</td>
                  <td className={`${cell} ${balanceClass(row.netPayable)}`}>{signedMoney(row.netPayable, false)}</td>
                </tr>
                {row.settlement && (
                  <tr className="border-t border-border-dim text-income">
                    <td colSpan={5} className="py-1.5 px-1 text-left">
                      <CheckCircle2 size={12} className="inline mr-1 -mt-0.5" />
                      {t.paidOn} {formatDayLabel(row.settlement.settled_date)}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onUndo(row.settlement!)}
                        className="ml-2 text-text-muted underline hover:text-white disabled:opacity-50"
                      >
                        {t.undo}
                      </button>
                    </td>
                    <td className={cell}>−{money(row.settlement.amount)}</td>
                    <td className={`${cell} font-bold ${balanceClass(row.netPayable - row.settlement.amount)}`}>
                      {signedMoney(row.netPayable - row.settlement.amount, false)}
                    </td>
                  </tr>
                )}
              </tfoot>
            </table>
          </div>
          <p className="text-[9px] text-text-muted">M = {t.manual} · {t.balanceSignHint}</p>

          {carriedForward ? (
            <p className="text-[10px] text-text-secondary text-center">{t.carriedToLaterWeeks}</p>
          ) : (
            <>
              <p className="text-xs text-center">
                <span className="text-text-muted">{t.balanceNow}: </span>
                {settledUp ? (
                  <span className="font-semibold text-income">{t.settled}</span>
                ) : (
                  <span className={`font-semibold ${balanceClass(balance)}`}>
                    {balance > 0 ? t.payDriver : t.driverOwes} ₹{money(Math.abs(balance), 2)}
                  </span>
                )}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={busy || settledUp}
                  onClick={() => onPay(row, balance)}
                  className="py-2 rounded-lg text-sm font-semibold bg-white text-black disabled:bg-surface-card disabled:text-text-muted"
                >
                  {t.markAsSettled}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setPayOpen((open) => !open)}
                  className="py-2 rounded-lg text-sm font-semibold bg-surface-card text-white border border-border-dim disabled:opacity-50"
                >
                  {t.paidAction}
                </button>
              </div>
              {payOpen && (
                <form onSubmit={submitPayment} className="space-y-1">
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="0.01"
                      inputMode="decimal"
                      autoFocus
                      value={payAmount}
                      onChange={(event) => setPayAmount(event.target.value)}
                      placeholder={t.amountPaidPlaceholder}
                      className="min-w-0 flex-1 bg-surface-card border border-border-dim rounded-lg px-2.5 py-1.5 text-sm text-white"
                    />
                    <button
                      type="submit"
                      disabled={busy}
                      className="px-4 rounded-lg text-sm font-semibold bg-white text-black disabled:opacity-50"
                    >
                      {t.save}
                    </button>
                  </div>
                  <p className="text-[9px] text-text-muted">{t.paymentHint}</p>
                </form>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

export default function Drivers() {
  const { t } = useLanguage()
  const drivers = useDriverProfiles()
  const allExpenses = useAllExpenses()
  const allIncomes = useAllIncomes()
  const cars = useCars()
  const settlements = useDriverSettlements({})
  const dailyIncentives = useDriverDailyIncentives()
  const [showForm, setShowForm] = useState(false)
  const [editDriver, setEditDriver] = useState<DriverProfileRow | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)

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
  const [dailyIncentiveFrom, setDailyIncentiveFrom] = useState('')
  const [dailySlabs, setDailySlabs] = useState<SlabInput[]>(getDefaultDailySlabs)
  const [manualDate, setManualDate] = useState(todayStr())
  const [manualAmount, setManualAmount] = useState('')
  const [manualNote, setManualNote] = useState('')
  const [manualSubmitting, setManualSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [authUserIdInput, setAuthUserIdInput] = useState<string>('')
  const driverUsers = useDriverUsers()

  const [submitting, setSubmitting] = useState(false)
  const [settlingId, setSettlingId] = useState<number | null>(null)
  const [removingId, setRemovingId] = useState<number | null>(null)
  const currentDate = todayStr()

  const setExpandedDriver = (nextId: number | null) => {
    setManualDate(todayStr())
    setManualAmount('')
    setManualNote('')
    setExpandedId(nextId)
  }

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
    setDailyIncentiveFrom('')
    setDailySlabs(getDefaultDailySlabs())
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
    setDailyIncentiveFrom(d.daily_incentive_from ?? '')
    setDailySlabs((d.daily_incentive_slabs ?? []).map((slab) => ({
      revenue: String(slab.revenue),
      incentive: String(slab.incentive),
    })))
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
    const parsedDailySlabs = dailySlabs.map((slab) => ({
      revenue: parseNonNegativeNumber(slab.revenue),
      incentive: parseNonNegativeNumber(slab.incentive),
    }))
    if (!name.trim() || monthlySalary === null || (carIdInput !== '' && carId === null) || incentiveTarget === null || incentiveBase === null || incentiveStep === null || incentiveSlab === null ||
      !isValidCalendarDate(startDateInput) || (endDateInput !== '' && !isValidCalendarDate(endDateInput)) ||
      (dailyIncentiveFrom !== '' && !isValidCalendarDate(dailyIncentiveFrom)) ||
      parsedDailySlabs.some((slab) => slab.revenue === null || slab.incentive === null)) {
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
      daily_incentive_from: dailyIncentiveFrom || null,
      daily_incentive_slabs: parsedDailySlabs as { revenue: number; incentive: number }[],
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
                <Target size={10} /> {t.dailyIncentiveSlabs}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] text-text-muted block mb-0.5">{t.legacyWeeklyTarget}</label>
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
                  <label className="text-[9px] text-text-muted block mb-0.5">{t.effectiveFrom}</label>
                  <input
                    type="date"
                    value={dailyIncentiveFrom}
                    onChange={(e) => setDailyIncentiveFrom(e.target.value)}
                    className="w-full bg-surface-card border border-border-dim rounded-lg px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
              </div>
              <p className="text-[9px] text-text-muted">
                {t.dailyRuleDescription} {dailyIncentiveFrom || t.notSet}
              </p>
              <div className="space-y-1.5">
                {dailySlabs.map((slab, index) => (
                  <div key={index} className="flex items-center gap-1.5">
                    <span className="text-[10px] text-text-muted">{t.revenueThreshold}</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={slab.revenue}
                      onChange={(e) => setDailySlabs((current) => current.map((item, i) => i === index ? { ...item, revenue: e.target.value } : item))}
                      className="min-w-0 flex-1 bg-surface-card border border-border-dim rounded-lg px-2.5 py-1.5 text-xs text-white"
                      placeholder={t.revenue}
                    />
                    <span className="text-[10px] text-text-muted">{t.incentiveAmount}</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={slab.incentive}
                      onChange={(e) => setDailySlabs((current) => current.map((item, i) => i === index ? { ...item, incentive: e.target.value } : item))}
                      className="min-w-0 flex-1 bg-surface-card border border-border-dim rounded-lg px-2.5 py-1.5 text-xs text-white"
                      placeholder={t.incentive}
                    />
                    <button
                      type="button"
                      onClick={() => setDailySlabs((current) => current.filter((_, i) => i !== index))}
                      className="p-1 text-text-muted hover:text-white"
                      aria-label={t.removeSlab}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setDailySlabs((current) => [...current, { revenue: '', incentive: '' }])}
                  className="text-[10px] text-text-secondary underline"
                >
                  + {t.addSlab}
                </button>
              </div>
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
        const driverSettlements = settlements.filter(
          (settlement) => settlement.driver_profile_id === driver.id || settlement.driver_name === driver.name
        )
        const driverManualIncentives = dailyIncentives.filter(
          (entry) => entry.driver_profile_id === driver.id
        )
        const recentManualIncentives = [...driverManualIncentives]
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 10)

        const weeklyRows = deriveWeeklySettlementRows(
          driver,
          allIncomes ?? [],
          allExpenses ?? [],
          driverSettlements,
          currentDate,
          driverManualIncentives
        ).reverse()
        const latestRow = weeklyRows[0]
        const latestBalance = latestRow
          ? getWeekBalanceAsOf(
            latestRow,
            deriveDailySettlementDays(driver, latestRow, allIncomes ?? [], allExpenses ?? []),
            currentDate
          )
          : 0

        const isExpanded = expandedId === driver.id

        const handlePayment = async (row: WeeklySettlementRow, amount: number) => {
          const rounded = Math.round(amount * 100) / 100
          setSettlingId(driver.id)
          try {
            if (row.settlement) {
              await updateSettlementAmount(
                row.settlement.id,
                Math.round((row.settlement.amount + rounded) * 100) / 100,
                currentDate
              )
            } else {
              await addSettlement({
                driver_name: driver.name,
                driver_profile_id: driver.id,
                month: row.weekEnd.slice(0, 7),
                amount: rounded,
                settled_date: currentDate,
                period_type: 'week',
                period_start: row.weekStart,
                period_end: row.weekEnd,
              })
            }
          } catch (error) {
            console.error('Driver payment save failed:', error)
            notifyApp('error', getSettlementErrorKind(error) === 'overlap' ? t.settlementOverlap : t.settlementFailed)
          } finally {
            setSettlingId(null)
          }
        }

        const handleWeeklyUndo = async (settlement: WeeklySettlementLike) => {
          setSettlingId(driver.id)
          try {
            await removeSettlement(settlement.id)
          } catch (error) {
            console.error('Weekly settlement undo failed:', error)
            notifyApp('error', t.settlementUndoFailed)
          } finally {
            setSettlingId(null)
          }
        }
        const handleManualIncentiveSave = async (event: React.FormEvent) => {
          event.preventDefault()
          const amount = parseNonNegativeNumber(manualAmount)
          if (!isValidCalendarDate(manualDate) || amount === null) {
            notifyApp('error', t.invalidManualIncentive)
            return
          }
          setManualSubmitting(true)
          try {
            await upsertDriverDailyIncentive({
              driver_profile_id: driver.id,
              date: manualDate,
              amount,
              note: manualNote || null,
            })
            setManualAmount('')
            setManualNote('')
          } catch (error) {
            console.error('Manual incentive save failed:', error)
            notifyApp('error', t.manualIncentiveFailed)
          } finally {
            setManualSubmitting(false)
          }
        }
        const handleManualIncentiveRemove = async (date: string) => {
          try {
            await removeDriverDailyIncentive(driver.id, date)
          } catch (error) {
            console.error('Manual incentive delete failed:', error)
            notifyApp('error', t.manualIncentiveFailed)
          }
        }

        return (
          <div key={driver.id} className="bg-surface-card rounded-2xl border border-border-dim overflow-hidden">
            <div
              className="px-4 py-3 flex items-center justify-between cursor-pointer"
              onClick={() => setExpandedDriver(isExpanded ? null : driver.id)}
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
                {Math.abs(latestBalance) < 0.5 ? (
                  <p className="text-sm font-bold text-income">{t.settled}</p>
                ) : (
                  <p className={`text-sm font-bold ${balanceClass(latestBalance)}`}>
                    {latestBalance > 0 ? t.payDriver : t.driverOwes} ₹{money(Math.abs(latestBalance))}
                  </p>
                )}
                <p className="text-[10px] text-text-muted">{t.balanceNow}</p>
              </div>
            </div>

            {isExpanded && (
              <div className="border-t border-border-dim px-4 py-3 space-y-3">
                <DriverWeekTable
                  rows={weeklyRows}
                  driver={driver}
                  incomes={allIncomes ?? []}
                  expenses={allExpenses ?? []}
                  today={currentDate}
                  busy={settlingId !== null}
                  onPay={handlePayment}
                  onUndo={handleWeeklyUndo}
                  t={t}
                />
                <details>
                  <summary className="text-xs text-text-secondary cursor-pointer select-none">{t.editDriverDetails}</summary>
                  <div className="space-y-3 mt-3">
                <div className="bg-surface-elevated rounded-xl p-3 border border-border-dim space-y-2">
                  <p className="text-[10px] text-text-muted uppercase">{t.manualIncentive}</p>
                  <form onSubmit={handleManualIncentiveSave} className="grid grid-cols-3 gap-1.5">
                    <input
                      type="date"
                      value={manualDate}
                      onChange={(event) => setManualDate(event.target.value)}
                      className="bg-surface-card border border-border-dim rounded-lg px-2 py-1.5 text-xs text-white"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={manualAmount}
                      onChange={(event) => setManualAmount(event.target.value)}
                      placeholder={t.amount}
                      className="bg-surface-card border border-border-dim rounded-lg px-2 py-1.5 text-xs text-white"
                    />
                    <input
                      value={manualNote}
                      onChange={(event) => setManualNote(event.target.value)}
                      placeholder={t.note}
                      className="bg-surface-card border border-border-dim rounded-lg px-2 py-1.5 text-xs text-white"
                    />
                    <button
                      type="submit"
                      disabled={manualSubmitting}
                      className="col-span-3 bg-white text-black rounded-lg py-1.5 text-xs font-semibold disabled:opacity-50"
                    >
                      {manualSubmitting ? t.saving : t.save}
                    </button>
                  </form>
                  {recentManualIncentives.length === 0 ? (
                    <p className="text-[10px] text-text-muted">{t.noManualIncentives}</p>
                  ) : (
                    <div className="space-y-1">
                      {recentManualIncentives.map((entry) => (
                        <div key={entry.date} className="flex items-center justify-between text-[10px]">
                          <span className="text-text-secondary">
                            <span className="text-accent mr-1">{t.manual}</span>
                            {entry.date} · ₹{fmt(entry.amount)}{entry.note ? ` · ${entry.note}` : ''}
                          </span>
                          <span className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setManualDate(entry.date)
                                setManualAmount(String(entry.amount))
                                setManualNote(entry.note ?? '')
                              }}
                              className="text-text-muted hover:text-white underline"
                            >
                              {t.edit}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleManualIncentiveRemove(entry.date)}
                              className="text-text-muted hover:text-white underline"
                            >
                              {t.delete}
                            </button>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
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
                  </div>
                </details>
              </div>
            )}
          </div>
        )
      })}

      <div className="bg-surface-card rounded-2xl p-3 border border-border-dim">
        <p className="text-[10px] text-text-muted leading-relaxed">
          To track advances, add an expense with category "Driver Advance" and select the driver.
        </p>
      </div>
    </div>
  )
}
