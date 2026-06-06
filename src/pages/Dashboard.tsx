import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { useMonthFilter } from '../hooks/useMonthFilter'
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
  TrendingUp,
  TrendingDown,
  Wallet,
  Car,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  IndianRupee,
} from 'lucide-react'

const PLATFORM_COLORS: Record<string, string> = {
  rapido: '#f97316',
  ola: '#22c55e',
  uber: '#3b82f6',
  cash: '#a29bfe',
  other: '#64748b',
}

const EXPENSE_COLORS = [
  '#ff5252', '#f97316', '#eab308', '#00e676',
  '#06b6d4', '#6c5ce7', '#a29bfe', '#ec4899',
]

const tooltipStyle = {
  contentStyle: {
    background: '#1a1a2e',
    border: '1px solid #2a2a45',
    borderRadius: '12px',
    color: '#e8e8f0',
    fontSize: '12px',
  },
}

function getWeekNumber(dateStr: string): number {
  const d = new Date(dateStr)
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
  dailyChart: { date: string; income: number; expense: number }[]
}

export default function Dashboard() {
  const { month, setMonth, startDate, endDate } = useMonthFilter()
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null)

  const incomes = useLiveQuery(
    () =>
      db.incomes
        .where('date')
        .between(startDate, endDate, true, true)
        .toArray(),
    [startDate, endDate]
  )

  const expenses = useLiveQuery(
    () =>
      db.expenses
        .where('date')
        .between(startDate, endDate, true, true)
        .toArray(),
    [startDate, endDate]
  )

  const totalIncome = incomes?.reduce((s, i) => s + i.amount, 0) ?? 0
  const totalExpense = expenses?.reduce((s, e) => s + e.amount, 0) ?? 0
  const netProfit = totalIncome - totalExpense
  const totalTrips = incomes?.reduce((s, i) => s + i.trips, 0) ?? 0

  // Revenue = income from platforms (rapido, ola, uber) — cash/other is also income but platform revenue
  const totalRevenue = totalIncome

  // Platform breakdown (monthly)
  const platformData = Object.entries(
    (incomes ?? []).reduce<Record<string, number>>((acc, i) => {
      acc[i.platform] = (acc[i.platform] ?? 0) + i.amount
      return acc
    }, {})
  ).map(([name, value]) => ({ name, value }))

  // Expense category breakdown (monthly)
  const categoryData = Object.entries(
    (expenses ?? []).reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + e.amount
      return acc
    }, {})
  ).map(([name, value]) => ({ name, value }))

  // Weekly stats — show ALL weeks of the month
  const [y, m] = month.split('-').map(Number)
  const totalWeeksInMonth = getTotalWeeks(y, m)

  const weekMap: Record<number, {
    income: number
    expense: number
    trips: number
    daily: Record<string, { date: string; income: number; expense: number }>
  }> = {}

  // Initialize all weeks
  for (let w = 1; w <= totalWeeksInMonth; w++) {
    weekMap[w] = { income: 0, expense: 0, trips: 0, daily: {} }
  }

  for (const i of incomes ?? []) {
    const w = getWeekNumber(i.date)
    if (!weekMap[w]) weekMap[w] = { income: 0, expense: 0, trips: 0, daily: {} }
    weekMap[w].income += i.amount
    weekMap[w].trips += i.trips
    const dayLabel = i.date.slice(5)
    if (!weekMap[w].daily[i.date]) weekMap[w].daily[i.date] = { date: dayLabel, income: 0, expense: 0 }
    weekMap[w].daily[i.date].income += i.amount
  }
  for (const e of expenses ?? []) {
    const w = getWeekNumber(e.date)
    if (!weekMap[w]) weekMap[w] = { income: 0, expense: 0, trips: 0, daily: {} }
    weekMap[w].expense += e.amount
    const dayLabel = e.date.slice(5)
    if (!weekMap[w].daily[e.date]) weekMap[w].daily[e.date] = { date: dayLabel, income: 0, expense: 0 }
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
      dailyChart: Object.values(data.daily).sort((a, b) => a.date.localeCompare(b.date)),
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
        <h2 className="text-xl font-bold text-text-primary">Dashboard</h2>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="border border-border-dim rounded-xl px-3 py-1.5 text-sm bg-surface-card text-text-primary"
        />
      </div>

      {/* ─── MONTHLY OVERVIEW ─── */}
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-border-dim" />
        <span className="text-[10px] uppercase tracking-widest text-text-muted font-semibold">Monthly Overview</span>
        <div className="h-px flex-1 bg-border-dim" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <SummaryCard
          label="Revenue"
          value={fmt(totalRevenue)}
          icon={<IndianRupee size={20} />}
          color="text-accent-light"
          gradient="from-accent/20 to-purple-500/5"
        />
        <SummaryCard
          label="Net Profit"
          value={fmt(netProfit)}
          icon={<Wallet size={20} />}
          color={netProfit >= 0 ? 'text-income' : 'text-expense'}
          gradient={netProfit >= 0 ? 'from-green-500/20 to-emerald-500/5' : 'from-red-500/20 to-rose-500/5'}
        />
        <SummaryCard
          label="Income"
          value={fmt(totalIncome)}
          icon={<TrendingUp size={20} />}
          color="text-income"
          gradient="from-green-500/20 to-emerald-500/5"
        />
        <SummaryCard
          label="Expenses"
          value={fmt(totalExpense)}
          icon={<TrendingDown size={20} />}
          color="text-expense"
          gradient="from-red-500/20 to-rose-500/5"
        />
        <SummaryCard
          label="Total Trips"
          value={String(totalTrips)}
          icon={<Car size={20} />}
          color="text-text-primary"
          gradient="from-slate-500/10 to-slate-500/5"
          isCurrency={false}
        />
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
                  <Cell key={entry.name} fill={PLATFORM_COLORS[entry.name] ?? '#94a3b8'} />
                ))}
              </Pie>
              <Tooltip {...tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {categoryData.length > 0 && (
        <div className="bg-surface-card rounded-2xl p-4 border border-border-dim">
          <h3 className="text-sm font-semibold text-text-secondary mb-3">Expenses by Category</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={categoryData}
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
                {categoryData.map((_, idx) => (
                  <Cell key={idx} fill={EXPENSE_COLORS[idx % EXPENSE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ color: '#8888a8', fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ─── WEEKLY BREAKDOWN ─── */}
      <div className="flex items-center gap-2 pt-2">
        <div className="h-px flex-1 bg-border-dim" />
        <span className="text-[10px] uppercase tracking-widest text-text-muted font-semibold">Weekly Breakdown</span>
        <div className="h-px flex-1 bg-border-dim" />
      </div>

      {/* Weekly comparison chart */}
      <div className="bg-surface-card rounded-2xl p-4 border border-border-dim">
        <div className="flex items-center gap-2 mb-3">
          <CalendarDays size={16} className="text-accent-light" />
          <h3 className="text-sm font-semibold text-text-secondary">Week-by-Week</h3>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={weeklyChartData}>
            <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#8888a8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#8888a8' }} axisLine={false} tickLine={false} />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey="revenue" name="Revenue" fill="#a29bfe" radius={[6, 6, 0, 0]} />
            <Bar dataKey="expense" name="Expense" fill="#ff5252" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Expandable weekly cards — all weeks */}
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
                    <p className="text-sm font-semibold text-text-primary">{ws.week}</p>
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
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div className="bg-surface-elevated rounded-lg p-2">
                          <p className="text-[9px] text-text-muted uppercase tracking-wider">Revenue</p>
                          <p className="text-xs font-bold text-accent-light">₹{fmt(ws.revenue)}</p>
                        </div>
                        <div className="bg-surface-elevated rounded-lg p-2">
                          <p className="text-[9px] text-text-muted uppercase tracking-wider">Income</p>
                          <p className="text-xs font-bold text-income">₹{fmt(ws.income)}</p>
                        </div>
                        <div className="bg-surface-elevated rounded-lg p-2">
                          <p className="text-[9px] text-text-muted uppercase tracking-wider">Expense</p>
                          <p className="text-xs font-bold text-expense">₹{fmt(ws.expense)}</p>
                        </div>
                        <div className="bg-surface-elevated rounded-lg p-2">
                          <p className="text-[9px] text-text-muted uppercase tracking-wider">Trips</p>
                          <p className="text-xs font-bold text-text-primary">{ws.trips}</p>
                        </div>
                      </div>

                      {ws.dailyChart.length > 0 && (
                        <div>
                          <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">Daily Detail</p>
                          <ResponsiveContainer width="100%" height={140}>
                            <BarChart data={ws.dailyChart}>
                              <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#8888a8' }} axisLine={false} tickLine={false} />
                              <YAxis tick={{ fontSize: 9, fill: '#8888a8' }} axisLine={false} tickLine={false} />
                              <Tooltip {...tooltipStyle} />
                              <Bar dataKey="income" fill="#00e676" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="expense" fill="#ff5252" radius={[4, 4, 0, 0]} />
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
  gradient,
  isCurrency = true,
}: {
  label: string
  value: string
  icon: React.ReactNode
  color: string
  gradient: string
  isCurrency?: boolean
}) {
  return (
    <div className={`bg-gradient-to-br ${gradient} bg-surface-card rounded-2xl p-4 border border-border-dim`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={color}>{icon}</span>
        <span className="text-xs text-text-muted font-medium">{label}</span>
      </div>
      <p className={`text-xl font-bold ${color}`}>
        {isCurrency && '₹'}
        {value}
      </p>
    </div>
  )
}
