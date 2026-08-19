import { useMonthFilter } from '../hooks/useMonthFilter'
import { useExpenses } from '../hooks/useSupabase'
import { Users, ArrowUpCircle, ArrowDownCircle, Wallet } from 'lucide-react'
import { parseLocalDate } from '../utils/date'

export default function DriverSettlement() {
  const { month, setMonth, startDate, endDate } = useMonthFilter()
  const expenses = useExpenses(startDate, endDate)

  const salaryEntries = (expenses ?? []).filter((e) => e.category === 'driver_salary')
  const advanceEntries = (expenses ?? []).filter((e) => e.category === 'driver_advance')

  const totalSalary = salaryEntries.reduce((s, e) => s + e.amount, 0)
  const totalAdvance = advanceEntries.reduce((s, e) => s + e.amount, 0)
  const balance = totalSalary - totalAdvance

  const fmt = (n: number) => Math.abs(n).toLocaleString('en-IN')

  // Weekly breakdown
  const weekMap: Record<number, { salary: number; advance: number }> = {}
  for (const e of salaryEntries) {
    const w = Math.ceil(parseLocalDate(e.date).getDate() / 7)
    if (!weekMap[w]) weekMap[w] = { salary: 0, advance: 0 }
    weekMap[w].salary += e.amount
  }
  for (const e of advanceEntries) {
    const w = Math.ceil(parseLocalDate(e.date).getDate() / 7)
    if (!weekMap[w]) weekMap[w] = { salary: 0, advance: 0 }
    weekMap[w].advance += e.amount
  }

  const weeks = Object.entries(weekMap)
    .map(([w, data]) => ({ week: Number(w), ...data, balance: data.salary - data.advance }))
    .sort((a, b) => a.week - b.week)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
          <Users size={22} className="text-white" />
          Driver Settlement
        </h2>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="border border-border-dim rounded-xl px-3 py-1.5 text-sm bg-surface-card text-text-primary"
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-surface-card rounded-2xl p-3 border border-border-dim text-center">
          <ArrowDownCircle size={20} className="text-expense mx-auto mb-1" />
          <p className="text-[10px] text-text-muted">Salary Owed</p>
          <p className="text-sm font-bold text-expense">₹{fmt(totalSalary)}</p>
        </div>
        <div className="bg-surface-card rounded-2xl p-3 border border-border-dim text-center">
          <ArrowUpCircle size={20} className="text-income mx-auto mb-1" />
          <p className="text-[10px] text-text-muted">Advance Given</p>
          <p className="text-sm font-bold text-income">₹{fmt(totalAdvance)}</p>
        </div>
        <div className="bg-surface-card rounded-2xl p-3 border border-border-dim text-center">
          <Wallet size={20} className="text-white mx-auto mb-1" />
          <p className="text-[10px] text-text-muted">
            {balance >= 0 ? 'To Pay' : 'Overpaid'}
          </p>
          <p className={`text-sm font-bold ${balance >= 0 ? 'text-expense' : 'text-income'}`}>
            ₹{fmt(balance)}
          </p>
        </div>
      </div>

      {/* Settlement bar */}
      {totalSalary > 0 && (
        <div className="bg-surface-card rounded-2xl p-4 border border-border-dim">
          <div className="flex justify-between text-xs text-text-muted mb-2">
            <span>Settlement Progress</span>
            <span>{Math.min(100, Math.round((totalAdvance / totalSalary) * 100))}%</span>
          </div>
          <div className="w-full h-3 bg-surface-elevated rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all"
              style={{ width: `${Math.min(100, (totalAdvance / totalSalary) * 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-text-muted mt-1">
            <span>₹0</span>
            <span>₹{fmt(totalSalary)}</span>
          </div>
        </div>
      )}

      {/* Weekly Breakdown */}
      <div className="bg-surface-card rounded-2xl border border-border-dim overflow-hidden">
        <div className="px-4 py-3 border-b border-border-dim">
          <h3 className="text-sm font-semibold text-text-primary">Weekly Breakdown</h3>
        </div>
        {weeks.length === 0 ? (
          <p className="text-center text-text-muted text-sm py-6">No driver entries this month</p>
        ) : (
          <div className="divide-y divide-border-dim">
            {weeks.map((w) => (
              <div key={w.week} className="px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-text-secondary">Week {w.week}</span>
                <div className="flex items-center gap-4 text-xs">
                  <span className="text-expense">Salary ₹{fmt(w.salary)}</span>
                  <span className="text-income">Advance ₹{fmt(w.advance)}</span>
                  <span className={`font-bold ${w.balance >= 0 ? 'text-expense' : 'text-income'}`}>
                    {w.balance >= 0 ? 'Owe' : 'Over'} ₹{fmt(w.balance)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transaction log */}
      <div className="bg-surface-card rounded-2xl border border-border-dim overflow-hidden">
        <div className="px-4 py-3 border-b border-border-dim">
          <h3 className="text-sm font-semibold text-text-primary">Transactions</h3>
        </div>
        {[...salaryEntries, ...advanceEntries].length === 0 ? (
          <p className="text-center text-text-muted text-sm py-6">
            Add &quot;Driver Salary&quot; or &quot;Driver Advance&quot; expenses to track
          </p>
        ) : (
          <div className="divide-y divide-border-dim max-h-64 overflow-y-auto">
            {[...salaryEntries, ...advanceEntries]
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((e) => (
                <div key={e.id} className="px-4 py-2.5 flex items-center justify-between">
                  <div>
                    <span className="text-sm text-text-primary capitalize">
                      {e.category === 'driver_salary' ? 'Salary' : 'Advance'}
                    </span>
                    <span className="text-xs text-text-muted ml-2">{e.date}</span>
                    {e.note && <span className="text-xs text-text-muted ml-1">· {e.note}</span>}
                  </div>
                  <span className={`text-sm font-bold ${
                    e.category === 'driver_salary' ? 'text-expense' : 'text-income'
                  }`}>
                    {e.category === 'driver_salary' ? '-' : '+'}₹{fmt(e.amount)}
                  </span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}
