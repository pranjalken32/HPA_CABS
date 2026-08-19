import { useState } from 'react'
import { useMonthFilter } from '../hooks/useMonthFilter'
import { notifyApp, useIncomes, useExpenses, useGoal, upsertGoal, useDriverProfiles } from '../hooks/useSupabase'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import type { PieLabelRenderProps } from 'recharts'
import {
  TrendingDown,
  TrendingUp,
  Wallet,
  Car,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  IndianRupee,
  Share2,
  Target,
} from 'lucide-react'
import { generateMonthlySummary, shareViaWhatsApp } from '../utils/share'
import { formatLocalDate, lastDayOfMonth, parseLocalDate } from '../utils/date'
import { parsePositiveAmount } from '../utils/money'
import { prorateSalary } from '../utils/calculations'
import { useLanguage } from '../useLanguage'

const PLATFORM_COLORS: Record<string, string> = {
  rapido: '#f97316',
  ola: '#06c167',
  uber: '#ffffff',
  cash: '#999999',
  other: '#666666',
}

const EXPENSE_COLORS = [
  '#ff4444', '#f97316', '#eab308', '#06c167',
  '#06b6d4', '#ffffff', '#999999', '#ec4899',
]

const tooltipStyle = {
  contentStyle: {
    background: '#111111',
    border: '1px solid #222222',
    borderRadius: '12px',
    color: '#ffffff',
    fontSize: '12px',
  },
}

function getWeekNumber(dateStr: string): number {
  const d = parseLocalDate(dateStr)
  return Math.ceil(d.getDate() / 7)
}

function getWeekRange(year: number, month: number, week: number): string {
  const start = (week - 1) * 7 + 1
  const lastDay = new Date(year, month, 0).getDate()
  const end = Math.min(week * 7, lastDay)
  return `${start}–${end}`
}

function getTotalWeeks(year: number, month: number): number {
  const lastDay = new Date(year, month, 0).getDate()
  return Math.ceil(lastDay / 7)
}

interface WeekStats {
  week: string
  weekNum: number
  revenue: number
  income: number
  expense: number
  profit: number
  trips: number
  dailyChart: { date: string; income: number; expense: number; profit: number }[]
}

export default function Dashboard() {
  const { month, setMonth, startDate, endDate } = useMonthFilter()
  const { t } = useLanguage()
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null)
  const [showGoalInput, setShowGoalInput] = useState(false)
  const [goalInput, setGoalInput] = useState('')


  const incomes = useIncomes(startDate, endDate)
  const expenses = useExpenses(startDate, endDate)
  const goal = useGoal(month)

  const totalRevenue = incomes?.reduce((s, i) => s + i.amount, 0) ?? 0
  const totalExpense = expenses?.reduce((s, e) => s + e.amount, 0) ?? 0
  const netProfit = totalRevenue - totalExpense
  const totalTrips = incomes?.reduce((s, i) => s + i.trips, 0) ?? 0
  const [y, m] = month.split('-').map(Number)

  // Gross Profit (MTD) breakdown
  const expByCategory = (cat: string) => (expenses ?? []).filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0)
  const cngTotal = (expenses ?? []).filter(e => e.category === 'fuel' && (e.note?.toLowerCase().includes('cng') || !e.note?.toLowerCase().includes('petrol'))).reduce((s, e) => s + e.amount, 0)
  const petrolTotal = (expenses ?? []).filter(e => e.category === 'fuel' && e.note?.toLowerCase().includes('petrol')).reduce((s, e) => s + e.amount, 0)
  const commissionTotal = expByCategory('commission')
  const tollTotal = expByCategory('toll')
  const carWashTotal = expByCategory('car_wash')
  const fareFraudTotal = expByCategory('fare_fraud')
  const emiMonthly = expByCategory('emi')
  // Salary from driver profiles (prorated based on start/end dates)
  const driverProfiles = useDriverProfiles()
  const totalDaysInMonth = lastDayOfMonth(y, m)
  const totalProratedSalary = driverProfiles.reduce((sum, d) => {
    return sum + prorateSalary(d.monthly_salary, d.start_date, d.end_date, y, m).amount
  }, 0)
  // Prorate EMI by days elapsed; salary already reflects each driver's employment window.
  const today = new Date()
  const dayOfMonth = today.getDate()
  const todayStr = formatLocalDate(today)
  const isCurrentMonth = month === todayStr.slice(0, 7)
  const daysElapsed = isCurrentMonth ? dayOfMonth : totalDaysInMonth
  const emiTillDate = (emiMonthly / totalDaysInMonth) * daysElapsed
  const salaryTillDate = isCurrentMonth
    ? driverProfiles.reduce((sum, d) => {
        const endDay = Number(todayStr.slice(8, 10))
        const tillDays = Math.max(0, endDay - 1 + 1)
        const overlap = prorateSalary(d.monthly_salary, d.start_date, d.end_date, y, m)
        const startDay = Math.max(1, Number(d.start_date.slice(8, 10)))
        const employmentEnd = d.end_date && d.end_date.slice(0, 7) === month
          ? Number(d.end_date.slice(8, 10))
          : totalDaysInMonth
        const workingDays = Math.max(0, Math.min(tillDays, employmentEnd) - startDay + 1)
        return sum + Math.round((d.monthly_salary / totalDaysInMonth) * Math.min(overlap.workingDays, workingDays))
      }, 0)
    : totalProratedSalary
  const grossProfit = totalRevenue - cngTotal - petrolTotal - commissionTotal - tollTotal - carWashTotal - fareFraudTotal - emiTillDate - salaryTillDate
  const monthDays = Array.from({ length: totalDaysInMonth }, (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`)
  const incomeDates = new Set((incomes ?? []).map((income) => income.date))
  const missingIncomeDays = monthDays.filter((day) => !incomeDates.has(day)).length
  const zeroTripRows = (incomes ?? []).filter((income) => income.trips === 0).length
  const [goalSubmitting, setGoalSubmitting] = useState(false)

  const platformData = Object.entries(
    (incomes ?? []).reduce<Record<string, number>>((acc, i) => {
      acc[i.platform] = (acc[i.platform] ?? 0) + i.amount
      return acc
    }, {})
  ).map(([name, value]) => ({ name, value }))

  const categoryData = Object.entries(
    (expenses ?? []).reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + e.amount
      return acc
    }, {})
  ).map(([name, value]) => ({ name, value }))

  const totalWeeksInMonth = getTotalWeeks(y, m)

  const weekMap: Record<number, {
    income: number
    expense: number
    trips: number
    daily: Record<string, { date: string; income: number; expense: number; profit: number }>
  }> = {}

  for (let w = 1; w <= totalWeeksInMonth; w++) {
    weekMap[w] = { income: 0, expense: 0, trips: 0, daily: {} }
  }

  for (const i of incomes ?? []) {
    const w = getWeekNumber(i.date)
    if (!weekMap[w]) weekMap[w] = { income: 0, expense: 0, trips: 0, daily: {} }
    weekMap[w].income += i.amount
    weekMap[w].trips += i.trips
    const dayLabel = i.date.slice(5)
    if (!weekMap[w].daily[i.date]) weekMap[w].daily[i.date] = { date: dayLabel, income: 0, expense: 0, profit: 0 }
    weekMap[w].daily[i.date].income += i.amount
  }
  const WEEKLY_EXCLUDED = ['driver_salary', 'driver_advance', 'driver_incentive', 'emi', 'service']
  for (const e of expenses ?? []) {
    if (WEEKLY_EXCLUDED.includes(e.category)) continue
    const w = getWeekNumber(e.date)
    if (!weekMap[w]) weekMap[w] = { income: 0, expense: 0, trips: 0, daily: {} }
    weekMap[w].expense += e.amount
    const dayLabel = e.date.slice(5)
    if (!weekMap[w].daily[e.date]) weekMap[w].daily[e.date] = { date: dayLabel, income: 0, expense: 0, profit: 0 }
    weekMap[w].daily[e.date].expense += e.amount
  }

  const weeklyStats: WeekStats[] = Object.entries(weekMap)
    .map(([wNum, data]) => ({
      weekNum: Number(wNum),
      week: `Week ${wNum} (${getWeekRange(y, m, Number(wNum))})`,
      revenue: data.income,
      income: data.income,
      expense: data.expense,
      profit: data.income - data.expense,
      trips: data.trips,
      dailyChart: Object.values(data.daily).map(d => ({ ...d, profit: d.income - d.expense })).sort((a, b) => a.date.localeCompare(b.date)),
    }))
    .sort((a, b) => a.weekNum - b.weekNum)

  const weeklyChartData = weeklyStats.map((ws) => ({
    week: `W${ws.weekNum}`,
    revenue: ws.revenue,
    expense: ws.expense,
  }))

  const fmt = (n: number) => n.toLocaleString('en-IN')

  const toggleWeek = (weekNum: number) => {
    setExpandedWeek(expandedWeek === weekNum ? null : weekNum)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Dashboard</h2>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="border border-border-dim rounded-xl px-3 py-1.5 text-sm bg-surface-card text-white"
        />
      </div>

      {/* Goal Progress */}
      {goal ? (
        <div className="bg-surface-card rounded-2xl p-4 border border-border-dim">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Target size={16} className="text-white" />
              <span className="text-sm font-semibold text-white">Monthly Goal</span>
            </div>
            <span className="text-xs text-text-muted">
              ₹{fmt(totalRevenue)} / ₹{fmt(goal.target_revenue)}
            </span>
          </div>
          <div className="w-full h-3 bg-surface-elevated rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                totalRevenue >= goal.target_revenue
                  ? 'bg-income'
                  : 'bg-white'
              }`}
              style={{ width: `${Math.min(100, (totalRevenue / goal.target_revenue) * 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-text-muted">
              {Math.round((totalRevenue / goal.target_revenue) * 100)}% achieved
            </span>
            {totalRevenue >= goal.target_revenue && (
              <span className="text-[10px] text-income font-semibold">Goal reached!</span>
            )}
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowGoalInput(true)}
          className="w-full bg-surface-card rounded-2xl p-3 border border-dashed border-border-dim text-center text-sm text-text-muted hover:border-white transition-colors"
        >
          <Target size={16} className="inline mr-1" /> Set monthly revenue goal
        </button>
      )}

      {showGoalInput && !goal && (
        <div className="bg-surface-card rounded-2xl p-4 border border-border-dim space-y-3">
          <input
            type="number"
            step="0.01"
            inputMode="decimal"
            placeholder="Target revenue (e.g. 100000)"
            value={goalInput}
            onChange={(e) => setGoalInput(e.target.value)}
            className="w-full border border-border-dim bg-surface-elevated rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-text-muted focus:border-white focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              onClick={async () => {
                const target = parsePositiveAmount(goalInput)
                if (target === null) {
                  notifyApp('error', 'Enter a valid positive goal.')
                  return
                }
                setGoalSubmitting(true)
                try {
                  await upsertGoal(month, target)
                  setShowGoalInput(false)
                  setGoalInput('')
                } catch (error) {
                  console.error('Goal save failed:', error)
                  notifyApp('error', 'Goal could not be saved.')
                } finally {
                  setGoalSubmitting(false)
                }
              }}
              disabled={goalSubmitting}
              className="flex-1 bg-white text-black text-sm font-semibold py-2 rounded-xl"
            >
              {goalSubmitting ? 'Saving...' : 'Set Goal'}
            </button>
            <button
              onClick={() => { setShowGoalInput(false); setGoalInput('') }}
              className="px-4 text-sm text-text-muted py-2 rounded-xl border border-border-dim"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => {
            const text = generateMonthlySummary(month, incomes ?? [], expenses ?? [])
            shareViaWhatsApp(text)
          }}
          className="flex-1 bg-surface-card rounded-2xl p-3 border border-border-dim flex items-center gap-2 hover:border-income/30 transition-colors"
        >
          <Share2 size={18} className="text-income" />
          <span className="text-sm text-white">Share Monthly Summary</span>
        </button>
      </div>

      {/* MONTHLY OVERVIEW */}
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-border-dim" />
        <span className="text-[10px] uppercase tracking-widest text-text-muted font-semibold">Monthly Overview</span>
        <div className="h-px flex-1 bg-border-dim" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <SummaryCard label={t.revenue} value={fmt(totalRevenue)} icon={<IndianRupee size={20} />} color="text-white" />
        <SummaryCard label={t.netProfit} value={fmt(netProfit)} icon={<Wallet size={20} />} color={netProfit >= 0 ? 'text-income' : 'text-expense'} />
        <SummaryCard label={t.expenses} value={fmt(totalExpense)} icon={<TrendingDown size={20} />} color="text-expense" />
        <SummaryCard label={t.totalTrips} value={String(totalTrips)} icon={<Car size={20} />} color="text-white" isCurrency={false} />
      </div>
      {(missingIncomeDays > 0 || zeroTripRows > 0) && (
        <div className="bg-surface-card rounded-2xl p-4 border border-border-dim">
          <p className="text-sm font-semibold text-white">{t.dataGaps}</p>
          <p className="text-xs text-text-muted mt-1">
            {missingIncomeDays} {t.noIncomeDays}, and {zeroTripRows} {t.zeroTripRows}.
          </p>
        </div>
      )}

      {/* CASH FLOW */}
      <div className="bg-surface-card rounded-2xl p-4 border border-border-dim space-y-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Wallet size={16} className="text-accent" /> {t.cashFlow}
        </h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">{t.cashIn}</span>
            <span className="text-sm font-bold text-income">₹{fmt(totalRevenue)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">{t.cashOut}</span>
            <span className="text-sm font-bold text-expense">₹{fmt(totalExpense)}</span>
          </div>
          <div className="h-px bg-border-dim" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-secondary">{t.netCashFlow}</span>
            <span className={`text-sm font-bold ${netProfit >= 0 ? 'text-income' : 'text-expense'}`}>
              {netProfit >= 0 ? '+' : ''}₹{fmt(netProfit)}
            </span>
          </div>
        </div>
      </div>

      {/* GROSS PROFIT (MTD) */}
      <div className="bg-surface-card rounded-2xl p-4 border border-border-dim space-y-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <TrendingUp size={16} className="text-income" /> Gross Profit {isCurrentMonth ? '(Till Date)' : ''}
        </h3>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">Revenue</span>
            <span className="text-sm font-bold text-white">₹{fmt(totalRevenue)}</span>
          </div>
          {cngTotal > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">− CNG</span>
              <span className="text-sm font-bold text-expense">₹{fmt(cngTotal)}</span>
            </div>
          )}
          {petrolTotal > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">− Petrol</span>
              <span className="text-sm font-bold text-expense">₹{fmt(petrolTotal)}</span>
            </div>
          )}
          {commissionTotal > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">− Commission</span>
              <span className="text-sm font-bold text-expense">₹{fmt(commissionTotal)}</span>
            </div>
          )}
          {tollTotal > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">− FASTag / Toll</span>
              <span className="text-sm font-bold text-expense">₹{fmt(tollTotal)}</span>
            </div>
          )}
          {carWashTotal > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">− Car Wash</span>
              <span className="text-sm font-bold text-expense">₹{fmt(carWashTotal)}</span>
            </div>
          )}
          {fareFraudTotal > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">− Fare Fraud</span>
              <span className="text-sm font-bold text-expense">₹{fmt(fareFraudTotal)}</span>
            </div>
          )}
          {emiMonthly > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">− EMI ({daysElapsed}d of {totalDaysInMonth})</span>
              <span className="text-sm font-bold text-expense">₹{fmt(Math.round(emiTillDate))}</span>
            </div>
          )}
          {totalProratedSalary > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-muted">− Salary ({daysElapsed}d of {totalDaysInMonth})</span>
              <span className="text-sm font-bold text-expense">₹{fmt(Math.round(salaryTillDate))}</span>
            </div>
          )}
          <div className="h-px bg-border-dim" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-secondary">Gross Profit</span>
            <span className={`text-sm font-bold ${grossProfit >= 0 ? 'text-income' : 'text-expense'}`}>
              {grossProfit >= 0 ? '+' : ''}₹{fmt(Math.round(grossProfit))}
            </span>
          </div>
        </div>
      </div>

      {/* Monthly pie charts */}
      {platformData.length > 0 && (
        <div className="bg-surface-card rounded-2xl p-4 border border-border-dim">
          <h3 className="text-sm font-semibold text-text-secondary mb-3">Revenue by Platform</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={platformData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
                label={(props: PieLabelRenderProps) =>
                  `${props.name ?? ''} ${((props.percent ?? 0) * 100).toFixed(0)}%`
                }
              >
                {platformData.map((entry) => (
                  <Cell key={entry.name} fill={PLATFORM_COLORS[entry.name] ?? '#666666'} />
                ))}
              </Pie>
              <Tooltip {...tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {categoryData.length > 0 && (
        <div className="bg-surface-card rounded-2xl p-4 border border-border-dim overflow-hidden">
          <h3 className="text-sm font-semibold text-text-secondary mb-3">Expenses by Category</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="45%"
                innerRadius={40}
                outerRadius={65}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
                label={(props: PieLabelRenderProps) =>
                  `${((props.percent ?? 0) * 100).toFixed(0)}%`
                }
              >
                {categoryData.map((_, idx) => (
                  <Cell key={idx} fill={EXPENSE_COLORS[idx % EXPENSE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ color: '#999999', fontSize: '11px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* WEEKLY BREAKDOWN */}
      <div className="flex items-center gap-2 pt-2">
        <div className="h-px flex-1 bg-border-dim" />
        <span className="text-[10px] uppercase tracking-widest text-text-muted font-semibold">{t.weeklyBreakdown}</span>
        <div className="h-px flex-1 bg-border-dim" />
      </div>

      {/* Weekly comparison chart */}
      <div className="bg-surface-card rounded-2xl p-4 border border-border-dim">
        <div className="flex items-center gap-2 mb-3">
          <CalendarDays size={16} className="text-white" />
          <h3 className="text-sm font-semibold text-text-secondary">Week-by-Week</h3>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={weeklyChartData}>
            <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#666666' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#666666' }} axisLine={false} tickLine={false} />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey="revenue" name="Revenue" fill="#ffffff" radius={[6, 6, 0, 0]} />
            <Bar dataKey="expense" name="Expense" fill="#ff4444" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Expandable weekly cards */}
      <div className="space-y-2">
        {weeklyStats.map((ws) => {
          const isOpen = expandedWeek === ws.weekNum
          const hasData = ws.income > 0 || ws.expense > 0
          return (
            <div key={ws.weekNum} className="bg-surface-card rounded-2xl border border-border-dim overflow-hidden">
              <button
                onClick={() => toggleWeek(ws.weekNum)}
                className="w-full flex items-center justify-between p-4 text-left"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black ${
                    !hasData
                      ? 'bg-surface-elevated text-text-muted'
                      : ws.profit >= 0
                      ? 'bg-income/10 text-income'
                      : 'bg-expense/10 text-expense'
                  }`}>
                    W{ws.weekNum}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{ws.week}</p>
                    <p className="text-[11px] text-text-muted">
                      {hasData
                        ? `${ws.trips} trips · ₹${fmt(ws.revenue)} rev · ₹${fmt(ws.expense)} out`
                        : 'No data yet'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {hasData && (
                    <span className={`text-sm font-bold ${ws.profit >= 0 ? 'text-income' : 'text-expense'}`}>
                      {ws.profit >= 0 ? '+' : ''}₹{fmt(ws.profit)}
                    </span>
                  )}
                  {isOpen ? (
                    <ChevronUp size={16} className="text-text-muted" />
                  ) : (
                    <ChevronDown size={16} className="text-text-muted" />
                  )}
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-border-dim px-4 pb-4 pt-3 space-y-3">
                  {hasData ? (
                    <>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-surface-elevated rounded-lg p-2">
                          <p className="text-[9px] text-text-muted uppercase tracking-wider">Revenue</p>
                          <p className="text-xs font-bold text-white">₹{fmt(ws.revenue)}</p>
                        </div>
                        <div className="bg-surface-elevated rounded-lg p-2">
                          <p className="text-[9px] text-text-muted uppercase tracking-wider">Expense</p>
                          <p className="text-xs font-bold text-expense">₹{fmt(ws.expense)}</p>
                        </div>
                        <div className="bg-surface-elevated rounded-lg p-2">
                          <p className="text-[9px] text-text-muted uppercase tracking-wider">Profit</p>
                          <p className={`text-xs font-bold ${ws.profit >= 0 ? 'text-income' : 'text-expense'}`}>₹{fmt(ws.profit)}</p>
                        </div>
                      </div>

                      {ws.dailyChart.length > 0 && (
                        <div>
                          <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">Daily Detail</p>
                          <ResponsiveContainer width="100%" height={140}>
                            <BarChart data={ws.dailyChart}>
                              <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#666666' }} axisLine={false} tickLine={false} />
                              <YAxis tick={{ fontSize: 9, fill: '#666666' }} axisLine={false} tickLine={false} />
                              <Tooltip
                                {...tooltipStyle}
                                content={({ active, payload, label }) => {
                                  if (!active || !payload?.length) return null
                                  const inc = payload.find(p => p.dataKey === 'income')?.value as number ?? 0
                                  const exp = payload.find(p => p.dataKey === 'expense')?.value as number ?? 0
                                  const prof = inc - exp
                                  return (
                                    <div style={{ background: '#111', border: '1px solid #222', borderRadius: 12, padding: '8px 12px', fontSize: 12 }}>
                                      <p style={{ color: '#fff', fontWeight: 600, marginBottom: 4 }}>{label}</p>
                                      <p style={{ color: '#06c167' }}>income: {fmt(inc)}</p>
                                      <p style={{ color: '#ff4444' }}>expense: {fmt(exp)}</p>
                                      <p style={{ color: prof >= 0 ? '#06c167' : '#ff4444', fontWeight: 600, marginTop: 2, borderTop: '1px solid #333', paddingTop: 4 }}>
                                        profit: {prof >= 0 ? '+' : ''}{fmt(prof)}
                                      </p>
                                    </div>
                                  )
                                }}
                              />
                              <Bar dataKey="income" fill="#06c167" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="expense" fill="#ff4444" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-center text-text-muted text-xs py-4">No income or expenses this week</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>



      {/* Empty state */}
      {(incomes?.length ?? 0) === 0 && (expenses?.length ?? 0) === 0 && weeklyStats.length === 0 && (
        <div className="text-center py-12 text-text-muted">
          <p className="text-lg">No data for this month</p>
          <p className="text-sm mt-1">Start adding income & expenses!</p>
        </div>
      )}
    </div>
  )
}

function SummaryCard({
  label,
  value,
  icon,
  color,
  isCurrency = true,
  subtitle,
}: {
  label: string
  value: string
  icon: React.ReactNode
  color: string
  isCurrency?: boolean
  subtitle?: string
}) {
  return (
    <div className="bg-surface-card rounded-2xl p-4 border border-border-dim">
      <div className="flex items-center gap-2 mb-1">
        <span className={color}>{icon}</span>
        <span className="text-xs text-text-muted font-medium">{label}</span>
      </div>
      <p className={`text-xl font-bold ${color}`}>
        {isCurrency && '₹'}
        {value}
      </p>
      {subtitle && <p className="text-[10px] text-text-muted mt-0.5">{subtitle}</p>}
    </div>
  )
}
