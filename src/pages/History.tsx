import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useMonthFilter } from '../hooks/useMonthFilter'
import { useLanguage } from '../useLanguage'
import { notifyApp, useIncomes, useExpenses, useProfiles, useDriverSettlements, deleteIncome, deleteExpense, updateIncome, updateExpense, findDuplicateIncome, findDuplicateExpense } from '../hooks/useSupabase'
import { exportToExcel, exportToPDF } from '../utils/export'
import { generateMonthlySummary, shareViaWhatsApp } from '../utils/share'
import { Trash2, Pencil, ArrowUpCircle, ArrowDownCircle, X, User, Download, FileSpreadsheet, Share2 } from 'lucide-react'
import { isValidCalendarDate } from '../utils/date'
import { fmt, parseNonNegativeNumber, parsePositiveAmount } from '../utils/money'

type Tab = 'all' | 'income' | 'expense'

const PLATFORMS = ['rapido', 'ola', 'uber', 'namma_yatri', 'cash', 'refund', 'other']

const CATEGORIES = [
  'commission', 'emi', 'fuel', 'driver_salary', 'driver_advance', 'driver_incentive',
  'fare_fraud', 'insurance', 'permit', 'toll', 'car_wash', 'service', 'other',
]

const CATEGORY_LABELS: Record<string, string> = {
  commission: 'Commission',
  emi: 'EMI',
  fuel: 'Fuel / CNG',
  driver_salary: 'Driver Salary',
  driver_advance: 'Driver Advance',
  driver_incentive: 'Driver Incentive',
  fare_fraud: 'Fare Fraud',
  insurance: 'Insurance',
  permit: 'Permit / RTO',
  toll: 'Toll / Parking',
  car_wash: 'Car Wash',
  service: 'Service',
  Service: 'Service',
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
  user_id?: string
  fuel_log_id?: number | null
  service_record_id?: number | null
  driver_profile_id?: number | null
}

export default function History() {
  const { month, setMonth, startDate, endDate } = useMonthFilter()
  const { t } = useLanguage()
  const [tab, setTab] = useState<Tab>('all')
  const [editing, setEditing] = useState<Entry | null>(null)

  const incomes = useIncomes(startDate, endDate)
  const expenses = useExpenses(startDate, endDate)
  const profiles = useProfiles()
  const settlements = useDriverSettlements()

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
        user_id: i.user_id,
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
        user_id: e.user_id,
        fuel_log_id: e.fuel_log_id,
        service_record_id: e.service_record_id,
        driver_profile_id: e.driver_profile_id,
      })
    }
  }
  entries.sort((a, b) => b.date.localeCompare(a.date))
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const isLocked = (entry: Entry) => Boolean(
    entry.kind === 'expense' &&
    ['driver_salary', 'driver_advance', 'driver_incentive'].includes(entry.category ?? '') &&
    settlements.some((settlement) => (
      settlement.month === entry.date.slice(0, 7) &&
      (settlement.driver_profile_id === entry.driver_profile_id ||
        (!entry.driver_profile_id && settlement.driver_name && entry.note.toLowerCase().includes(settlement.driver_name.toLowerCase())))
    ))
  )

  const handleDelete = async (entry: Entry) => {
    if (!confirm('Delete this entry?')) return
    if (isLocked(entry)) return
    setDeletingId(entry.id)
    try {
      if (entry.kind === 'income') await deleteIncome(entry.id)
      else await deleteExpense(entry.id)
    } catch (error) {
      console.error('Entry deletion failed:', error)
      notifyApp('error', 'Entry could not be deleted.')
    } finally {
      setDeletingId(null)
    }
  }

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

      {/* Export & Share */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => exportToExcel(month, incomes ?? [], expenses ?? [])}
          className="flex-1 bg-surface-card rounded-xl py-2 border border-border-dim flex items-center justify-center gap-1.5 hover:border-income transition-colors"
        >
          <FileSpreadsheet size={14} className="text-income" />
          <span className="text-xs font-medium text-text-primary">Excel</span>
        </button>
        <button
          onClick={() => exportToPDF(month, incomes ?? [], expenses ?? [])}
          className="flex-1 bg-surface-card rounded-xl py-2 border border-border-dim flex items-center justify-center gap-1.5 hover:border-expense transition-colors"
        >
          <Download size={14} className="text-expense" />
          <span className="text-xs font-medium text-text-primary">PDF</span>
        </button>
        <button
          onClick={() => {
            const text = generateMonthlySummary(month, incomes ?? [], expenses ?? [])
            shareViaWhatsApp(text)
          }}
          className="bg-surface-card rounded-xl py-2 px-3 border border-border-dim flex items-center justify-center gap-1.5 hover:border-income transition-colors"
        >
          <Share2 size={14} className="text-income" />
        </button>
      </div>

      <div className="flex gap-1 bg-surface-elevated rounded-xl p-1 mb-4 border border-border-dim">
        {(['all', 'income', 'expense'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 text-sm font-medium rounded-lg capitalize transition-all ${
              tab === t
                ? 'bg-white text-black'
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
                    <span className="text-[10px] bg-white/10 text-text-secondary px-1.5 py-0.5 rounded-full">
                      Recurring
                    </span>
                  )}
                </div>
                <div className="text-xs text-text-muted mt-0.5">
                  {entry.date}
                  {entry.note ? ` · ${entry.note}` : ''}
                </div>
                {entry.fuel_log_id && (
                  <div className="text-[10px] text-text-muted mt-1">
                    {t.linkedFuelEdit}
                  </div>
                )}
                {entry.service_record_id && (
                  <div className="text-[10px] text-text-muted mt-1">
                    {t.linkedServiceEdit}
                  </div>
                )}
                {isLocked(entry) && (
                  <div className="text-[10px] text-yellow-400 mt-1">
                    {t.settledLocked}
                  </div>
                )}
                {entry.user_id && profiles.get(entry.user_id) && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <User size={10} className="text-text-secondary" />
                    <span className="text-[10px] text-text-secondary capitalize">
                      {profiles.get(entry.user_id)}
                    </span>
                  </div>
                )}
              </div>
              <span
                className={`text-sm font-bold ${
                  entry.kind === 'income' ? 'text-income' : 'text-expense'
                }`}
              >
                {entry.kind === 'income' ? '+' : '-'}₹{fmt(entry.amount)}
              </span>
              <button
                disabled={isLocked(entry) || Boolean(entry.fuel_log_id || entry.service_record_id)}
                onClick={() => setEditing(entry)}
                className="text-text-muted hover:text-accent-light transition-colors"
              >
                <Pencil size={15} />
              </button>
              <button
                disabled={isLocked(entry) || deletingId === entry.id}
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
          locked={isLocked(editing)}
          onClose={() => setEditing(null)}
        />,
        document.body
      )}
    </div>
  )
}

function EditModal({ entry, onClose, locked }: { entry: Entry; onClose: () => void; locked: boolean }) {
  const { t } = useLanguage()
  const [date, setDate] = useState(entry.date)
  const [amount, setAmount] = useState(String(entry.amount))
  const [note, setNote] = useState(entry.note)

  // Income fields
  const [platform, setPlatform] = useState(entry.platform ?? 'rapido')
  const [trips, setTrips] = useState(String(entry.trips ?? 0))

  // Expense fields
  const [category, setCategory] = useState(entry.category ?? 'fuel')
  const [recurring, setRecurring] = useState(entry.recurring ?? false)
  const [submitting, setSubmitting] = useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsedAmount = parsePositiveAmount(amount)
    const parsedTrips = trips === '' ? 0 : parseNonNegativeNumber(trips)
    if (!isValidCalendarDate(date) || parsedAmount === null || parsedTrips === null || locked) {
      notifyApp('error', 'Enter valid values. Settled or linked expenses cannot be changed here.')
      return
    }
    setSubmitting(true)
    try {
      if (entry.kind === 'income') {
        if (
          navigator.onLine &&
          await findDuplicateIncome({ date, platform, amount: parsedAmount }, entry.id) &&
          !confirm('A matching income already exists. Save another entry?')
        ) return
        await updateIncome(entry.id, { date, platform, amount: parsedAmount, trips: parsedTrips, note })
      } else {
        if (
          navigator.onLine &&
          await findDuplicateExpense({ date, category, amount: parsedAmount }, entry.id) &&
          !confirm('A matching expense already exists. Save another entry?')
        ) return
        await updateExpense(entry.id, { date, category, amount: parsedAmount, note, recurring })
      }
      onClose()
    } catch (error) {
      console.error('Entry update failed:', error)
      notifyApp('error', 'Entry could not be updated.')
    } finally {
      setSubmitting(false)
    }
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
                          ? 'bg-white text-black'
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
                  inputMode="decimal"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full border border-border-dim bg-surface-elevated rounded-xl px-3 py-2.5 text-sm text-text-primary focus:border-accent focus:outline-none transition-colors"
                  min="0.01"
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
                      disabled={locked || Boolean(entry.fuel_log_id || entry.service_record_id)}
                      onClick={() => {
                        setCategory(c)
                        if (c === 'emi') setRecurring(true)
                      }}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                        category === c
                          ? 'bg-white text-black'
                          : 'bg-surface-elevated text-text-secondary border border-border-dim'
                      }`}
                    >
                      {CATEGORY_LABELS[c]}
                    </button>
                  ))}
                </div>
                {(entry.fuel_log_id || entry.service_record_id) && (
                  <p className="text-xs text-text-muted mt-2">
                    {entry.fuel_log_id ? t.linkedFuelEdit : t.linkedServiceEdit}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Amount (₹)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full border border-border-dim bg-surface-elevated rounded-xl px-3 py-2.5 text-sm text-text-primary focus:border-accent focus:outline-none transition-colors"
                  min="0.01"
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
              disabled={submitting || locked}
              className={`flex-1 py-3 rounded-xl text-sm font-semibold text-black transition-all disabled:opacity-50 ${
                entry.kind === 'income'
                  ? 'bg-white shadow-none'
                  : 'bg-white shadow-none'
              }`}
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
