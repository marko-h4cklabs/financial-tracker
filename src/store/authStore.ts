import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types'

interface AuthState {
  user: { id: string; email: string | undefined } | null
  profile: Profile | null
  isLoading: boolean
  isAdmin: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  fetchProfile: (userId: string) => Promise<void>
  initialize: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  isLoading: true,
  isAdmin: false,

  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    if (!data.user) throw new Error('Sign in failed')

    await get().fetchProfile(data.user.id)
    const profile = get().profile

    if (profile && !profile.is_active) {
      await supabase.auth.signOut()
      set({ user: null, profile: null, isAdmin: false })
      throw new Error('Your account has been deactivated. Contact an admin.')
    }

    set({
      user: { id: data.user.id, email: data.user.email },
    })
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, profile: null, isAdmin: false })
  },

  fetchProfile: async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error || !data) return

    set({
      profile: data as Profile,
      isAdmin: data.role === 'admin',
    })
  },

  initialize: async () => {
    set({ isLoading: true })
    const { data: { session } } = await supabase.auth.getSession()

    if (session?.user) {
      set({ user: { id: session.user.id, email: session.user.email } })
      await get().fetchProfile(session.user.id)
    }

    set({ isLoading: false })

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        set({ user: null, profile: null, isAdmin: false })
      } else if (session?.user) {
        set({ user: { id: session.user.id, email: session.user.email } })
        await get().fetchProfile(session.user.id)
      }
    })
  },
}))

export const useAuth = () => useAuthStore()
