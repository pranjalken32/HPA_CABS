import { useState } from 'react'
import { addIncome, useCars } from '../hooks/useSupabase'
import { CheckCircle2, Car } from 'lucide-react'

const PLATFORMS = ['rapido', 'ola', 'uber', 'cash', 'other']

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
}

export default function AddIncome() {
  const cars = useCars()
  const [date, setDate] = useState(todayStr())
  const [platform, setPlatform] = useState('rapido')
  const [amount, setAmount] = useState('')
  const [trips, setTrips] = useState('')
  const [note, setNote] = useState('')
  const [carId, setCarId] = useState<number | null>(null)
  const [saved, setSaved] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || Number(amount) <= 0) return
    await addIncome({
      date,
      platform,
      amount: Number(amount),
      trips: Number(trips) || 0,
      note,
      car_id: carId,
    })
    setSaved(true)
    setTimeout(() => {
      setSaved(false)
      setAmount('')
      setTrips('')
      setNote('')
    }, 1200)
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-text-primary mb-4">Add Income</h2>

      {saved && (
        <div className="bg-income/10 text-income border border-income/20 rounded-xl p-3 mb-4 flex items-center gap-2 text-sm font-medium">
          <CheckCircle2 size={18} /> Income saved!
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
          <label className="block text-sm font-medium text-text-secondary mb-1">
            Amount (₹)
          </label>
          <input
            type="number"
            inputMode="numeric"
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
            Number of Trips
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
            Note (optional)
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
              Assign to Car
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
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          type="submit"
          className="w-full bg-white text-black font-semibold py-3 rounded-xl transition-all hover:bg-gray-200"
        >
          Save Income
        </button>
      </form>
    </div>
  )
}
