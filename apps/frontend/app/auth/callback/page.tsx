'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Loader2 } from 'lucide-react'

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')

  useEffect(() => {
    const handleAuthCallback = async () => {
      // Set a timeout to prevent infinite hanging
      const timeoutId = setTimeout(() => {
        console.warn('Auth callback timed out after 10 seconds')
        setStatus('error')
        setTimeout(() => router.push('/?auth=timeout'), 3000)
      }, 10000)
      try {
        console.log('Starting auth callback process...')
        console.log('Current URL:', window.location.href)
        
        // Check for PKCE flow first (code in query params)
        const urlParams = new URLSearchParams(window.location.search)
        const authCode = urlParams.get('code')
        const error = urlParams.get('error')
        const errorDescription = urlParams.get('error_description')
        
        console.log('URL params - code:', !!authCode, 'error:', error)
        
        if (error) {
          console.error('Auth error from URL params:', { error, errorDescription })
          setStatus('error')
          setTimeout(() => router.push('/?auth=error'), 3000)
          return
        }
        
        if (authCode) {
          console.log('PKCE flow detected, waiting for auth state change...')
          
          // For PKCE flow, listen for auth state changes instead of polling
          const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
            console.log('Auth state change in callback:', event, session?.user?.email)
            
            if (event === 'SIGNED_IN' && session) {
              console.log('PKCE authentication successful for user:', session.user.email)
              setStatus('success')
              
              // Clear the code from URL
              window.history.replaceState({}, document.title, window.location.pathname)
              
              const redirectTo = searchParams.get('redirect_to') || '/'
              console.log('Redirecting to:', redirectTo)
              
              // Cleanup listener
              authListener.subscription.unsubscribe()
              
              setTimeout(() => router.push(redirectTo), 1500)
            } else if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
              console.error('Authentication failed or user signed out')
              authListener.subscription.unsubscribe()
              setStatus('error')
              setTimeout(() => router.push('/?auth=error'), 3000)
            }
          })
          
          // Also check if there's already a session (race condition)
          const { data, error: sessionError } = await supabase.auth.getSession()
          if (!sessionError && data.session) {
            console.log('Session already exists:', data.session.user.email)
            authListener.subscription.unsubscribe()
            setStatus('success')
            
            window.history.replaceState({}, document.title, window.location.pathname)
            const redirectTo = searchParams.get('redirect_to') || '/'
            setTimeout(() => router.push(redirectTo), 1500)
          }
          
          return
        }
        
        // Fallback: Check for legacy hash-based flow
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const authError = hashParams.get('error')
        const errorCode = hashParams.get('error_code')
        const hashErrorDescription = hashParams.get('error_description')
        
        if (authError) {
          console.error('Auth error from hash:', { authError, errorCode, hashErrorDescription })
          
          if (errorCode === 'otp_expired') {
            setStatus('error')
            setTimeout(() => router.push('/?auth=expired'), 3000)
            return
          }
          
          setStatus('error')
          setTimeout(() => router.push('/?auth=error'), 3000)
          return
        }
        
        // Get auth tokens from hash (legacy implicit flow)
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        
        console.log('Hash params - access_token:', !!accessToken, 'refresh_token:', !!refreshToken)
        
        if (accessToken && refreshToken) {
          console.log('Setting session with hash tokens...')
          
          // Set the session directly with the tokens
          const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          })
          
          console.log('Set session result:', sessionData, sessionError)
          
          if (sessionError) {
            console.error('Error setting session:', sessionError)
            setStatus('error')
            setTimeout(() => router.push('/?auth=error'), 3000)
            return
          }
          
          if (sessionData.session && sessionData.user) {
            console.log('Session set successfully for user:', sessionData.user.email)
            setStatus('success')
            
            // Clear the hash from URL to clean it up
            window.history.replaceState({}, document.title, window.location.pathname + window.location.search)
            
            const redirectTo = searchParams.get('redirect_to') || '/'
            console.log('Redirecting to:', redirectTo)
            setTimeout(() => router.push(redirectTo), 1500)
          } else {
            console.error('No user in session data')
            setStatus('error')
            setTimeout(() => router.push('/?auth=error'), 3000)
          }
        } else {
          console.log('No hash tokens found, checking existing session...')
          
          // Fallback: check if there's already a valid session
          const { data, error } = await supabase.auth.getSession()
          console.log('Existing session check:', data, error)
          
          if (error || !data.session) {
            console.log('No valid session found')
            setStatus('error')
            setTimeout(() => router.push('/?auth=error'), 3000)
            return
          }
          
          console.log('Found existing session for user:', data.session.user.email)
          setStatus('success')
          const redirectTo = searchParams.get('redirect_to') || '/'
          setTimeout(() => router.push(redirectTo), 1500)
        }

      } catch (error) {
        console.error('Unexpected auth error:', error)
        setStatus('error')
        setTimeout(() => router.push('/?auth=error'), 3000)
      } finally {
        // Clear the timeout
        clearTimeout(timeoutId)
      }
    }

    handleAuthCallback()
  }, [router, searchParams])

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a4b3a] via-[#2d5a47] to-[#1a4b3a] flex items-center justify-center px-4">
      <div className="bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg p-8 text-center max-w-md w-full">
        {status === 'loading' && (
          <>
            <Loader2 className="w-8 h-8 text-white animate-spin mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-white mb-2">Signing you in...</h1>
            <p className="text-white/60">Please wait while we verify your magic link.</p>
          </>
        )}
        
        {status === 'success' && (
          <>
            <div className="w-16 h-16 mx-auto mb-4 bg-green-500/20 rounded-full flex items-center justify-center">
              <span className="text-2xl">✅</span>
            </div>
            <h1 className="text-xl font-semibold text-white mb-2">Welcome to Settlers!</h1>
            <p className="text-white/60">You&apos;re now signed in. Redirecting...</p>
          </>
        )}
        
        {status === 'error' && (
          <>
            <div className="w-16 h-16 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center">
              <span className="text-2xl">⏰</span>
            </div>
            <h1 className="text-xl font-semibold text-white mb-2">Magic Link Expired</h1>
            <p className="text-white/60">
              Your magic link has expired. Please request a new one from the homepage.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

export default function AuthCallback() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-[#1a4b3a] via-[#2d5a47] to-[#1a4b3a] flex items-center justify-center px-4">
        <div className="bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg p-8 text-center max-w-md w-full">
          <Loader2 className="w-8 h-8 text-white animate-spin mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-white mb-2">Loading...</h1>
          <p className="text-white/60">Please wait...</p>
        </div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  )
} 