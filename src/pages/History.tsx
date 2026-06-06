import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { useMonthFilter } from '../hooks/useMonthFilter'
import { Trash2, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'

type Tab = 'all' | 'income' | 'expense'

const CATEGORY_LABELS: Record<string, string> = {
  emi: 'EMI',
  fuel: 'Fuel / CNG',
  maintenance: 'Maintenance',
  driver_salary: 'Driver Salary',
  driver_advance: 'Driver Advance',
  insurance: 'Insurance',
  permit: 'Permit / RTO',
  toll: 'Toll / Parking',
  car_wash: 'Car Wash',
  other: 'Other',
}

export default function History() {
  const { month, setMonth, startDate, endDate } = useMonthFilter()
  const [tab, setTab] = useState<Tab>('all')

  const incomes = useLiveQuery(
    () =>
      db.incomes
        .where('date')
        .between(startDate, endDate, true, true)
        .reverse()
        .sortBy('date'),
    [startDate, endDate]
  )

  const expenses = useLiveQuery(
    () =>
      db.expenses
        .where('date')
        .between(startDate, endDate, true, true)
        .reverse()
        .sortBy('date'),
    [startDate, endDate]
  )

  type Entry = {
    id: number
    kind: 'income' | 'expense'
    date: string
    label: string
    amount: number
    note: string
    recurring?: boolean
  }

  const entries: Entry[] = []
  if (tab !== 'expense') {
    for (const i of incomes ?? []) {
      entries.push({
        id: i.id,
        kind: 'income',
        date: i.date,
        label: i.platform,
        amount: i.amount,
        note: i.note,
      })
    }
  }
  if (tab !== 'income') {
    for (const e of expenses ?? []) {
      entries.push({
        id: e.id,
        kind: 'expense',
        date: e.date,
        label: CATEGORY_LABELS[e.category] ?? e.category,
        amount: e.amount,
        note: e.note,
        recurring: e.recurring,
      })
    }
  }
  entries.sort((a, b) => b.date.localeCompare(a.date))

  const handleDelete = async (entry: Entry) => {
    if (!confirm('Delete this entry?')) return
    if (entry.kind === 'income') await db.incomes.delete(entry.id)
    else await db.expenses.delete(entry.id)
  }

  const fmt = (n: number) => n.toLocaleString('en-IN')

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-text-primary">History</h2>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="border border-border-dim rounded-xl px-3 py-1.5 text-sm bg-surface-card text-text-primary"
        />
      </div>

      <div className="flex gap-1 bg-surface-elevated rounded-xl p-1 mb-4 border border-border-dim">
        {(['all', 'income', 'expense'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 text-sm font-medium rounded-lg capitalize transition-all ${
              tab === t
                ? 'bg-accent text-white shadow-lg shadow-accent/20'
                : 'text-text-muted'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          <p>No entries for this month</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div
              key={`${entry.kind}-${entry.id}`}
              className="bg-surface-card rounded-2xl px-4 py-3 border border-border-dim flex items-center gap-3"
            >
              {entry.kind === 'income' ? (
                <ArrowUpCircle size={28} className="text-income shrink-0" />
              ) : (
                <ArrowDownCircle size={28} className="text-expense shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-text-primary capitalize">
                    {entry.label}
                  </span>
                  {entry.recurring && (
                    <span className="text-[10px] bg-accent/20 text-accent-light px-1.5 py-0.5 rounded-full">
                      Recurring
                    </span>
                  )}
                </div>
                <div className="text-xs text-text-muted mt-0.5">
                  {entry.date}
                  {entry.note ? ` · ${entry.note}` : ''}
                </div>
              </div>
              <span
                className={`text-sm font-bold ${
                  entry.kind === 'income' ? 'text-income' : 'text-expense'
                }`}
              >
                {entry.kind === 'income' ? '+' : '-'}₹{fmt(entry.amount)}
              </span>
              <button
                onClick={() => handleDelete(entry)}
                className="text-text-muted hover:text-expense transition-colors ml-1"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
