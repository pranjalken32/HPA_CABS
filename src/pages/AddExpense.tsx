import { useState, useRef } from 'react'
import { addExpense, uploadReceipt, useCars } from '../hooks/useSupabase'
import { CheckCircle2, Camera, X, Car } from 'lucide-react'

const CATEGORIES = [
  'commission',
  'emi',
  'driver_salary',
  'driver_advance',
  'driver_incentive',
  'insurance',
  'permit',
  'toll',
  'car_wash',
  'service',
  'other',
]

const CATEGORY_LABELS: Record<string, string> = {
  commission: 'Commission',
  emi: 'EMI',
  driver_salary: 'Driver Salary',
  driver_advance: 'Driver Advance',
  driver_incentive: 'Driver Incentive',
  insurance: 'Insurance',
  permit: 'Permit / RTO',
  toll: 'Toll / Parking',
  car_wash: 'Car Wash',
  service: 'Service',
  other: 'Other',
}

const COMMISSION_PLATFORMS = ['Ola', 'Uber', 'Rapido', 'Namma Yatri', 'Other']

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
}

export default function AddExpense() {
  const cars = useCars()
  const [date, setDate] = useState(todayStr())
  const [category, setCategory] = useState('emi')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [recurring, setRecurring] = useState(false)
  const [commissionPlatform, setCommissionPlatform] = useState('Rapido')
  const [carId, setCarId] = useState<number | null>(null)
  const [saved, setSaved] = useState(false)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || Number(amount) <= 0) return
    let receipt_url: string | null = null
    if (receiptFile) {
      setUploading(true)
      try {
        receipt_url = await uploadReceipt(receiptFile)
      } catch {
        // Storage may not be set up yet — save without receipt
      }
      setUploading(false)
    }
    await addExpense({
      date,
      category,
      amount: Number(amount),
      note: category === 'commission' ? `${commissionPlatform}${note ? ' - ' + note : ''}` : note,
      recurring,
      car_id: carId,
      receipt_url,
    })
    setSaved(true)
    setTimeout(() => {
      setSaved(false)
      setAmount('')
      setNote('')
      setReceiptFile(null)
      setReceiptPreview(null)
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
                    ? 'bg-white text-black'
                    : 'bg-surface-elevated text-text-secondary border border-border-dim'
                }`}
              >
                {CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>
        </div>

        {category === 'commission' && (
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">Platform</label>
            <div className="flex flex-wrap gap-2">
              {COMMISSION_PLATFORMS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setCommissionPlatform(p)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    commissionPlatform === p
                      ? 'bg-white text-black'
                      : 'bg-surface-elevated text-text-secondary border border-border-dim'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

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

        <div>
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
          {recurring && (
            <p className="text-xs text-text-muted mt-1.5 ml-8">
              Auto-generated on the 1st of each month
            </p>
          )}
        </div>

        {(cars?.length ?? 0) > 0 && (
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              <Car size={14} className="inline mr-1" />
              Assign to Car (for recovery tracking)
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCarId(null)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
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
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
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

        {/* Receipt Upload */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-2">Receipt Photo (optional)</label>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) {
                setReceiptFile(file)
                setReceiptPreview(URL.createObjectURL(file))
              }
            }}
          />
          {receiptPreview ? (
            <div className="relative">
              <img src={receiptPreview} alt="Receipt" className="w-full h-32 object-cover rounded-xl border border-border-dim" />
              <button
                type="button"
                onClick={() => { setReceiptFile(null); setReceiptPreview(null) }}
                className="absolute top-1 right-1 bg-surface-base/80 rounded-full p-1"
              >
                <X size={14} className="text-text-muted" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full border border-dashed border-border-dim rounded-xl py-4 flex flex-col items-center gap-1 text-text-muted hover:border-accent transition-colors"
            >
              <Camera size={20} />
              <span className="text-xs">Tap to add receipt photo</span>
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={uploading}
          className="w-full bg-white text-black font-semibold py-3 rounded-xl transition-all hover:bg-gray-200 disabled:opacity-60"
        >
          {uploading ? 'Uploading receipt...' : 'Save Expense'}
        </button>
      </form>
    </div>
  )
}
