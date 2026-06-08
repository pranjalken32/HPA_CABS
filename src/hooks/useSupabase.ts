import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import type { IncomeRow, ExpenseRow, CarRow, CarDocumentRow, ServiceRecordRow, ProfileRow, FuelLogRow, GoalRow, DriverProfileRow, DriverSettlementRow } from '../supabase'

export type { DriverProfileRow, DriverSettlementRow }

// ---- Generic refresh counter ----
let _refreshCounter = 0
const _listeners = new Set<() => void>()

export function triggerRefresh() {
  _refreshCounter++
  _listeners.forEach((fn) => fn())
}

function useRefresh() {
  const [, setTick] = useState(0)
  useEffect(() => {
    const handler = () => setTick((t) => t + 1)
    _listeners.add(handler)
    return () => { _listeners.delete(handler) }
  }, [])
  return _refreshCounter
}

// ---- Incomes ----

export function useIncomes(startDate: string, endDate: string) {
  const [data, setData] = useState<IncomeRow[]>([])
  const refresh = useRefresh()

  useEffect(() => {
    supabase
      .from('incomes')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false })
      .then(({ data }) => setData(data ?? []))
  }, [startDate, endDate, refresh])

  return data
}

export function useAllIncomes() {
  const [data, setData] = useState<IncomeRow[]>([])
  const refresh = useRefresh()

  useEffect(() => {
    supabase
      .from('incomes')
      .select('*')
      .order('date', { ascending: false })
      .then(({ data }) => setData(data ?? []))
  }, [refresh])

  return data
}

export async function addIncome(row: Omit<IncomeRow, 'id' | 'user_id'>) {
  const { error } = await supabase.from('incomes').insert(row)
  if (error) throw error
  triggerRefresh()
}

export async function updateIncome(id: number, updates: Partial<IncomeRow>) {
  const { error } = await supabase.from('incomes').update(updates).eq('id', id)
  if (error) throw error
  triggerRefresh()
}

export async function deleteIncome(id: number) {
  const { error } = await supabase.from('incomes').delete().eq('id', id)
  if (error) throw error
  triggerRefresh()
}

// ---- Expenses ----

export function useExpenses(startDate: string, endDate: string) {
  const [data, setData] = useState<ExpenseRow[]>([])
  const refresh = useRefresh()

  useEffect(() => {
    supabase
      .from('expenses')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false })
      .then(({ data }) => setData(data ?? []))
  }, [startDate, endDate, refresh])

  return data
}

export function useAllExpenses() {
  const [data, setData] = useState<ExpenseRow[]>([])
  const refresh = useRefresh()

  useEffect(() => {
    supabase
      .from('expenses')
      .select('*')
      .order('date', { ascending: false })
      .then(({ data }) => setData(data ?? []))
  }, [refresh])

  return data
}

export async function addExpense(row: Omit<ExpenseRow, 'id' | 'user_id'>) {
  const { error } = await supabase.from('expenses').insert(row)
  if (error) throw error
  triggerRefresh()
}

export async function updateExpense(id: number, updates: Partial<ExpenseRow>) {
  const { error } = await supabase.from('expenses').update(updates).eq('id', id)
  if (error) throw error
  triggerRefresh()
}

export async function deleteExpense(id: number) {
  const { error } = await supabase.from('expenses').delete().eq('id', id)
  if (error) throw error
  triggerRefresh()
}

// ---- Cars ----

export function useCars() {
  const [data, setData] = useState<CarRow[]>([])
  const refresh = useRefresh()

  useEffect(() => {
    supabase
      .from('cars')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => setData(data ?? []))
  }, [refresh])

  return data
}

export function useCar(id: number) {
  const [data, setData] = useState<CarRow | null>(null)
  const refresh = useRefresh()

  useEffect(() => {
    supabase
      .from('cars')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => setData(data))
  }, [id, refresh])

  return data
}

export async function addCar(row: Omit<CarRow, 'id' | 'user_id' | 'created_at'>) {
  const { error } = await supabase.from('cars').insert(row)
  if (error) throw error
  triggerRefresh()
}

export async function deleteCar(id: number) {
  const { error } = await supabase.from('cars').delete().eq('id', id)
  if (error) throw error
  triggerRefresh()
}

// ---- Car Documents ----

export function useCarDocuments(carId: number) {
  const [data, setData] = useState<CarDocumentRow[]>([])
  const refresh = useRefresh()

  useEffect(() => {
    supabase
      .from('car_documents')
      .select('*')
      .eq('car_id', carId)
      .then(({ data }) => setData(data ?? []))
  }, [carId, refresh])

  return data
}

export async function uploadCarDocFile(file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `car-docs/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage.from('receipts').upload(path, file)
  if (error) throw error
  return path
}

export async function addCarDocument(row: Omit<CarDocumentRow, 'id' | 'user_id'>) {
  const { error } = await supabase.from('car_documents').insert(row)
  if (error) throw error
  triggerRefresh()
}

export async function updateCarDocument(id: number, updates: Partial<CarDocumentRow>) {
  const { error } = await supabase.from('car_documents').update(updates).eq('id', id)
  if (error) throw error
  triggerRefresh()
}

export async function deleteCarDocument(id: number) {
  const { error } = await supabase.from('car_documents').delete().eq('id', id)
  if (error) throw error
  triggerRefresh()
}

// ---- Service Records ----

export function useServiceRecords(carId: number) {
  const [data, setData] = useState<ServiceRecordRow[]>([])
  const refresh = useRefresh()

  useEffect(() => {
    supabase
      .from('service_records')
      .select('*')
      .eq('car_id', carId)
      .order('date', { ascending: false })
      .then(({ data }) => setData(data ?? []))
  }, [carId, refresh])

  return data
}

export async function addServiceRecord(row: Omit<ServiceRecordRow, 'id' | 'user_id'>) {
  const { error } = await supabase.from('service_records').insert(row)
  if (error) throw error

  if (row.cost > 0) {
    await supabase.from('expenses').insert({
      date: row.date,
      category: 'service',
      amount: row.cost,
      note: row.description,
      recurring: false,
      car_id: row.car_id,
      receipt_url: null,
    })
  }

  triggerRefresh()
}

export async function deleteServiceRecord(id: number) {
  const { error } = await supabase.from('service_records').delete().eq('id', id)
  if (error) throw error
  triggerRefresh()
}

// ---- Profiles ----

export function useProfiles() {
  const [profiles, setProfiles] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, display_name')
      .then(({ data }) => {
        const map = new Map<string, string>()
        for (const p of (data as ProfileRow[]) ?? []) {
          map.set(p.id, p.display_name)
        }
        setProfiles(map)
      })
  }, [])

  return profiles
}

// ---- Fuel Logs ----

export function useFuelLogs(carId: number) {
  const [data, setData] = useState<FuelLogRow[]>([])
  const refresh = useRefresh()

  useEffect(() => {
    supabase
      .from('fuel_logs')
      .select('*')
      .eq('car_id', carId)
      .order('date', { ascending: false })
      .then(({ data }) => setData(data ?? []))
  }, [carId, refresh])

  return data
}

export async function addFuelLog(row: Omit<FuelLogRow, 'id' | 'user_id'>) {
  const { error } = await supabase.from('fuel_logs').insert(row)
  if (error) throw error
  // Auto-create matching expense for this fuel fill
  if (row.total_cost > 0) {
    await supabase.from('expenses').insert({
      date: row.date,
      category: 'fuel',
      amount: row.total_cost,
      note: `${row.quantity_kg}kg CNG @ ₹${row.price_per_kg}/kg`,
      recurring: false,
      car_id: row.car_id,
      receipt_url: null,
    })
  }
  triggerRefresh()
}

export async function deleteFuelLog(id: number) {
  const { error } = await supabase.from('fuel_logs').delete().eq('id', id)
  if (error) throw error
  triggerRefresh()
}

// ---- Goals ----

export function useGoal(month: string) {
  const [data, setData] = useState<GoalRow | null>(null)
  const refresh = useRefresh()

  useEffect(() => {
    supabase
      .from('goals')
      .select('*')
      .eq('month', month)
      .maybeSingle()
      .then(({ data }) => setData(data))
  }, [month, refresh])

  return data
}

export async function upsertGoal(month: string, targetRevenue: number) {
  const { error } = await supabase
    .from('goals')
    .upsert({ month, target_revenue: targetRevenue }, { onConflict: 'month' })
  if (error) throw error
  triggerRefresh()
}

// ---- Receipt Upload ----

export async function uploadReceipt(file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `receipts/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage.from('receipts').upload(path, file)
  if (error) throw error
  return path
}

export async function getSignedUrl(path: string): Promise<string> {
  if (!path) return ''
  if (path.startsWith('http')) {
    // Legacy full URL — extract path after /object/public/receipts/ or /object/sign/receipts/
    const match = path.match(/\/receipts\/(.+)$/)
    if (match) path = match[1]
    else return path
  }
  const { data } = await supabase.storage.from('receipts').createSignedUrl(path, 3600)
  return data?.signedUrl ?? ''
}

// ---- Recurring expenses ----

export async function processRecurringExpenses() {
  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const firstOfMonth = `${month}-01`
  const lastOfMonth = `${month}-31`

  const { data: allRecurring } = await supabase
    .from('expenses')
    .select('*')
    .eq('recurring', true)

  if (!allRecurring || allRecurring.length === 0) return 0

  const templates = new Map<string, { category: string; amount: number; note: string; car_id: number | null }>()
  for (const e of allRecurring) {
    const key = `${e.category}|${e.amount}|${e.note}`
    if (!templates.has(key)) {
      templates.set(key, { category: e.category, amount: e.amount, note: e.note, car_id: e.car_id })
    }
  }

  const { data: thisMonthExpenses } = await supabase
    .from('expenses')
    .select('*')
    .gte('date', firstOfMonth)
    .lte('date', lastOfMonth)
    .eq('recurring', true)

  const existingKeys = new Set(
    (thisMonthExpenses ?? []).map((e: ExpenseRow) => `${e.category}|${e.amount}|${e.note}`)
  )

  const toAdd: Omit<ExpenseRow, 'id' | 'user_id'>[] = []
  for (const [key, tmpl] of templates) {
    if (!existingKeys.has(key)) {
      toAdd.push({
        date: firstOfMonth,
        category: tmpl.category,
        amount: tmpl.amount,
        note: tmpl.note,
        recurring: true,
        car_id: tmpl.car_id,
        receipt_url: null,
      })
    }
  }

  if (toAdd.length > 0) {
    await supabase.from('expenses').insert(toAdd)
    triggerRefresh()
  }

  return toAdd.length
}

// ---- Driver Profiles ----

export function useDriverProfiles() {
  const [data, setData] = useState<DriverProfileRow[]>([])
  const refresh = useRefresh()

  useEffect(() => {
    supabase
      .from('driver_profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => setData(data ?? []))
  }, [refresh])

  return data
}

export async function addDriverProfile(row: Omit<DriverProfileRow, 'id' | 'user_id' | 'created_at'>) {
  const { error } = await supabase.from('driver_profiles').insert(row)
  if (error) throw error
  triggerRefresh()
}

export async function updateDriverProfile(id: number, updates: Partial<DriverProfileRow>) {
  const { error } = await supabase.from('driver_profiles').update(updates).eq('id', id)
  if (error) throw error
  triggerRefresh()
}

export async function deleteDriverProfile(id: number) {
  const { error } = await supabase.from('driver_profiles').delete().eq('id', id)
  if (error) throw error
  triggerRefresh()
}

export async function uploadDriverDoc(file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `driver-docs/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage.from('receipts').upload(path, file)
  if (error) throw error
  return path
}

// ---- Edit Car ----

export async function updateCar(id: number, updates: Partial<CarRow>) {
  const { error } = await supabase.from('cars').update(updates).eq('id', id)
  if (error) throw error
  triggerRefresh()
}

// ---- Driver Settlements ----

export function useDriverSettlements(driverName?: string) {
  const [data, setData] = useState<DriverSettlementRow[]>([])
  const refresh = useRefresh()

  useEffect(() => {
    let query = supabase
      .from('driver_settlements')
      .select('*')
      .order('month', { ascending: false })
    if (driverName) {
      query = query.eq('driver_name', driverName)
    }
    query.then(({ data }) => setData(data ?? []))
  }, [driverName, refresh])

  return data
}

export async function addSettlement(row: { driver_name: string; month: string; amount: number; settled_date: string }) {
  const { error } = await supabase.from('driver_settlements').insert(row)
  if (error) throw error
  triggerRefresh()
}

export async function removeSettlement(driverName: string, month: string) {
  const { error } = await supabase
    .from('driver_settlements')
    .delete()
    .eq('driver_name', driverName)
    .eq('month', month)
  if (error) throw error
  triggerRefresh()
}
