import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCars, addCar, updateCar } from '../hooks/useSupabase'
import type { CarRow } from '../supabase'
import { Plus, Car, ChevronRight, Edit2, X } from 'lucide-react'

export default function Cars() {
  const navigate = useNavigate()
  const cars = useCars()
  const [showForm, setShowForm] = useState(false)
  const [editCar, setEditCar] = useState<CarRow | null>(null)
  const [name, setName] = useState('')
  const [number, setNumber] = useState('')
  const [totalCost, setTotalCost] = useState('')

  const resetForm = () => {
    setName('')
    setNumber('')
    setTotalCost('')
    setEditCar(null)
    setShowForm(false)
  }

  const openEditForm = (car: CarRow, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditCar(car)
    setName(car.name)
    setNumber(car.number)
    setTotalCost(String(car.total_cost))
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !number.trim()) return
    if (editCar) {
      await updateCar(editCar.id, {
        name: name.trim(),
        number: number.trim().toUpperCase(),
        total_cost: Number(totalCost) || 0,
      })
    } else {
      await addCar({
        name: name.trim(),
        number: number.trim().toUpperCase(),
        total_cost: Number(totalCost) || 0,
      })
    }
    resetForm()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-text-primary">My Cars</h2>
        <button
          onClick={() => { resetForm(); setShowForm(!showForm) }}
          className="flex items-center gap-1.5 bg-white hover:bg-gray-200 text-black text-xs font-semibold px-3 py-2 rounded-xl transition-colors"
        >
          <Plus size={14} />
          Add Car
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-surface-card rounded-2xl p-4 border border-border-dim space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">{editCar ? 'Edit Car' : 'Add Car'}</h3>
            <button type="button" onClick={resetForm} className="text-text-muted hover:text-white">
              <X size={18} />
            </button>
          </div>
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
            className="w-full bg-white text-black font-semibold py-2.5 rounded-xl text-sm hover:bg-gray-200"
          >
            {editCar ? 'Update Car' : 'Save Car'}
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
          <div
            key={car.id}
            className="w-full bg-surface-card rounded-2xl p-4 border border-border-dim flex items-center gap-3 text-left hover:border-white/20 transition-colors cursor-pointer"
            onClick={() => navigate(`/cars/${car.id}`)}
          >
            <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
              <Car size={20} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text-primary truncate">{car.name}</p>
              <p className="text-xs text-text-muted font-mono">{car.number}</p>
            </div>
            <button
              onClick={(e) => openEditForm(car, e)}
              className="p-2 text-text-muted hover:text-white transition-colors shrink-0"
              title="Edit car"
            >
              <Edit2 size={16} />
            </button>
            <ChevronRight size={18} className="text-text-muted shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}
