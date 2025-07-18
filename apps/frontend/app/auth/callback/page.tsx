'use client'

import { useEffect, useState, Suspense, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Loader2 } from 'lucide-react'
import { ds, componentStyles, designSystem } from '@/lib/design-system'

function AuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('Signing you in...')
  const handledRef = useRef(false)

  useEffect(() => {
    const handleAuthCallback = async () => {
      // Prevent double execution
      if (handledRef.current) return
      handledRef.current = true

      try {
        console.log('Auth callback started')
        
        // Check for URL errors first
        const urlParams = new URLSearchParams(window.location.search)
        const error = urlParams.get('error')
        const errorDescription = urlParams.get('error_description')
        
        if (error) {
          console.error('Auth error:', error, errorDescription)
          setStatus('error')
          setMessage('Authentication failed. Redirecting...')
          setTimeout(() => router.push('/'), 2000)
          return
        }

        // Modern PKCE flow - check for existing session first (most common case)
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        
        if (!sessionError && sessionData.session) {
          console.log('Existing session found:', sessionData.session.user.email)
          setStatus('success')
          setMessage('Welcome back! Redirecting...')
          
          const redirectTo = searchParams.get('redirect_to') || '/'
          // Redirect immediately - no need for delay
          router.push(redirectTo)
          return
        }

        // If no session yet, wait for auth state change (PKCE code exchange happening)
        const authCode = urlParams.get('code')
        if (authCode) {
          console.log('PKCE code found, waiting for auth state change...')
          
          let cleanup: (() => void) | null = null
          let timeoutId: NodeJS.Timeout | null = null

          const handleAuthStateChange = (event: string, session: any) => {
            console.log('Auth state change:', event)
            
            if (event === 'SIGNED_IN' && session) {
              console.log('Authentication successful:', session.user.email)
              setStatus('success')
              setMessage('Welcome! Redirecting...')
              
              // Cleanup and redirect immediately
              if (cleanup) cleanup()
              if (timeoutId) clearTimeout(timeoutId)
              
              const redirectTo = searchParams.get('redirect_to') || '/'
              router.push(redirectTo)
            }
          }

          // Set up auth state listener
          const { data: authListener } = supabase.auth.onAuthStateChange(handleAuthStateChange)
          cleanup = () => authListener.subscription.unsubscribe()

          // Set reasonable timeout (5 seconds)
          timeoutId = setTimeout(() => {
            console.warn('Auth callback timed out')
            setStatus('error')
            setMessage('Authentication timed out. Redirecting...')
            if (cleanup) cleanup()
            setTimeout(() => router.push('/'), 2000)
          }, 5000)

          return
        }

        // Fallback for edge cases
        console.log('No auth code found, redirecting to home')
        setStatus('error')
        setMessage('No authentication data found. Redirecting...')
        setTimeout(() => router.push('/'), 2000)

      } catch (error) {
        console.error('Auth callback error:', error)
        setStatus('error')
        setMessage('Authentication error. Redirecting...')
        setTimeout(() => router.push('/'), 2000)
      }
    }

    handleAuthCallback()
  }, [router, searchParams])

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a4b3a] via-[#2d5a47] to-[#1a4b3a] flex items-center justify-center px-4">
      <div className={ds(
        componentStyles.glassCard,
        'p-8 text-center max-w-md w-full border-white/30'
      )}>
        {status === 'loading' && (
          <>
            <Loader2 className="w-8 h-8 text-white animate-spin mx-auto mb-4" />
            <h1 className={ds(designSystem.text.heading, 'text-xl font-semibold mb-2')}>
              Signing you in...
            </h1>
            <p className={ds(designSystem.text.muted)}>
              {message}
            </p>
          </>
        )}
        
        {status === 'success' && (
          <>
            <div className={ds(
              'w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center',
              'bg-green-500/20 border border-green-400/30'
            )}>
              <span className="text-2xl">✅</span>
            </div>
            <h1 className={ds(designSystem.text.heading, 'text-xl font-semibold mb-2')}>
              Welcome to Settlers!
            </h1>
            <p className={ds(designSystem.text.muted)}>
              {message}
            </p>
          </>
        )}
        
        {status === 'error' && (
          <>
            <div className={ds(
              'w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center',
              'bg-red-500/20 border border-red-400/30'
            )}>
              <span className="text-2xl">❌</span>
            </div>
            <h1 className={ds(designSystem.text.heading, 'text-xl font-semibold mb-2')}>
              Authentication Issue
            </h1>
            <p className={ds(designSystem.text.muted)}>
              {message}
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
        <div className={ds(
          componentStyles.glassCard,
          'p-8 text-center max-w-md w-full border-white/30'
        )}>
          <Loader2 className="w-8 h-8 text-white animate-spin mx-auto mb-4" />
          <h1 className={ds(designSystem.text.heading, 'text-xl font-semibold mb-2')}>
            Loading...
          </h1>
          <p className={ds(designSystem.text.muted)}>
            Please wait...
          </p>
        </div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  )
} 