'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase, UserProfile, getUserProfile } from './supabase'

interface UnifiedAuthState {
  // Core auth state
  user: User | null
  session: Session | null
  profile: UserProfile | null
  loading: boolean
  
  // Game context
  gameId: string | null
  playerId: string | null
  
  // Auth actions
  signInWithMagicLink: (email: string, redirectTo?: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  
  // Game context actions
  setGameContext: (gameId: string, playerId?: string) => void
  clearGameContext: () => void
  
  // Token access
  getAccessToken: () => string | null
  isAuthenticated: () => boolean
}

const UnifiedAuthContext = createContext<UnifiedAuthState | undefined>(undefined)

export function UnifiedAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Game context (for WebSocket connections)
  const [gameId, setGameId] = useState<string | null>(null)
  const [playerId, setPlayerId] = useState<string | null>(null)

  const refreshProfile = useCallback(async () => {
    if (user) {
      console.log('🔄 Refreshing profile for user:', user.id)
      try {
        const userProfile = await getUserProfile(user.id)
        setProfile(userProfile)
        console.log('✅ Profile refreshed:', userProfile?.name || 'No profile')
      } catch (error) {
        console.warn('⚠️ Profile refresh failed:', error)
        // Don't throw - continue without profile
      }
    }
  }, [user])

  const getAccessToken = useCallback((): string | null => {
    return session?.access_token || null
  }, [session])

  const isAuthenticated = useCallback((): boolean => {
    return !!(session?.access_token && user)
  }, [session, user])

  const setGameContext = useCallback((newGameId: string, newPlayerId?: string) => {
    console.log('🎮 Setting game context:', { gameId: newGameId, playerId: newPlayerId })
    setGameId(newGameId)
    setPlayerId(newPlayerId || null)
  }, [])

  const clearGameContext = useCallback(() => {
    console.log('🧹 Clearing game context')
    setGameId(null)
    setPlayerId(null)
  }, [])

  useEffect(() => {
    let mounted = true

    const initializeAuth = async () => {
      try {
        console.log('🔐 Initializing unified auth...')
        
        // Get current session
        const { data: { session: currentSession }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('❌ Auth initialization error:', error)
          return
        }

        if (!mounted) return

        if (currentSession?.user) {
          console.log('✅ Found existing session:', currentSession.user.email)
          setUser(currentSession.user)
          setSession(currentSession)
          
          // Load profile
          try {
            const userProfile = await getUserProfile(currentSession.user.id)
            if (mounted) {
              setProfile(userProfile)
            }
          } catch (profileError) {
            console.warn('⚠️ Profile load failed during init:', profileError)
          }
        } else {
          console.log('ℹ️ No existing session found')
        }
      } catch (error) {
        console.error('❌ Auth initialization failed:', error)
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    initializeAuth()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return

        console.log('🔄 Auth state change:', event)
        
        setSession(newSession)
        
        if (newSession?.user) {
          setUser(newSession.user)
          
          // Load profile for authenticated user
          try {
            const userProfile = await getUserProfile(newSession.user.id)
            if (mounted) {
              setProfile(userProfile)
            }
          } catch (error) {
            console.warn('⚠️ Profile load failed on auth change:', error)
          }
        } else {
          // Clear user state on sign out
          setUser(null)
          setProfile(null)
          clearGameContext()
        }
        
        if (mounted) {
          setLoading(false)
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [clearGameContext])

  const signInWithMagicLink = async (email: string, redirectTo?: string) => {
    setLoading(true)
    try {
      const redirectUrl = redirectTo || `${window.location.origin}/auth/callback`
      
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectUrl
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
      // State will be cleared by onAuthStateChange
    } finally {
      setLoading(false)
    }
  }

  const value: UnifiedAuthState = {
    user,
    session,
    profile,
    loading,
    gameId,
    playerId,
    signInWithMagicLink,
    signOut,
    refreshProfile,
    setGameContext,
    clearGameContext,
    getAccessToken,
    isAuthenticated
  }

  return (
    <UnifiedAuthContext.Provider value={value}>
      {children}
    </UnifiedAuthContext.Provider>
  )
}

export function useUnifiedAuth() {
  const context = useContext(UnifiedAuthContext)
  if (context === undefined) {
    throw new Error('useUnifiedAuth must be used within a UnifiedAuthProvider')
  }
  return context
}

// Helper hook for game pages that need auth + game context
export function useGameAuth(gameId: string) {
  const auth = useUnifiedAuth()
  
  useEffect(() => {
    if (gameId && gameId !== auth.gameId) {
      auth.setGameContext(gameId)
    }
    
    return () => {
      // Clean up game context when component unmounts
      if (auth.gameId === gameId) {
        auth.clearGameContext()
      }
    }
  }, [gameId, auth])
  
  return auth
}