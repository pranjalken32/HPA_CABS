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
}
