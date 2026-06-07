import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useMonthFilter } from '../hooks/useMonthFilter'
import { useIncomes, useExpenses, deleteIncome, deleteExpense, updateIncome, updateExpense } from '../hooks/useSupabase'
import { Trash2, Pencil, ArrowUpCircle, ArrowDownCircle, X } from 'lucide-react'

type Tab = 'all' | 'income' | 'expense'

const PLATFORMS = ['rapido', 'ola', 'uber', 'cash', 'other']

const CATEGORIES = [
  'emi', 'fuel', 'driver_salary', 'driver_advance',
  'insurance', 'permit', 'toll', 'car_wash', 'other',
]

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

type Entry = {
  id: number
  kind: 'income' | 'expense'
  date: string
  label: string
  amount: number
  note: string
  recurring?: boolean
  platform?: string
  category?: string
  trips?: number
}

export default function History() {
  const { month, setMonth, startDate, endDate } = useMonthFilter()
  const [tab, setTab] = useState<Tab>('all')
  const [editing, setEditing] = useState<Entry | null>(null)

  const incomes = useIncomes(startDate, endDate)
  const expenses = useExpenses(startDate, endDate)

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
        platform: i.platform,
        trips: i.trips,
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
        category: e.category,
      })
    }
  }
  entries.sort((a, b) => b.date.localeCompare(a.date))

  const handleDelete = async (entry: Entry) => {
    if (!confirm('Delete this entry?')) return
    if (entry.kind === 'income') await deleteIncome(entry.id)
    else await deleteExpense(entry.id)
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
                onClick={() => setEditing(entry)}
                className="text-text-muted hover:text-accent-light transition-colors"
              >
                <Pencil size={15} />
              </button>
              <button
                onClick={() => handleDelete(entry)}
                className="text-text-muted hover:text-expense transition-colors"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {editing && createPortal(
        <EditModal
          entry={editing}
          onClose={() => setEditing(null)}
        />,
        document.body
      )}
    </div>
  )
}

function EditModal({ entry, onClose }: { entry: Entry; onClose: () => void }) {
  const [date, setDate] = useState(entry.date)
  const [amount, setAmount] = useState(String(entry.amount))
  const [note, setNote] = useState(entry.note)

  // Income fields
  const [platform, setPlatform] = useState(entry.platform ?? 'rapido')
  const [trips, setTrips] = useState(String(entry.trips ?? 0))

  // Expense fields
  const [category, setCategory] = useState(entry.category ?? 'fuel')
  const [recurring, setRecurring] = useState(entry.recurring ?? false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || Number(amount) <= 0) return

    if (entry.kind === 'income') {
      await updateIncome(entry.id, {
        date,
        platform,
        amount: Number(amount),
        trips: Number(trips) || 0,
        note,
      })
    } else {
      await updateExpense(entry.id, {
        date,
        category,
        amount: Number(amount),
        note,
        recurring,
      })
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center">
      <div className="bg-surface-card w-full max-w-lg rounded-t-3xl sm:rounded-2xl border border-border-dim max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 pt-5 pb-2">
          <h3 className="text-lg font-bold text-text-primary">
            Edit {entry.kind === 'income' ? 'Income' : 'Expense'}
          </h3>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave} className="px-5 pb-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-border-dim bg-surface-elevated rounded-xl px-3 py-2.5 text-sm text-text-primary focus:border-accent focus:outline-none transition-colors"
              required
            />
          </div>

          {entry.kind === 'income' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Platform</label>
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPlatform(p)}
                      className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-all ${
                        platform === p
                          ? 'bg-accent text-white shadow-lg shadow-accent/25'
                          : 'bg-surface-elevated text-text-secondary border border-border-dim'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Amount (₹)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full border border-border-dim bg-surface-elevated rounded-xl px-3 py-2.5 text-sm text-text-primary focus:border-accent focus:outline-none transition-colors"
                  min="1"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Number of Trips</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={trips}
                  onChange={(e) => setTrips(e.target.value)}
                  className="w-full border border-border-dim bg-surface-elevated rounded-xl px-3 py-2.5 text-sm text-text-primary focus:border-accent focus:outline-none transition-colors"
                  min="0"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Category</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        setCategory(c)
                        if (c === 'emi') setRecurring(true)
                      }}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                        category === c
                          ? 'bg-expense text-white shadow-lg shadow-expense/25'
                          : 'bg-surface-elevated text-text-secondary border border-border-dim'
                      }`}
                    >
                      {CATEGORY_LABELS[c]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Amount (₹)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full border border-border-dim bg-surface-elevated rounded-xl px-3 py-2.5 text-sm text-text-primary focus:border-accent focus:outline-none transition-colors"
                  min="1"
                  required
                />
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={recurring}
                  onChange={(e) => setRecurring(e.target.checked)}
                  className="w-5 h-5 rounded border-border-dim bg-surface-elevated accent-accent"
                />
                <span className="text-sm text-text-secondary">Monthly recurring</span>
              </label>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">Note (optional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full border border-border-dim bg-surface-elevated rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none transition-colors"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl text-sm font-semibold text-text-secondary bg-surface-elevated border border-border-dim hover:bg-surface-card transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`flex-1 py-3 rounded-xl text-sm font-semibold text-white transition-all shadow-lg ${
                entry.kind === 'income'
                  ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-green-500/20'
                  : 'bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 shadow-red-500/20'
              }`}
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
