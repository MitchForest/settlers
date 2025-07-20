'use client'

import { useEffect, useState, Suspense, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
// No more custom session tokens - using Supabase JWT directly
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

        // 🔧 PKCE CODE EXCHANGE - Handle the code parameter
        const authCode = urlParams.get('code')
        if (authCode) {
          console.log('🔐 PKCE code found, exchanging for session...')
          setMessage('Completing sign in...')
          
          // Exchange the code for a session using PKCE
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(authCode)
          
          if (exchangeError) {
            console.error('❌ PKCE exchange error:', exchangeError)
            setStatus('error')
            setMessage('Authentication failed. Redirecting...')
            setTimeout(() => router.push('/'), 2000)
            return
          }
          
          if (data.session?.user) {
            console.log('✅ PKCE exchange successful:', data.session.user.email)
            setStatus('success')
            setMessage('Welcome! Redirecting...')
            
            const redirectTo = searchParams.get('redirect_to')
            
            if (redirectTo) {
              // Parse redirect URL to see if it's a game/lobby URL
              const gameUrlMatch = redirectTo.match(/\/(lobby|game)\/([^?]+)/)
              
              if (gameUrlMatch) {
                const [, pageType, gameId] = gameUrlMatch
                
                // Direct redirect to game/lobby - unified auth will handle everything
                router.push(`/${pageType}/${gameId}`)
                return
              }
            }
            
            // Default redirect
            router.push(redirectTo || '/')
            return
          }
        }

        // Check for existing session (for cases where auth already completed)
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        
        if (!sessionError && sessionData.session?.user) {
          console.log('✅ Existing session found:', sessionData.session.user.email)
          setStatus('success')
          setMessage('Welcome back! Redirecting...')
          
          const redirectTo = searchParams.get('redirect_to')
          router.push(redirectTo || '/')
          return
        }

        // Fallback for edge cases
        console.log('⚠️ No auth code or session found, redirecting to home')
        setStatus('error')
        setMessage('No authentication data found. Redirecting...')
        setTimeout(() => router.push('/'), 2000)

      } catch (error) {
        console.error('❌ Auth callback error:', error)
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
            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className={ds(designSystem.text.heading, 'text-xl font-semibold mb-2')}>
              Success!
            </h1>
            <p className={ds(designSystem.text.muted)}>
              {message}
            </p>
          </>
        )}
        
        {status === 'error' && (
          <>
            <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className={ds(designSystem.text.heading, 'text-xl font-semibold mb-2')}>
              Authentication Error
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
        </div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  )
} 