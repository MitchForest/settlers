'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase, UserProfile, getUserProfile } from './supabase'

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  isGuest: boolean
  signInWithMagicLink: (email: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  clearGuestSession: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(false) // Changed to false by default
  const [isGuest, setIsGuest] = useState(true) // Start as guest

  const refreshProfile = async () => {
    if (user) {
      console.log('Refreshing profile for user:', user.id)
      try {
        const userProfile = await getUserProfile(user.id)
        console.log('Profile fetched:', userProfile)
        setProfile(userProfile)
      } catch (error) {
        console.error('Failed to refresh profile:', error)
        // Don't throw error, just log it
      }
    }
  }

  const clearGuestSession = () => {
    setIsGuest(true)
    setUser(null)
    setProfile(null)
  }

  useEffect(() => {
    // Only check for existing session, don't enforce authentication
    const checkInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session?.user) {
          console.log('Found existing session for user:', session.user.id)
          setUser(session.user)
          setIsGuest(false)
          
          // Try to fetch profile, but don't block if it fails
          try {
            const userProfile = await getUserProfile(session.user.id)
            setProfile(userProfile)
          } catch (error) {
            console.warn('Could not fetch user profile, continuing as guest-like:', error)
            // Continue with user but no profile
          }
        } else {
          console.log('No existing session, user is browsing as guest')
          setIsGuest(true)
        }
      } catch (error) {
        console.error('Error checking initial session:', error)
        // Default to guest mode on any error
        setIsGuest(true)
      } finally {
        setLoading(false)
      }
    }

    checkInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event, session?.user?.id)
        
        if (session?.user) {
          setUser(session.user)
          setIsGuest(false)
          
          // Try to fetch/create profile
          try {
            const userProfile = await getUserProfile(session.user.id)
            console.log('Profile fetched in auth change:', userProfile)
            setProfile(userProfile)
          } catch (error) {
            console.warn('Profile fetch failed in auth change:', error)
            // Continue with user but no profile
          }
        } else {
          setUser(null)
          setProfile(null)
          setIsGuest(true)
        }
        
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signInWithMagicLink = async (email: string) => {
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      })
      
      return { error }
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    setLoading(true)
    try {
      await supabase.auth.signOut()
      setUser(null)
      setProfile(null)
      setIsGuest(true)
    } finally {
      setLoading(false)
    }
  }

  const value = {
    user,
    profile,
    loading,
    isGuest,
    signInWithMagicLink,
    signOut,
    refreshProfile,
    clearGuestSession
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
} 