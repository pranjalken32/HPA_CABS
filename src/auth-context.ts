import { createContext } from 'react'
import type { User, Session } from '@supabase/supabase-js'

export type UserRole = 'owner' | 'driver'

export interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  role: UserRole
  displayName: string
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthState | undefined>(undefined)
