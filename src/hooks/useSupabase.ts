import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import type { IncomeRow, ExpenseRow, CarRow, CarDocumentRow, ServiceRecordRow, ProfileRow, FuelLogRow, GoalRow, DriverProfileRow, DriverSettlementRow } from '../supabase'
import { getCachedData, cacheData } from '../utils/offline'
import { getRecurringRowsToAdd, getRecurringTemplates } from '../utils/calculations'
import { lastDayOfMonthString } from '../utils/date'
import { isOnline, queueMutation } from '../utils/offline'

export type { DriverProfileRow, DriverSettlementRow }

export type AppNotification = {
  id: number
  kind: 'error' | 'network' | 'info' | 'success'
  message: string
  persistent?: boolean
}

let notificationId = 0
const notificationListeners = new Set<(notification: AppNotification) => void>()
let backendFailureActive = false

export function subscribeNotifications(listener: (notification: AppNotification) => void) {
  notificationListeners.add(listener)
  return () => notificationListeners.delete(listener)
}

export function notifyApp(
  kind: AppNotification['kind'],
  message: string,
  persistent = kind === 'network'
) {
  const notification = { id: ++notificationId, kind, message, persistent }
  notificationListeners.forEach((listener) => listener(notification))
}

export function reportSupabaseError(error: unknown, context = 'operation') {
  console.error(`${context} failed:`, error)
  const message = isBackendUnreachable(error)
    ? 'The backend is unreachable. Check your connection and try again.'
    : 'This operation could not be completed. Please try again.'
  if (message.startsWith('The backend')) backendFailureActive = true
  notifyApp(message.startsWith('The backend') ? 'network' : 'error', message)
}

export function isBackendUnreachable(error: unknown): boolean {
  const candidate = error as { message?: string; status?: number }
  return error instanceof TypeError ||
    (typeof candidate?.status === 'number' && candidate.status >= 500) ||
    /fetch|network|offline|load failed|gateway|502|503|504/i.test(String(candidate?.message ?? error))
}

export function markBackendAvailable() {
  if (!backendFailureActive) return
  backendFailureActive = false
  notifyApp('success', 'Connection restored.')
}

async function fetchPaged<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const rows: T[] = []
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1)
    if (error) throw error
    markBackendAvailable()
    const chunk = data ?? []
    rows.push(...chunk)
    if (chunk.length < pageSize) return rows
  }
}

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
    fetchPaged((from, to) => supabase
      .from('incomes')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false })
      .range(from, to))
      .then((rows) => {
        setData(rows)
        cacheData(`incomes:${startDate}:${endDate}`, rows)
      })
      .catch((error) => {
        reportSupabaseError(error, 'Income query')
        const cached = getCachedData<IncomeRow[]>(`incomes:${startDate}:${endDate}`)
        if (cached) {
          setData(cached)
          notifyApp('info', 'Showing cached data from your last successful sync.')
        }
      })
  }, [startDate, endDate, refresh])

  return data
}

export function useAllIncomes() {
  const [data, setData] = useState<IncomeRow[]>([])
  const refresh = useRefresh()

  useEffect(() => {
    fetchPaged((from, to) => supabase
      .from('incomes')
      .select('*')
      .order('date', { ascending: false })
      .range(from, to))
      .then((rows) => {
        setData(rows)
        cacheData('all-incomes', rows)
      })
      .catch((error) => {
        reportSupabaseError(error, 'Income history query')
        const cached = getCachedData<IncomeRow[]>('all-incomes')
        if (cached) {
          setData(cached)
          notifyApp('info', 'Showing cached data from your last successful sync.')
        }
      })
  }, [refresh])

  return data
}

export async function addIncome(row: Omit<IncomeRow, 'id' | 'user_id'>) {
  if (!isOnline()) {
    queueMutation('incomes', 'insert', row)
    notifyApp('info', 'Saved offline, will sync when you are back online.')
    return
  }
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
    fetchPaged((from, to) => supabase
      .from('expenses')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false })
      .range(from, to))
      .then((rows) => {
        setData(rows)
        cacheData(`expenses:${startDate}:${endDate}`, rows)
      })
      .catch((error) => {
        reportSupabaseError(error, 'Expense query')
        const cached = getCachedData<ExpenseRow[]>(`expenses:${startDate}:${endDate}`)
        if (cached) {
          setData(cached)
          notifyApp('info', 'Showing cached data from your last successful sync.')
        }
      })
  }, [startDate, endDate, refresh])

  return data
}

export function useAllExpenses() {
  const [data, setData] = useState<ExpenseRow[]>([])
  const refresh = useRefresh()

  useEffect(() => {
    fetchPaged((from, to) => supabase
      .from('expenses')
      .select('*')
      .order('date', { ascending: false })
      .range(from, to))
      .then((rows) => {
        setData(rows)
        cacheData('all-expenses', rows)
      })
      .catch((error) => {
        reportSupabaseError(error, 'Expense history query')
        const cached = getCachedData<ExpenseRow[]>('all-expenses')
        if (cached) {
          setData(cached)
          notifyApp('info', 'Showing cached data from your last successful sync.')
        }
      })
  }, [refresh])

  return data
}

type ExpenseInsert = Omit<ExpenseRow, 'id' | 'user_id' | 'fuel_log_id' | 'service_record_id'> &
  Partial<Pick<ExpenseRow, 'fuel_log_id' | 'service_record_id'>>

export async function addExpense(row: ExpenseInsert) {
  if (!isOnline() && !row.fuel_log_id && !row.service_record_id) {
    queueMutation('expenses', 'insert', {
      ...row,
      fuel_log_id: null,
      service_record_id: null,
    })
    notifyApp('info', 'Saved offline, will sync when you are back online.')
    return
  }
  const { error } = await supabase.from('expenses').insert({
    ...row,
    fuel_log_id: row.fuel_log_id ?? null,
    service_record_id: row.service_record_id ?? null,
  })
  if (error) throw error
  triggerRefresh()
}

export async function findDuplicateIncome(
  row: Pick<IncomeRow, 'date' | 'platform' | 'amount'>,
  excludeId?: number
) {
  let query = supabase
    .from('incomes')
    .select('id')
    .eq('date', row.date)
    .eq('platform', row.platform)
    .eq('amount', row.amount)
    .limit(1)
  if (excludeId !== undefined) query = query.neq('id', excludeId)
  const { data, error } = await query
    .maybeSingle()
  if (error) throw error
  return Boolean(data)
}

export async function findDuplicateExpense(
  row: Pick<ExpenseRow, 'date' | 'category' | 'amount'>,
  excludeId?: number
) {
  let query = supabase
    .from('expenses')
    .select('id')
    .eq('date', row.date)
    .eq('category', row.category)
    .eq('amount', row.amount)
    .limit(1)
  if (excludeId !== undefined) query = query.neq('id', excludeId)
  const { data, error } = await query.maybeSingle()
  if (error) throw error
  return Boolean(data)
}

export async function updateExpense(id: number, updates: Partial<ExpenseRow>) {
  const { data: expense, error: fetchError } = await supabase
    .from('expenses')
    .select('*')
    .eq('id', id)
    .single()
  if (fetchError) throw fetchError

  const { error } = await supabase.from('expenses').update(updates).eq('id', id)
  if (error) throw error

  if (expense.fuel_log_id) {
    const fuelUpdates: Partial<FuelLogRow> = {}
    if (updates.date !== undefined) fuelUpdates.date = updates.date
    if (updates.amount !== undefined) {
      const { data: fuelLog, error: fuelError } = await supabase
        .from('fuel_logs')
        .select('price_per_kg')
        .eq('id', expense.fuel_log_id)
        .single()
      if (fuelError) throw fuelError
      fuelUpdates.total_cost = updates.amount
      if (fuelLog.price_per_kg > 0) {
        fuelUpdates.quantity_kg = Math.round((updates.amount / fuelLog.price_per_kg) * 100) / 100
      }
    }
    if (Object.keys(fuelUpdates).length > 0) {
      const { error: fuelUpdateError } = await supabase
        .from('fuel_logs')
        .update(fuelUpdates)
        .eq('id', expense.fuel_log_id)
      if (fuelUpdateError) throw fuelUpdateError
    }
  } else if (expense.service_record_id) {
    const serviceUpdates: Partial<ServiceRecordRow> = {}
    if (updates.date !== undefined) serviceUpdates.date = updates.date
    if (updates.amount !== undefined) serviceUpdates.cost = updates.amount
    if (updates.note !== undefined) serviceUpdates.description = updates.note
    if (Object.keys(serviceUpdates).length > 0) {
      const { error: serviceUpdateError } = await supabase
        .from('service_records')
        .update(serviceUpdates)
        .eq('id', expense.service_record_id)
      if (serviceUpdateError) throw serviceUpdateError
    }
  }

  triggerRefresh()
}

export async function deleteExpense(id: number) {
  const { data: expense, error: fetchError } = await supabase
    .from('expenses')
    .select('fuel_log_id, service_record_id')
    .eq('id', id)
    .single()
  if (fetchError) throw fetchError

  if (expense.fuel_log_id) {
    const { error } = await supabase.from('fuel_logs').delete().eq('id', expense.fuel_log_id)
    if (error) throw error
  } else if (expense.service_record_id) {
    const { error } = await supabase.from('service_records').delete().eq('id', expense.service_record_id)
    if (error) throw error
  } else {
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) throw error
  }

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
      .then(({ data, error }) => {
        if (error) reportSupabaseError(error, 'Cars query')
        else if (data) setData(data)
      })
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
      .then(({ data, error }) => {
        if (error) reportSupabaseError(error, 'Car query')
        else if (data) setData(data)
      })
  }, [id, refresh])

  return data
}

export async function addCar(row: Omit<CarRow, 'id' | 'user_id' | 'created_at'>) {
  const { error } = await supabase.from('cars').insert(row)
  if (error) throw error
  triggerRefresh()
}

export async function deleteCar(id: number) {
  const { count: incomeCount, error: incomeError } = await supabase
    .from('incomes')
    .select('id', { count: 'exact', head: true })
    .eq('car_id', id)
  if (incomeError) throw incomeError

  const { count: expenseCount, error: expenseError } = await supabase
    .from('expenses')
    .select('id', { count: 'exact', head: true })
    .eq('car_id', id)
  if (expenseError) throw expenseError

  if ((incomeCount ?? 0) > 0 || (expenseCount ?? 0) > 0) {
    return {
      deleted: false,
      incomeCount: incomeCount ?? 0,
      expenseCount: expenseCount ?? 0,
    }
  }

  // Only clean up records owned by the car itself. Linked expenses cascade from
  // their fuel/service parent records; financial history is never deleted here.
  for (const table of ['fuel_logs', 'service_records', 'car_documents'] as const) {
    const { error: childError } = await supabase.from(table).delete().eq('car_id', id)
    if (childError) throw childError
  }
  const { error } = await supabase.from('cars').delete().eq('id', id)
  if (error) throw error
  triggerRefresh()
  return { deleted: true, incomeCount: 0, expenseCount: 0 }
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
      .then(({ data, error }) => {
        if (error) reportSupabaseError(error, 'Car documents query')
        else if (data) setData(data)
      })
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
      .order('id', { ascending: false })
      .then(({ data, error }) => {
        if (error) reportSupabaseError(error, 'Service records query')
        else if (data) setData(data)
      })
  }, [carId, refresh])

  return data
}

export async function addServiceRecord(row: Omit<ServiceRecordRow, 'id' | 'user_id'>) {
  const { data: record, error } = await supabase
    .from('service_records')
    .insert(row)
    .select()
    .single()
  if (error) throw error

  if (row.cost > 0) {
    const { error: expenseError } = await supabase.from('expenses').insert({
      date: row.date,
      category: 'service',
      amount: row.cost,
      note: row.description,
      recurring: false,
      car_id: row.car_id,
      receipt_url: null,
      fuel_log_id: null,
      service_record_id: record.id,
    })
    if (expenseError) throw expenseError
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
      .then(({ data, error }) => {
        if (error) {
          reportSupabaseError(error, 'Profiles query')
          return
        }
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
      .order('id', { ascending: false })
      .then(({ data, error }) => {
        if (error) reportSupabaseError(error, 'Fuel logs query')
        else if (data) setData(data)
      })
  }, [carId, refresh])

  return data
}

export async function addFuelLog(row: Omit<FuelLogRow, 'id' | 'user_id'>) {
  const { data: log, error } = await supabase
    .from('fuel_logs')
    .insert(row)
    .select()
    .single()
  if (error) throw error
  // Auto-create matching expense for this fuel fill
  if (row.total_cost > 0) {
    const fuelNote = row.fuel_type === 'petrol'
      ? `Petrol ₹${row.total_cost}`
      : `${row.quantity_kg}kg CNG @ ₹${row.price_per_kg}/kg`
    const { error: expenseError } = await supabase.from('expenses').insert({
      date: row.date,
      category: 'fuel',
      amount: row.total_cost,
      note: fuelNote,
      recurring: false,
      car_id: row.car_id,
      receipt_url: null,
      fuel_log_id: log.id,
      service_record_id: null,
    })
    if (expenseError) throw expenseError
  }
  triggerRefresh()
}

export async function updateFuelLog(id: number, updates: Partial<FuelLogRow>) {
  const { data: log, error } = await supabase
    .from('fuel_logs')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error

  const fuelNote = log.fuel_type === 'petrol'
    ? `Petrol ₹${log.total_cost}`
    : `${log.quantity_kg}kg CNG @ ₹${log.price_per_kg}/kg`
  const { data: linkedExpense, error: linkedExpenseError } = await supabase
    .from('expenses')
    .select('id')
    .eq('fuel_log_id', id)
    .maybeSingle()
  if (linkedExpenseError) throw linkedExpenseError

  if (log.total_cost > 0) {
    const expense = {
      date: log.date,
      category: 'fuel',
      amount: log.total_cost,
      note: fuelNote,
      recurring: false,
      car_id: log.car_id,
      fuel_log_id: id,
      service_record_id: null,
    }
    if (linkedExpense) {
      const { error: expenseError } = await supabase
        .from('expenses')
        .update(expense)
        .eq('id', linkedExpense.id)
      if (expenseError) throw expenseError
    } else {
      const { error: expenseError } = await supabase
        .from('expenses')
        .insert({ ...expense, receipt_url: null })
      if (expenseError) throw expenseError
    }
  } else if (linkedExpense) {
    const { error: expenseError } = await supabase
      .from('expenses')
      .delete()
      .eq('id', linkedExpense.id)
    if (expenseError) throw expenseError
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
      .then(({ data, error }) => {
        if (error) reportSupabaseError(error, 'Goal query')
        else setData(data)
      })
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
  const { data, error } = await supabase.storage.from('receipts').createSignedUrl(path, 3600)
  if (error) throw error
  return data?.signedUrl ?? ''
}

// ---- Recurring expenses ----

export async function processRecurringExpenses() {
  if (recurringProcess) return recurringProcess
  recurringProcess = processRecurringExpensesOnce()
  try {
    return await recurringProcess
  } finally {
    recurringProcess = null
  }
}

let recurringProcess: Promise<number> | null = null

async function processRecurringExpensesOnce() {
  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const firstOfMonth = `${month}-01`
  const lastOfMonth = lastDayOfMonthString(month)

  const allRecurring = await fetchPaged((from, to) => supabase
    .from('expenses')
    .select('*')
    .eq('recurring', true)
    .order('date', { ascending: true })
    .order('id', { ascending: true })
    .range(from, to))

  if (allRecurring.length === 0) return 0

  const templates = getRecurringTemplates(allRecurring.map((e) => ({
    date: e.date,
    category: e.category,
    amount: e.amount,
    note: e.note,
    car_id: e.car_id,
  })))

  const thisMonthExpenses = await fetchPaged((from, to) => supabase
    .from('expenses')
    .select('*')
    .gte('date', firstOfMonth)
    .lte('date', lastOfMonth)
    .eq('recurring', true)
    .range(from, to))

  const toAdd = getRecurringRowsToAdd(templates, thisMonthExpenses.map((e) => ({
    category: e.category,
    amount: e.amount,
    note: e.note,
    car_id: e.car_id,
  })), firstOfMonth)
    .map((row): ExpenseInsert => ({
      date: row.date ?? firstOfMonth,
      category: row.category,
      amount: row.amount,
      note: row.note,
      recurring: true,
      car_id: row.car_id,
      receipt_url: null,
      fuel_log_id: null,
      service_record_id: null,
    }))

  if (toAdd.length > 0) {
    const { error: insertError } = await supabase.from('expenses').insert(toAdd)
    if (insertError) throw insertError
    triggerRefresh()
  }

  return toAdd.length
}

// ---- Driver Auth Users (profiles with role='driver') ----

export function useDriverUsers() {
  const [data, setData] = useState<ProfileRow[]>([])
  const refresh = useRefresh()

  useEffect(() => {
    supabase
      .from('profiles')
      .select('*')
      .eq('role', 'driver')
      .then(({ data, error }) => {
        if (error) reportSupabaseError(error, 'Driver users query')
        else if (data) setData(data)
      })
  }, [refresh])

  return data
}

// ---- Driver Profiles ----

export function useDriverProfiles() {
  const [data, setData] = useState<DriverProfileRow[]>([])
  const refresh = useRefresh()

  useEffect(() => {
    supabase
      .from('driver_profiles')
      .select('*')
      .then(({ data, error }) => {
        if (error) reportSupabaseError(error, 'Driver profiles query')
        else if (data) setData(data)
      })
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
  const { error: settlementError } = await supabase.from('driver_settlements').delete().eq('driver_profile_id', id)
  if (settlementError) throw settlementError
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

export function useDriverSettlements(filter?: { driverProfileId?: number; driverName?: string }) {
  const [data, setData] = useState<DriverSettlementRow[]>([])
  const refresh = useRefresh()

  useEffect(() => {
    let query = supabase
      .from('driver_settlements')
      .select('*')
      .order('month', { ascending: false })
    if (filter?.driverProfileId) {
      query = query.eq('driver_profile_id', filter.driverProfileId)
    } else if (filter?.driverName) {
      query = query.eq('driver_name', filter.driverName)
    }
    query.then(({ data, error }) => {
      if (error) reportSupabaseError(error, 'Settlement query')
      else if (data) setData(data)
    })
  }, [filter?.driverProfileId, filter?.driverName, refresh])

  return data
}

export async function addSettlement(row: { driver_name: string; driver_profile_id: number; month: string; amount: number; settled_date: string }) {
  const { error } = await supabase.from('driver_settlements').insert(row)
  if (error) throw error
  triggerRefresh()
}

export async function removeSettlement(driverProfileId: number, month: string) {
  const { error } = await supabase
    .from('driver_settlements')
    .delete()
    .eq('driver_profile_id', driverProfileId)
    .eq('month', month)
  if (error) throw error
  triggerRefresh()
}
