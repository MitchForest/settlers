'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Loader2 } from 'lucide-react'

export default function AuthCallback() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Get the hash from the URL which contains the auth tokens
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')
        
        if (accessToken && refreshToken) {
          // Set the session using the tokens from the URL
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          })
          
          if (error) {
            console.error('Auth callback error:', error)
            setStatus('error')
            setTimeout(() => router.push('/?auth=error'), 3000)
            return
          }
          
          if (data.user) {
            setStatus('success')
            // Check if there's a redirect URL in the search params
            const redirectTo = searchParams.get('redirect_to') || '/'
            // Redirect after a brief success message
            setTimeout(() => router.push(redirectTo), 1500)
          } else {
            setStatus('error')
            setTimeout(() => router.push('/?auth=error'), 3000)
          }
        } else {
          // Fallback to getSession if no hash params
          const { data: { session }, error } = await supabase.auth.getSession()
          
          if (error || !session) {
            console.error('Auth callback error:', error)
            setStatus('error')
            setTimeout(() => router.push('/?auth=error'), 3000)
            return
          }
          
          setStatus('success')
          const redirectTo = searchParams.get('redirect_to') || '/'
          setTimeout(() => router.push(redirectTo), 1500)
        }

      } catch (error) {
        console.error('Unexpected auth error:', error)
        setStatus('error')
        setTimeout(() => router.push('/?auth=error'), 3000)
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
            <p className="text-white/60">You're now signed in. Redirecting...</p>
          </>
        )}
        
        {status === 'error' && (
          <>
            <div className="w-16 h-16 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center">
              <span className="text-2xl">❌</span>
            </div>
            <h1 className="text-xl font-semibold text-white mb-2">Authentication Failed</h1>
            <p className="text-white/60">
              There was an issue with your magic link. Redirecting to homepage...
            </p>
          </>
        )}
      </div>
    </div>
  )
} 