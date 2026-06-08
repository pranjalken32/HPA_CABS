import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ---- TypeScript row types (match the SQL schema) ----

export interface IncomeRow {
  id: number
  user_id: string
  date: string
  platform: string
  amount: number
  trips: number
  note: string
  car_id: number | null
}

export interface ExpenseRow {
  id: number
  user_id: string
  date: string
  category: string
  amount: number
  note: string
  recurring: boolean
  car_id: number | null
  receipt_url: string | null
}

export interface CarRow {
  id: number
  user_id: string
  name: string
  number: string
  total_cost: number
  created_at: string
}

export interface CarDocumentRow {
  id: number
  user_id: string
  car_id: number
  doc_type: string
  expiry_date: string
  note: string
  file_url: string | null
}

export interface ServiceRecordRow {
  id: number
  user_id: string
  car_id: number
  date: string
  description: string
  cost: number
  odometer_km: number
}

export interface ProfileRow {
  id: string
  display_name: string
  role: 'owner' | 'driver'
}

export interface FuelLogRow {
  id: number
  user_id: string
  car_id: number
  date: string
  quantity_kg: number
  price_per_kg: number
  total_cost: number
  odometer_km: number
}

export interface GoalRow {
  id: number
  user_id: string
  month: string
  target_revenue: number
}

export interface DriverProfileRow {
  id: number
  user_id: string
  name: string
  phone: string
  start_date: string
  end_date: string | null
  monthly_salary: number
  car_id: number | null
  incentive_target: number
  incentive_base: number
  incentive_step: number
  incentive_slab: number
  dl_url: string | null
  aadhaar_url: string | null
  pan_url: string | null
  active: boolean
  created_at: string
}
