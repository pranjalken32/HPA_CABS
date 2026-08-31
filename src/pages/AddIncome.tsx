import { useState } from 'react'
import { addIncome, findDuplicateIncome, notifyApp, useCars } from '../hooks/useSupabase'
import { useLanguage } from '../useLanguage'
import { CheckCircle2, Car } from 'lucide-react'
import { isValidCalendarDate, todayStr } from '../utils/date'
import { parseNonNegativeNumber, parsePositiveAmount } from '../utils/money'

const PLATFORMS = ['rapido', 'ola', 'uber', 'namma_yatri', 'cash', 'refund', 'other']

export default function AddIncome() {
  const cars = useCars()
  const { t } = useLanguage()
  const [date, setDate] = useState(todayStr())
  const [platform, setPlatform] = useState('rapido')
  const [amount, setAmount] = useState('')
  const [trips, setTrips] = useState('')
  const [note, setNote] = useState('')
  const [carId, setCarId] = useState<number | null>(null)
  const [saved, setSaved] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting || saved) return
    const parsedAmount = parsePositiveAmount(amount)
    const parsedTrips = trips === '' ? 0 : parseNonNegativeNumber(trips)
    if (!isValidCalendarDate(date) || parsedAmount === null || parsedTrips === null) {
      notifyApp('error', 'Enter a valid date, amount, and trip count.')
      return
    }
    if (date > todayStr() && !confirm('This date is in the future. Save this income anyway?')) return
    setSubmitting(true)
    try {
      const row = { date, platform, amount: parsedAmount, trips: parsedTrips, note, car_id: carId }
      if (navigator.onLine && await findDuplicateIncome(row) && !confirm('A matching income already exists. Save another entry?')) return
      await addIncome(row)
      setSaved(true)
      setTimeout(() => {
        setSaved(false)
        setAmount('')
        setTrips('')
        setNote('')
      }, 1500)
    } catch (error) {
      notifyApp('error', 'Income could not be saved.')
      console.error('Income save failed:', error)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-text-primary mb-4">{t.addIncome}</h2>

      {saved && (
        <div className="bg-income/10 text-income border border-income/20 rounded-xl p-3 mb-4 flex items-center gap-2 text-sm font-medium">
          <CheckCircle2 size={18} /> {t.incomeSaved}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-surface-card rounded-2xl p-5 border border-border-dim space-y-4">
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">{t.date}</label>
          <input
            type="date"
            value={date}
            max={todayStr()}
            onChange={(e) => setDate(e.target.value)}
            className="w-full border border-border-dim bg-surface-elevated rounded-xl px-3 py-2.5 text-sm text-text-primary focus:border-accent focus:outline-none transition-colors"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">{t.platform}</label>
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
          <label className="block text-sm font-medium text-text-secondary mb-1">
            {t.amount}
          </label>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 1500"
            className="w-full border border-border-dim bg-surface-elevated rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none transition-colors"
            min="1"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">
            {t.numberOfTrips}
          </label>
          <input
            type="number"
            inputMode="numeric"
            value={trips}
            onChange={(e) => setTrips(e.target.value)}
            placeholder="e.g. 12"
            className="w-full border border-border-dim bg-surface-elevated rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none transition-colors"
            min="0"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">
            {t.noteOptional}
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Airport rides"
            className="w-full border border-border-dim bg-surface-elevated rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none transition-colors"
          />
        </div>

        {(cars?.length ?? 0) > 0 && (
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              <Car size={14} className="inline mr-1" />
              {t.assignToCar}
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCarId(null)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  carId === null
                    ? 'bg-white text-black'
                    : 'bg-surface-elevated text-text-secondary border border-border-dim'
                }`}
              >
                None
              </button>
              {cars?.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCarId(c.id)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                    carId === c.id
                      ? 'bg-white text-black'
                      : 'bg-surface-elevated text-text-secondary border border-border-dim'
                  }`}
                >
                  {c.number || c.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || saved}
          className="w-full bg-white text-black font-semibold py-3 rounded-xl transition-all hover:bg-gray-200 disabled:opacity-60"
        >
          {submitting ? 'Saving...' : saved ? t.incomeSaved : t.saveIncome}
        </button>
      </form>
    </div>
  )
}
