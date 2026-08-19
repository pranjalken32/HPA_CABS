import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import type { User, Session } from '@supabase/supabase-js'
import { isBackendUnreachable, notifyApp, reportSupabaseError } from './hooks/useSupabase'
import { AuthContext, type UserRole } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<UserRole>('owner')
  const [displayName, setDisplayName] = useState('')

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('display_name, role')
      .eq('id', userId)
      .maybeSingle()
    if (error) {
      console.error('Profile query failed:', error)
      notifyApp('error', 'Your profile could not be loaded.')
    } else if (data) {
      setRole((data.role as UserRole) ?? 'owner')
      setDisplayName(data.display_name ?? '')
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Session query failed:', error)
        notifyApp('error', 'Your session could not be restored.')
      }
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id).then(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id)
      } else {
        setRole('owner')
        setDisplayName('')
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      if (isBackendUnreachable(error)) {
        reportSupabaseError(error, 'Sign in')
        return 'The backend is unreachable. Check your connection and try again.'
      }
      console.error('Sign in failed:', error)
      notifyApp('error', 'Sign in failed. Check your email and password and try again.')
      return 'Sign in failed. Check your email and password and try again.'
    }
    return null
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Sign out failed:', error)
      notifyApp('error', 'You could not be signed out. Please try again.')
    }
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, role, displayName, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
