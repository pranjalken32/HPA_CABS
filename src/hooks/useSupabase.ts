import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import type { IncomeRow, ExpenseRow, CarRow, CarDocumentRow, ServiceRecordRow } from '../supabase'

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
  triggerRefresh()
}

export async function deleteServiceRecord(id: number) {
  const { error } = await supabase.from('service_records').delete().eq('id', id)
  if (error) throw error
  triggerRefresh()
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
      })
    }
  }

  if (toAdd.length > 0) {
    await supabase.from('expenses').insert(toAdd)
    triggerRefresh()
  }

  return toAdd.length
}
