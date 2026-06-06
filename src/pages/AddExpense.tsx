import { useState } from 'react'
import { db } from '../db'
import { CheckCircle2 } from 'lucide-react'

const CATEGORIES = [
  'emi',
  'fuel',
  'driver_salary',
  'driver_advance',
  'insurance',
  'permit',
  'toll',
  'car_wash',
  'other',
]

const CATEGORY_LABELS: Record<string, string> = {
  emi: 'EMI',
  fuel: 'Fuel / CNG',
  driver_salary: 'Driver Salary',
  driver_advance: 'Driver Advance',
  insurance: 'Insurance',
  permit: 'Permit / RTO',
  toll: 'Toll / Parking',
  car_wash: 'Car Wash',
  other: 'Other',
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
}

export default function AddExpense() {
  const [date, setDate] = useState(todayStr())
  const [category, setCategory] = useState('fuel')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [recurring, setRecurring] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || Number(amount) <= 0) return
    await db.expenses.add({
      date,
      category,
      amount: Number(amount),
      note,
      recurring,
    })
    setSaved(true)
    setTimeout(() => {
      setSaved(false)
      setAmount('')
      setNote('')
    }, 1200)
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-text-primary mb-4">Add Expense</h2>

      {saved && (
        <div className="bg-income/10 text-income border border-income/20 rounded-xl p-3 mb-4 flex items-center gap-2 text-sm font-medium">
          <CheckCircle2 size={18} /> Expense saved!
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-surface-card rounded-2xl p-5 border border-border-dim space-y-4">
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
          <label className="block text-sm font-medium text-text-secondary mb-1">
            Amount (₹)
          </label>
          <input
            type="number"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 5000"
            className="w-full border border-border-dim bg-surface-elevated rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none transition-colors"
            min="1"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">
            Note (optional)
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Monthly car EMI"
            className="w-full border border-border-dim bg-surface-elevated rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none transition-colors"
          />
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={recurring}
            onChange={(e) => setRecurring(e.target.checked)}
            className="w-5 h-5 rounded border-border-dim bg-surface-elevated accent-accent"
          />
          <span className="text-sm text-text-secondary">
            Monthly recurring expense
          </span>
        </label>

        <button
          type="submit"
          className="w-full bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-red-500/20"
        >
          Save Expense
        </button>
      </form>
    </div>
  )
}
