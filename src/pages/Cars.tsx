import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCars, addCar } from '../hooks/useSupabase'
import { Plus, Car, ChevronRight } from 'lucide-react'

export default function Cars() {
  const navigate = useNavigate()
  const cars = useCars()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [number, setNumber] = useState('')
  const [totalCost, setTotalCost] = useState('')

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !number.trim()) return
    await addCar({
      name: name.trim(),
      number: number.trim().toUpperCase(),
      total_cost: Number(totalCost) || 0,
    })
    setName('')
    setNumber('')
    setTotalCost('')
    setShowForm(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-text-primary">My Cars</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 bg-accent hover:bg-accent/80 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors"
        >
          <Plus size={14} />
          Add Car
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAdd} className="bg-surface-card rounded-2xl p-4 border border-border-dim space-y-3">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Car Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. WagonR, Swift Dzire"
              className="w-full border border-border-dim bg-surface-elevated rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Registration Number</label>
            <input
              type="text"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="e.g. MH12AB1234"
              className="w-full border border-border-dim bg-surface-elevated rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none transition-colors uppercase"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Total Cost (₹)</label>
            <input
              type="number"
              value={totalCost}
              onChange={(e) => setTotalCost(e.target.value)}
              placeholder="e.g. 800000"
              className="w-full border border-border-dim bg-surface-elevated rounded-xl px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none transition-colors"
            />
          </div>
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-accent to-purple-500 text-white font-semibold py-2.5 rounded-xl text-sm shadow-lg shadow-accent/20"
          >
            Save Car
          </button>
        </form>
      )}

      {(cars?.length ?? 0) === 0 && !showForm && (
        <div className="text-center py-16 text-text-muted">
          <Car size={48} className="mx-auto mb-3 opacity-40" />
          <p className="text-lg">No cars added yet</p>
          <p className="text-sm mt-1">Tap "Add Car" to get started</p>
        </div>
      )}

      <div className="space-y-2">
        {cars?.map((car) => (
          <button
            key={car.id}
            onClick={() => navigate(`/cars/${car.id}`)}
            className="w-full bg-surface-card rounded-2xl p-4 border border-border-dim flex items-center gap-3 text-left hover:border-accent/40 transition-colors"
          >
            <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
              <Car size={20} className="text-accent-light" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text-primary truncate">{car.name}</p>
              <p className="text-xs text-text-muted font-mono">{car.number}</p>
            </div>
            <ChevronRight size={18} className="text-text-muted shrink-0" />
          </button>
        ))}
      </div>
    </div>
  )
}
