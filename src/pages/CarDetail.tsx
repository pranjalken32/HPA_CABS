import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import {
  ArrowLeft,
  FileText,
  Wrench,
  TrendingUp,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from 'lucide-react'

const DOC_TYPES = [
  'Insurance',
  'Permit',
  'PUC',
  'Fitness Certificate',
  'Road Tax',
  'Registration (RC)',
  'Other',
]

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function fmt(n: number): string {
  return n.toLocaleString('en-IN')
}

type Tab = 'docs' | 'recovery' | 'service'

export default function CarDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const carId = Number(id)

  const car = useLiveQuery(() => db.cars.get(carId), [carId])
  const docs = useLiveQuery(() => db.carDocuments.where('carId').equals(carId).toArray(), [carId])
  const services = useLiveQuery(
    () => db.serviceRecords.where('carId').equals(carId).reverse().sortBy('date'),
    [carId]
  )
  const incomes = useLiveQuery(() => db.incomes.where('carId').equals(carId).toArray(), [carId])

  const [tab, setTab] = useState<Tab>('docs')

  // Doc form
  const [showDocForm, setShowDocForm] = useState(false)
  const [docType, setDocType] = useState(DOC_TYPES[0])
  const [docExpiry, setDocExpiry] = useState('')
  const [docNote, setDocNote] = useState('')

  // Service form
  const [showServiceForm, setShowServiceForm] = useState(false)
  const [svcDate, setSvcDate] = useState(todayStr())
  const [svcDesc, setSvcDesc] = useState('')
  const [svcCost, setSvcCost] = useState('')
  const [svcOdo, setSvcOdo] = useState('')

  if (!car) {
    return (
      <div className="text-center py-12 text-text-muted">
        <p>Loading...</p>
      </div>
    )
  }

  const totalRecovered = incomes?.reduce((s, i) => s + i.amount, 0) ?? 0
  const totalServiceCost = services?.reduce((s, r) => s + r.cost, 0) ?? 0
  const recoveryPercent = car.totalCost > 0 ? Math.min((totalRecovered / car.totalCost) * 100, 100) : 0
  const remaining = Math.max(car.totalCost - totalRecovered, 0)

  // Estimate time to recover based on monthly average
  const monthsActive = (() => {
    if (!incomes || incomes.length === 0) return 0
    const dates = incomes.map((i) => new Date(i.date).getTime())
    const earliest = Math.min(...dates)
    const latest = Math.max(...dates)
    const diffMs = latest - earliest
    return Math.max(diffMs / (1000 * 60 * 60 * 24 * 30), 1)
  })()
  const monthlyAvg = monthsActive > 0 ? totalRecovered / monthsActive : 0
  const monthsToRecover = monthlyAvg > 0 ? Math.ceil(remaining / monthlyAvg) : 0

  const handleAddDoc = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!docExpiry) return
    await db.carDocuments.add({
      carId,
      docType,
      expiryDate: docExpiry,
      note: docNote.trim(),
    })
    setDocExpiry('')
    setDocNote('')
    setShowDocForm(false)
  }

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!svcDesc.trim()) return
    await db.serviceRecords.add({
      carId,
      date: svcDate,
      description: svcDesc.trim(),
      cost: Number(svcCost) || 0,
      odometerKm: Number(svcOdo) || 0,
    })
    setSvcDesc('')
    setSvcCost('')
    setSvcOdo('')
    setShowServiceForm(false)
  }

  const handleDeleteCar = async () => {
    if (!confirm(`Delete "${car.name}" and all its data?`)) return
    await db.carDocuments.where('carId').equals(carId).delete()
    await db.serviceRecords.where('carId').equals(carId).delete()
    await db.cars.delete(carId)
    navigate('/cars')
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'docs', label: 'Documents', icon: <FileText size={14} /> },
    { key: 'recovery', label: 'Recovery', icon: <TrendingUp size={14} /> },
    { key: 'service', label: 'Service', icon: <Wrench size={14} /> },
  ]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/cars')} className="text-text-muted hover:text-text-primary transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-text-primary">{car.name}</h2>
          <p className="text-xs text-text-muted font-mono">{car.number}</p>
        </div>
        <button onClick={handleDeleteCar} className="text-text-muted hover:text-expense transition-colors p-1">
          <Trash2 size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-surface-card rounded-xl border border-border-dim p-1 gap-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
              tab === t.key
                ? 'bg-accent text-white shadow-md shadow-accent/20'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Documents Tab */}
      {tab === 'docs' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-secondary">Documents & Expiry</h3>
            <button
              onClick={() => setShowDocForm(!showDocForm)}
              className="flex items-center gap-1 text-accent-light text-xs font-semibold"
            >
              <Plus size={14} /> Add
            </button>
          </div>

          {showDocForm && (
            <form onSubmit={handleAddDoc} className="bg-surface-elevated rounded-xl p-3 border border-border-dim space-y-2">
              <div>
                <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">Document Type</label>
                <div className="flex flex-wrap gap-1.5">
                  {DOC_TYPES.map((dt) => (
                    <button
                      key={dt}
                      type="button"
                      onClick={() => setDocType(dt)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                        docType === dt
                          ? 'bg-accent text-white'
                          : 'bg-surface-card text-text-muted border border-border-dim'
                      }`}
                    >
                      {dt}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">Expiry Date</label>
                <input
                  type="date"
                  value={docExpiry}
                  onChange={(e) => setDocExpiry(e.target.value)}
                  className="w-full border border-border-dim bg-surface-card rounded-lg px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">Note (optional)</label>
                <input
                  type="text"
                  value={docNote}
                  onChange={(e) => setDocNote(e.target.value)}
                  placeholder="e.g. Policy #12345"
                  className="w-full border border-border-dim bg-surface-card rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-accent text-white font-semibold py-2 rounded-lg text-xs"
              >
                Save Document
              </button>
            </form>
          )}

          {(docs?.length ?? 0) === 0 && !showDocForm && (
            <p className="text-center text-text-muted text-sm py-6">No documents added yet</p>
          )}

          {docs?.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate)).map((doc) => {
            const days = daysUntil(doc.expiryDate)
            const isExpired = days < 0
            const isExpiring = days >= 0 && days <= 30
            return (
              <div
                key={doc.id}
                className={`bg-surface-card rounded-xl p-3 border flex items-center gap-3 ${
                  isExpired
                    ? 'border-expense/40'
                    : isExpiring
                    ? 'border-yellow-500/40'
                    : 'border-border-dim'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    isExpired
                      ? 'bg-expense/10 text-expense'
                      : isExpiring
                      ? 'bg-yellow-500/10 text-yellow-400'
                      : 'bg-income/10 text-income'
                  }`}
                >
                  {isExpired ? <AlertTriangle size={16} /> : isExpiring ? <Clock size={16} /> : <CheckCircle2 size={16} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text-primary">{doc.docType}</p>
                  <p className="text-[11px] text-text-muted">
                    {isExpired
                      ? `Expired ${Math.abs(days)} days ago`
                      : isExpiring
                      ? `Expires in ${days} days`
                      : `Valid until ${doc.expiryDate}`}
                  </p>
                  {doc.note && <p className="text-[10px] text-text-muted mt-0.5">{doc.note}</p>}
                </div>
                <button
                  onClick={async () => { await db.carDocuments.delete(doc.id) }}
                  className="text-text-muted hover:text-expense transition-colors shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Recovery Tab */}
      {tab === 'recovery' && (
        <div className="space-y-4">
          {/* Progress ring / bar */}
          <div className="bg-surface-card rounded-2xl p-5 border border-border-dim text-center space-y-4">
            <h3 className="text-sm font-semibold text-text-secondary">Cost Recovery</h3>

            {/* Circular progress */}
            <div className="relative w-32 h-32 mx-auto">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#2a2a45" strokeWidth="8" />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke={recoveryPercent >= 100 ? '#00e676' : '#6c5ce7'}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${recoveryPercent * 2.64} 264`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black text-text-primary">{recoveryPercent.toFixed(0)}%</span>
                <span className="text-[10px] text-text-muted">recovered</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface-elevated rounded-xl p-3">
                <p className="text-[10px] text-text-muted uppercase tracking-wider">Total Cost</p>
                <p className="text-sm font-bold text-text-primary">₹{fmt(car.totalCost)}</p>
              </div>
              <div className="bg-surface-elevated rounded-xl p-3">
                <p className="text-[10px] text-text-muted uppercase tracking-wider">Recovered</p>
                <p className="text-sm font-bold text-income">₹{fmt(totalRecovered)}</p>
              </div>
              <div className="bg-surface-elevated rounded-xl p-3">
                <p className="text-[10px] text-text-muted uppercase tracking-wider">Remaining</p>
                <p className="text-sm font-bold text-expense">₹{fmt(remaining)}</p>
              </div>
              <div className="bg-surface-elevated rounded-xl p-3">
                <p className="text-[10px] text-text-muted uppercase tracking-wider">Service Cost</p>
                <p className="text-sm font-bold text-yellow-400">₹{fmt(totalServiceCost)}</p>
              </div>
            </div>

            {monthlyAvg > 0 && remaining > 0 && (
              <div className="bg-surface-elevated rounded-xl p-3">
                <p className="text-[10px] text-text-muted uppercase tracking-wider">Est. Time to Recover</p>
                <p className="text-sm font-bold text-accent-light">
                  ~{monthsToRecover} month{monthsToRecover !== 1 ? 's' : ''}
                </p>
                <p className="text-[10px] text-text-muted mt-0.5">
                  Based on ₹{fmt(Math.round(monthlyAvg))}/month avg revenue
                </p>
              </div>
            )}

            {car.totalCost === 0 && (
              <p className="text-xs text-text-muted">Set car total cost to see recovery progress</p>
            )}
          </div>
        </div>
      )}

      {/* Service Tab */}
      {tab === 'service' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-secondary">Service History</h3>
            <button
              onClick={() => setShowServiceForm(!showServiceForm)}
              className="flex items-center gap-1 text-accent-light text-xs font-semibold"
            >
              <Plus size={14} /> Add
            </button>
          </div>

          {showServiceForm && (
            <form onSubmit={handleAddService} className="bg-surface-elevated rounded-xl p-3 border border-border-dim space-y-2">
              <div>
                <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">Date</label>
                <input
                  type="date"
                  value={svcDate}
                  onChange={(e) => setSvcDate(e.target.value)}
                  className="w-full border border-border-dim bg-surface-card rounded-lg px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">Description</label>
                <input
                  type="text"
                  value={svcDesc}
                  onChange={(e) => setSvcDesc(e.target.value)}
                  placeholder="e.g. Oil change, tyre rotation"
                  className="w-full border border-border-dim bg-surface-card rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">Cost (₹)</label>
                  <input
                    type="number"
                    value={svcCost}
                    onChange={(e) => setSvcCost(e.target.value)}
                    placeholder="e.g. 2500"
                    className="w-full border border-border-dim bg-surface-card rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">Odometer (km)</label>
                  <input
                    type="number"
                    value={svcOdo}
                    onChange={(e) => setSvcOdo(e.target.value)}
                    placeholder="e.g. 45000"
                    className="w-full border border-border-dim bg-surface-card rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-accent text-white font-semibold py-2 rounded-lg text-xs"
              >
                Save Record
              </button>
            </form>
          )}

          {(services?.length ?? 0) === 0 && !showServiceForm && (
            <p className="text-center text-text-muted text-sm py-6">No service records yet</p>
          )}

          {services?.map((svc) => (
            <div key={svc.id} className="bg-surface-card rounded-xl p-3 border border-border-dim flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-yellow-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <Wrench size={16} className="text-yellow-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-primary">{svc.description}</p>
                <p className="text-[11px] text-text-muted">
                  {svc.date}
                  {svc.odometerKm > 0 && ` · ${fmt(svc.odometerKm)} km`}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {svc.cost > 0 && (
                  <span className="text-xs font-bold text-expense">₹{fmt(svc.cost)}</span>
                )}
                <button
                  onClick={async () => { await db.serviceRecords.delete(svc.id) }}
                  className="text-text-muted hover:text-expense transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
