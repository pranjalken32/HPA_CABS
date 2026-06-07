import { useState, useMemo } from 'react'
import { useIncomes, useExpenses } from '../hooks/useSupabase'
import { exportToExcel, exportToPDF } from '../utils/export'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
} from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  IndianRupee,
  CalendarDays,
  Car,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Download,
  FileSpreadsheet,
} from 'lucide-react'

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

function fmt(n: number): string {
  return n.toLocaleString('en-IN')
}

function getMonthLabel(monthStr: string): string {
  const [y, m] = monthStr.split('-').map(Number)
  const d = new Date(y, m - 1)
  return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
}

function getDayName(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'short' })
}

type Section = 'overview' | 'revenue' | 'expenses' | 'daily' | 'alerts'

export default function Analytics() {
  const [range, setRange] = useState<'1m' | '2m' | '3m' | '6m'>('2m')
  const [openSection, setOpenSection] = useState<Section | null>('overview')

  // Calculate date range based on selected range
  const { startDate, endDate, months } = useMemo(() => {
    const now = new Date()
    const numMonths = range === '1m' ? 1 : range === '2m' ? 2 : range === '3m' ? 3 : 6
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const start = new Date(now.getFullYear(), now.getMonth() - numMonths + 1, 1)
    const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
    const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`
    const ms: string[] = []
    for (let i = 0; i < numMonths; i++) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1)
      ms.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }
    return { startDate: startStr, endDate: endStr, months: ms }
  }, [range])

  const allIncomes = useIncomes(startDate, endDate)
  const allExpenses = useExpenses(startDate, endDate)

  // ---- KPIs ----
  const totalRevenue = allIncomes.reduce((s, i) => s + i.amount, 0)
  const totalExpense = allExpenses.reduce((s, i) => s + i.amount, 0)
  const netProfit = totalRevenue - totalExpense
  const totalTrips = allIncomes.reduce((s, i) => s + i.trips, 0)
  const uniqueDays = new Set(allIncomes.map((i) => i.date)).size
  const avgRevenuePerDay = uniqueDays > 0 ? totalRevenue / uniqueDays : 0
  const avgTripsPerDay = uniqueDays > 0 ? totalTrips / uniqueDays : 0
  const revenuePerTrip = totalTrips > 0 ? totalRevenue / totalTrips : 0
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0

  // ---- Monthly trend ----
  const monthlyTrend = months.map((m) => {
    const mIncome = allIncomes.filter((i) => i.date.startsWith(m)).reduce((s, i) => s + i.amount, 0)
    const mExpense = allExpenses.filter((e) => e.date.startsWith(m)).reduce((s, e) => s + e.amount, 0)
    const mTrips = allIncomes.filter((i) => i.date.startsWith(m)).reduce((s, i) => s + i.trips, 0)
    return {
      month: getMonthLabel(m),
      revenue: mIncome,
      expense: mExpense,
      profit: mIncome - mExpense,
      trips: mTrips,
    }
  })

  // ---- Platform breakdown (total across range) ----
  const platformTotals: Record<string, { revenue: number; trips: number }> = {}
  for (const i of allIncomes) {
    if (!platformTotals[i.platform]) platformTotals[i.platform] = { revenue: 0, trips: 0 }
    platformTotals[i.platform].revenue += i.amount
    platformTotals[i.platform].trips += i.trips
  }

  const platformData = Object.entries(platformTotals)
    .map(([name, data]) => ({
      name,
      revenue: data.revenue,
      trips: data.trips,
      perTrip: data.trips > 0 ? Math.round(data.revenue / data.trips) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)

  const platformPieData = platformData.map((p) => ({ name: p.name, value: p.revenue }))

  // ---- Platform monthly comparison ----
  const platformMonthly = months.map((m) => {
    const row: Record<string, number | string> = { month: getMonthLabel(m) }
    for (const i of allIncomes.filter((i) => i.date.startsWith(m))) {
      row[i.platform] = ((row[i.platform] as number) ?? 0) + i.amount
    }
    return row
  })
  const allPlatforms = [...new Set(allIncomes.map((i) => i.platform))]

  // ---- Expense category breakdown ----
  const categoryTotals: Record<string, number> = {}
  for (const e of allExpenses) {
    categoryTotals[e.category] = (categoryTotals[e.category] ?? 0) + e.amount
  }
  const categoryData = Object.entries(categoryTotals)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  // ---- Expense monthly breakdown ----
  const expenseMonthly = months.map((m) => {
    const row: Record<string, number | string> = { month: getMonthLabel(m) }
    for (const e of allExpenses.filter((e) => e.date.startsWith(m))) {
      row[e.category] = ((row[e.category] as number) ?? 0) + e.amount
    }
    return row
  })
  const allCategories = [...new Set(allExpenses.map((e) => e.category))]

  // ---- Daily pattern (day of week) ----
  // Group income by date first, then by day-of-week for correct averaging
  const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const incomeByDate: Record<string, { revenue: number; trips: number }> = {}
  for (const i of allIncomes) {
    if (!incomeByDate[i.date]) incomeByDate[i.date] = { revenue: 0, trips: 0 }
    incomeByDate[i.date].revenue += i.amount
    incomeByDate[i.date].trips += i.trips
  }
  const dayOfWeekData: Record<string, { revenue: number; trips: number; count: number }> = {}
  for (const d of dayOrder) dayOfWeekData[d] = { revenue: 0, trips: 0, count: 0 }
  for (const [date, data] of Object.entries(incomeByDate)) {
    const day = getDayName(date)
    if (dayOfWeekData[day]) {
      dayOfWeekData[day].revenue += data.revenue
      dayOfWeekData[day].trips += data.trips
      dayOfWeekData[day].count++
    }
  }
  const dayPatternData = dayOrder.map((d) => ({
    day: d,
    avgRevenue: dayOfWeekData[d].count > 0 ? Math.round(dayOfWeekData[d].revenue / dayOfWeekData[d].count) : 0,
    avgTrips: dayOfWeekData[d].count > 0 ? Math.round(dayOfWeekData[d].trips / dayOfWeekData[d].count) : 0,
    daysWorked: dayOfWeekData[d].count,
  }))

  // ---- Daily revenue timeline (last 30 days) ----
  const dailyMap: Record<string, { revenue: number; expense: number; trips: number }> = {}
  for (const i of allIncomes) {
    if (!dailyMap[i.date]) dailyMap[i.date] = { revenue: 0, expense: 0, trips: 0 }
    dailyMap[i.date].revenue += i.amount
    dailyMap[i.date].trips += i.trips
  }
  for (const e of allExpenses) {
    if (!dailyMap[e.date]) dailyMap[e.date] = { revenue: 0, expense: 0, trips: 0 }
    dailyMap[e.date].expense += e.amount
  }
  const dailyTimeline = Object.entries(dailyMap)
    .map(([date, data]) => ({
      date: date.slice(5),
      ...data,
      profit: data.revenue - data.expense,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // ---- Alerts / Issues ----
  const alerts: { type: 'warning' | 'danger' | 'info'; message: string }[] = []

  // Low revenue days
  const lowRevDays = Object.entries(dailyMap)
    .filter(([, d]) => d.revenue > 0 && d.revenue < 2500)
  if (lowRevDays.length > 0) {
    alerts.push({
      type: 'warning',
      message: `${lowRevDays.length} day(s) with revenue below ₹2,500 — worst: ₹${fmt(Math.min(...lowRevDays.map(([, d]) => d.revenue)))}`,
    })
  }

  // Negative profit days
  const negProfitDays = Object.entries(dailyMap)
    .filter(([, d]) => (d.revenue - d.expense) < 0)
  if (negProfitDays.length > 0) {
    alerts.push({
      type: 'danger',
      message: `${negProfitDays.length} day(s) with negative profit — total loss: ₹${fmt(negProfitDays.reduce((s, [, d]) => s + (d.expense - d.revenue), 0))}`,
    })
  }

  // Day-off pattern
  const totalPossibleDays = Math.ceil(
    (new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000
  ) + 1
  const daysOff = totalPossibleDays - uniqueDays
  if (daysOff > 0) {
    alerts.push({
      type: 'info',
      message: `${daysOff} off-day(s) out of ${totalPossibleDays} days — working ${Math.round((uniqueDays / totalPossibleDays) * 100)}% of the time`,
    })
  }

  // High expense category
  const emiTotal = categoryTotals['EMI'] ?? 0
  if (emiTotal > 0 && totalRevenue > 0) {
    const emiPercent = (emiTotal / totalRevenue) * 100
    if (emiPercent > 15) {
      alerts.push({
        type: 'warning',
        message: `EMI is ${emiPercent.toFixed(1)}% of revenue — consider refinancing if possible`,
      })
    }
  }

  // Best / worst platform
  if (platformData.length > 1) {
    const best = platformData[0]
    const worst = platformData[platformData.length - 1]
    alerts.push({
      type: 'info',
      message: `Best platform: ${best.name} (₹${fmt(best.perTrip)}/trip) — Lowest: ${worst.name} (₹${fmt(worst.perTrip)}/trip)`,
    })
  }

  // Best day of week
  const bestDay = dayPatternData.reduce((best, d) => d.avgRevenue > best.avgRevenue ? d : best, dayPatternData[0])
  const worstWorkDay = dayPatternData.filter((d) => d.daysWorked > 0).reduce((w, d) => d.avgRevenue < w.avgRevenue ? d : w, dayPatternData[0])
  if (bestDay && worstWorkDay && bestDay.day !== worstWorkDay.day) {
    alerts.push({
      type: 'info',
      message: `Best day: ${bestDay.day} (avg ₹${fmt(bestDay.avgRevenue)}) — Slowest: ${worstWorkDay.day} (avg ₹${fmt(worstWorkDay.avgRevenue)})`,
    })
  }

  const toggleSection = (s: Section) =>
    setOpenSection(openSection === s ? null : s)

  const renderLabel = ({ name, percent }: { name?: string; percent?: number }) => {
    if (!percent || percent < 0.05) return null
    return `${name} ${(percent * 100).toFixed(0)}%`
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
          <BarChart3 size={22} className="text-white" />
          Analytics
        </h2>
        <div className="flex gap-1 bg-surface-card rounded-xl p-0.5 border border-border-dim">
          {(['1m', '2m', '3m', '6m'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 text-xs rounded-lg font-medium transition-all ${
                range === r
                  ? 'bg-white text-black'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {r.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Export Buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => exportToExcel(startDate.slice(0, 7), allIncomes, allExpenses)}
          className="flex-1 bg-surface-card rounded-xl p-2.5 border border-border-dim flex items-center justify-center gap-2 hover:border-income transition-colors"
        >
          <FileSpreadsheet size={16} className="text-income" />
          <span className="text-xs font-medium text-text-primary">Export Excel</span>
        </button>
        <button
          onClick={() => exportToPDF(startDate.slice(0, 7), allIncomes, allExpenses)}
          className="flex-1 bg-surface-card rounded-xl p-2.5 border border-border-dim flex items-center justify-center gap-2 hover:border-expense transition-colors"
        >
          <Download size={16} className="text-expense" />
          <span className="text-xs font-medium text-text-primary">Export PDF</span>
        </button>
      </div>

      {/* ---- KPI CARDS ---- */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-surface-card rounded-xl p-3 border border-border-dim">
          <div className="text-[10px] text-text-muted uppercase tracking-wider">Avg Revenue / Day</div>
          <div className="text-lg font-bold text-income">₹{fmt(Math.round(avgRevenuePerDay))}</div>
        </div>
        <div className="bg-surface-card rounded-xl p-3 border border-border-dim">
          <div className="text-[10px] text-text-muted uppercase tracking-wider">Avg Trips / Day</div>
          <div className="text-lg font-bold text-white">{avgTripsPerDay.toFixed(1)}</div>
        </div>
        <div className="bg-surface-card rounded-xl p-3 border border-border-dim">
          <div className="text-[10px] text-text-muted uppercase tracking-wider">Revenue / Trip</div>
          <div className="text-lg font-bold text-text-primary">₹{fmt(Math.round(revenuePerTrip))}</div>
        </div>
        <div className="bg-surface-card rounded-xl p-3 border border-border-dim">
          <div className="text-[10px] text-text-muted uppercase tracking-wider">Profit Margin</div>
          <div className={`text-lg font-bold ${profitMargin >= 0 ? 'text-income' : 'text-expense'}`}>
            {profitMargin.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* ---- OVERVIEW SECTION ---- */}
      <CollapsibleSection
        title="Revenue vs Expenses Trend"
        icon={<TrendingUp size={16} />}
        open={openSection === 'overview'}
        onToggle={() => toggleSection('overview')}
      >
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="text-center">
            <div className="text-[10px] text-text-muted uppercase">Revenue</div>
            <div className="text-sm font-bold text-income">₹{fmt(totalRevenue)}</div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-text-muted uppercase">Expenses</div>
            <div className="text-sm font-bold text-expense">₹{fmt(totalExpense)}</div>
          </div>
          <div className="text-center">
            <div className="text-[10px] text-text-muted uppercase">Net Profit</div>
            <div className={`text-sm font-bold ${netProfit >= 0 ? 'text-income' : 'text-expense'}`}>
              ₹{fmt(netProfit)}
            </div>
          </div>
        </div>

        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222222" />
              <XAxis dataKey="month" tick={{ fill: '#666666', fontSize: 11 }} />
              <YAxis tick={{ fill: '#666666', fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip {...tooltipStyle} formatter={(v) => `₹${fmt(Number(v))}`} />
              <Bar dataKey="revenue" fill="#06c167" radius={[4, 4, 0, 0]} name="Revenue" />
              <Bar dataKey="expense" fill="#ff4444" radius={[4, 4, 0, 0]} name="Expense" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Profit trend line */}
        <div className="mt-3">
          <div className="text-xs text-text-muted mb-1">Profit Trend</div>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyTrend}>
                <defs>
                  <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ffffff" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ffffff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#222222" />
                <XAxis dataKey="month" tick={{ fill: '#666666', fontSize: 11 }} />
                <YAxis tick={{ fill: '#666666', fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip {...tooltipStyle} formatter={(v) => `₹${fmt(Number(v))}`} />
                <Area type="monotone" dataKey="profit" stroke="#ffffff" fill="url(#profitGrad)" name="Profit" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CollapsibleSection>

      {/* ---- REVENUE DEEP DIVE ---- */}
      <CollapsibleSection
        title="Platform Performance"
        icon={<Car size={16} />}
        open={openSection === 'revenue'}
        onToggle={() => toggleSection('revenue')}
      >
        {/* Platform pie */}
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={platformPieData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                dataKey="value"
                label={renderLabel}
                labelLine={false}
                fontSize={11}
              >
                {platformPieData.map((entry) => (
                  <Cell key={entry.name} fill={PLATFORM_COLORS[entry.name] ?? '#64748b'} />
                ))}
              </Pie>
              <Tooltip {...tooltipStyle} formatter={(v) => `₹${fmt(Number(v))}`} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Platform stats table */}
        <div className="space-y-2 mt-2">
          {platformData.map((p) => (
            <div key={p.name} className="flex items-center justify-between bg-surface-elevated rounded-xl px-3 py-2.5 border border-border-dim">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PLATFORM_COLORS[p.name] ?? '#64748b' }} />
                <span className="text-sm font-medium text-text-primary capitalize">{p.name}</span>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-text-primary">₹{fmt(p.revenue)}</div>
                <div className="text-[10px] text-text-muted">{p.trips} trips · ₹{fmt(p.perTrip)}/trip</div>
              </div>
            </div>
          ))}
        </div>

        {/* Platform monthly trend */}
        {months.length > 1 && (
          <div className="mt-3">
            <div className="text-xs text-text-muted mb-1">Platform Revenue by Month</div>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={platformMonthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222222" />
                  <XAxis dataKey="month" tick={{ fill: '#666666', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#666666', fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip {...tooltipStyle} formatter={(v) => `₹${fmt(Number(v))}`} />
                  {allPlatforms.map((p) => (
                    <Bar key={p} dataKey={p} fill={PLATFORM_COLORS[p] ?? '#666666'} radius={[3, 3, 0, 0]} stackId="platform" name={p} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CollapsibleSection>

      {/* ---- EXPENSE DEEP DIVE ---- */}
      <CollapsibleSection
        title="Expense Breakdown"
        icon={<IndianRupee size={16} />}
        open={openSection === 'expenses'}
        onToggle={() => toggleSection('expenses')}
      >
        {/* Category pie */}
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                dataKey="value"
                label={renderLabel}
                labelLine={false}
                fontSize={11}
              >
                {categoryData.map((_, idx) => (
                  <Cell key={idx} fill={EXPENSE_COLORS[idx % EXPENSE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip {...tooltipStyle} formatter={(v) => `₹${fmt(Number(v))}`} />
              <Legend
                wrapperStyle={{ fontSize: '10px', color: '#999999' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Category stats */}
        <div className="space-y-2 mt-2">
          {categoryData.map((c, idx) => {
            const pct = totalExpense > 0 ? ((c.value / totalExpense) * 100).toFixed(1) : '0'
            return (
              <div key={c.name} className="flex items-center justify-between bg-surface-elevated rounded-xl px-3 py-2.5 border border-border-dim">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: EXPENSE_COLORS[idx % EXPENSE_COLORS.length] }} />
                  <span className="text-sm font-medium text-text-primary">{c.name}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-text-primary">₹{fmt(c.value)}</div>
                  <div className="text-[10px] text-text-muted">{pct}% of total</div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Expense monthly stacked */}
        {months.length > 1 && (
          <div className="mt-3">
            <div className="text-xs text-text-muted mb-1">Expenses by Month</div>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={expenseMonthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222222" />
                  <XAxis dataKey="month" tick={{ fill: '#666666', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#666666', fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip {...tooltipStyle} formatter={(v) => `₹${fmt(Number(v))}`} />
                  {allCategories.map((c, idx) => (
                    <Bar key={c} dataKey={c} fill={EXPENSE_COLORS[idx % EXPENSE_COLORS.length]} radius={[2, 2, 0, 0]} stackId="exp" name={c} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CollapsibleSection>

      {/* ---- DAILY PATTERN ---- */}
      <CollapsibleSection
        title="Daily Patterns"
        icon={<CalendarDays size={16} />}
        open={openSection === 'daily'}
        onToggle={() => toggleSection('daily')}
      >
        {/* Day of week chart */}
        <div className="text-xs text-text-muted mb-1">Avg Revenue by Day of Week</div>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dayPatternData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222222" />
              <XAxis dataKey="day" tick={{ fill: '#666666', fontSize: 11 }} />
              <YAxis tick={{ fill: '#666666', fontSize: 10 }} />
              <Tooltip {...tooltipStyle} formatter={(v) => `₹${fmt(Number(v))}`} />
              <Bar dataKey="avgRevenue" fill="#ffffff" radius={[4, 4, 0, 0]} name="Avg Revenue" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Day stats grid */}
        <div className="grid grid-cols-7 gap-1 mt-3">
          {dayPatternData.map((d) => (
            <div key={d.day} className={`text-center rounded-lg p-1.5 ${d.daysWorked === 0 ? 'bg-surface-elevated/50' : 'bg-surface-elevated'} border border-border-dim`}>
              <div className="text-[10px] font-medium text-text-muted">{d.day}</div>
              <div className="text-[11px] font-bold text-text-primary">₹{d.avgRevenue > 999 ? `${(d.avgRevenue / 1000).toFixed(1)}k` : d.avgRevenue}</div>
              <div className="text-[9px] text-text-muted">{d.avgTrips}t</div>
            </div>
          ))}
        </div>

        {/* Daily timeline */}
        <div className="mt-4">
          <div className="text-xs text-text-muted mb-1">Daily Revenue Timeline</div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyTimeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222222" />
                <XAxis dataKey="date" tick={{ fill: '#666666', fontSize: 9 }} interval="preserveStartEnd" />
                <YAxis tick={{ fill: '#666666', fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip {...tooltipStyle} formatter={(v) => `₹${fmt(Number(v))}`} />
                <Line type="monotone" dataKey="revenue" stroke="#06c167" strokeWidth={2} dot={false} name="Revenue" />
                <Line type="monotone" dataKey="expense" stroke="#ff4444" strokeWidth={1.5} dot={false} name="Expense" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CollapsibleSection>

      {/* ---- ALERTS ---- */}
      <CollapsibleSection
        title={`Insights & Alerts (${alerts.length})`}
        icon={<AlertTriangle size={16} />}
        open={openSection === 'alerts'}
        onToggle={() => toggleSection('alerts')}
      >
        {alerts.length === 0 ? (
          <div className="text-sm text-text-muted text-center py-4">No alerts — everything looks good!</div>
        ) : (
          <div className="space-y-2">
            {alerts.map((a, idx) => (
              <div
                key={idx}
                className={`rounded-xl px-3 py-2.5 text-sm border ${
                  a.type === 'danger'
                    ? 'bg-expense/10 border-expense/20 text-expense'
                    : a.type === 'warning'
                    ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
                    : 'bg-white/10 border-white/20 text-white'
                }`}
              >
                <div className="flex items-start gap-2">
                  {a.type === 'danger' ? (
                    <TrendingDown size={14} className="mt-0.5 flex-shrink-0" />
                  ) : a.type === 'warning' ? (
                    <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                  ) : (
                    <TrendingUp size={14} className="mt-0.5 flex-shrink-0" />
                  )}
                  <span>{a.message}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>
    </div>
  )
}

function CollapsibleSection({
  title,
  icon,
  open,
  onToggle,
  children,
}: {
  title: string
  icon: React.ReactNode
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="bg-surface-card rounded-2xl border border-border-dim overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <span className="text-white">{icon}</span>
          {title}
        </div>
        {open ? (
          <ChevronUp size={16} className="text-text-muted" />
        ) : (
          <ChevronDown size={16} className="text-text-muted" />
        )}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}
