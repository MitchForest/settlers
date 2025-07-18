'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

import { testConnection, healthCheck } from '@/lib/api'
import { toast } from 'sonner'

import { CreateGameDialog } from '@/components/lobby/CreateGameDialog'
import { JoinGameDialog } from '@/components/lobby/JoinGameDialog'
import { ObserveGameDialog } from '@/components/lobby/ObserveGameDialog'
import { MagicLinkDialog } from '@/components/auth/MagicLinkDialog'
import { ProfileSetupDialog } from '@/components/auth/ProfileSetupDialog'
import { UserAvatarMenu } from '@/components/auth/UserAvatarMenu'
import { useRouter } from 'next/navigation'
import { useGameStore } from '@/stores/gameStore'
import { useAuth } from '@/lib/auth-context'
import { ds, componentStyles } from '@/lib/design-system'
import { HoneycombBackground } from '@/components/ui/honeycomb-background'
import { ConnectionStatus } from '@/components/ui/connection-status'

export default function Home() {
  const [apiStatus, setApiStatus] = useState<'testing' | 'connected' | 'failed'>('testing')
  const [dbStatus, setDbStatus] = useState<'unknown' | 'connected' | 'failed'>('unknown')
  const [showCreateGame, setShowCreateGame] = useState(false)
  const [showJoinGame, setShowJoinGame] = useState(false)
  const [showObserveGame, setShowObserveGame] = useState(false)
  const [showMagicLink, setShowMagicLink] = useState(false)
  const [pendingAction, setPendingAction] = useState<'create' | 'join' | 'observe' | null>(null)
  
  const router = useRouter()
  const { setLocalPlayerId } = useGameStore()
  const { user, profile, loading: authLoading } = useAuth()

  useEffect(() => {
    checkSystemStatus()
  }, [])

  const checkSystemStatus = async () => {
    try {
      // Test API connection
      await testConnection()
      setApiStatus('connected')
      
      // Test health endpoint
      const health = await healthCheck()
      setDbStatus(health.database ? 'connected' : 'failed')
      
      toast.success('System status checked')
    } catch {
      setApiStatus('failed')
      toast.error('Failed to connect to backend')
    }
  }

  const handleGameCreated = async (gameCode: string, gameId: string, hostPlayerId?: string, lobbyUrl?: string) => {
    console.log('Game created successfully:', { gameCode, gameId, hostPlayerId, lobbyUrl })
    
    if (lobbyUrl) {
      // Use the session-based URL provided by the backend
      router.push(lobbyUrl)
    } else if (hostPlayerId) {
      // Fallback to old method (shouldn't happen with new backend)
      console.warn('No lobbyUrl provided, falling back to legacy method')
      
      // Set the player ID in the store for legacy compatibility
      setLocalPlayerId(hostPlayerId)
      
      // Navigate to lobby (will need session validation)
      router.push(`/lobby/${gameId}`)
    } else {
      console.error('No hostPlayerId or lobbyUrl provided')
      toast.error('Failed to join game - missing session data')
    }
  }

  const isSystemConnected = apiStatus === 'connected' && dbStatus === 'connected'
  const needsProfile = user && !profile && !authLoading // Only show profile setup if not loading
  const isAuthenticated = user && profile

  // Handle authentication interception
  const handleGameAction = (action: 'create' | 'join' | 'observe') => {
    if (!isAuthenticated) {
      setPendingAction(action)
      setShowMagicLink(true)
      return
    }
    
    // User is authenticated, proceed with action
    switch (action) {
      case 'create':
        setShowCreateGame(true)
        break
      case 'join':
        setShowJoinGame(true)
        break
      case 'observe':
        setShowObserveGame(true)
        break
    }
  }

  // Handle completing profile setup
  const handleProfileComplete = () => {
    // After profile is complete, execute pending action
    if (pendingAction) {
      switch (pendingAction) {
        case 'create':
          setShowCreateGame(true)
          break
        case 'join':
          setShowJoinGame(true)
          break
        case 'observe':
          setShowObserveGame(true)
          break
      }
      setPendingAction(null)
    }
  }

  // Handle completing authentication
  const handleAuthComplete = () => {
    // Auth complete, but might need profile setup
    // The useAuth hook will automatically update user/profile state
    setShowMagicLink(false)
  }

  return (
    <HoneycombBackground>
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        {/* Main Content */}
        <div className="text-center space-y-8 max-w-4xl mx-auto">
          {/* Title */}
          <div className="space-y-4">
            <h1 className="text-7xl md:text-8xl font-bold text-white drop-shadow-2xl tracking-tight">
              Settlers
            </h1>
            <div className="max-w-2xl mx-auto space-y-2">
              <p className="text-xl md:text-2xl text-white/90 font-medium">
              A 3–4 player strategy game to collect, build, and dominate.
              </p>
              <p className="text-sm text-white/60 italic">
                For educational purposes only.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid md:grid-cols-3 gap-6 max-w-2xl mx-auto">
            <Button
              size="lg"
              onClick={() => handleGameAction('create')}
              disabled={!isSystemConnected}
              className={ds(
                componentStyles.buttonPrimary,
                'w-full h-16 text-lg font-semibold rounded-xl hover:scale-105 transition-all duration-200'
              )}
            >
              Create Game
            </Button>
            
            <Button
              size="lg"
              variant="outline"
              onClick={() => handleGameAction('join')}
              disabled={!isSystemConnected}
              className={ds(
                componentStyles.buttonSecondary,
                'w-full h-16 text-lg font-semibold rounded-xl hover:scale-105 transition-all duration-200'
              )}
            >
              Join Game
            </Button>
            
            <Button
              size="lg"
              variant="outline"
              onClick={() => handleGameAction('observe')}
              disabled={!isSystemConnected}
              className={ds(
                componentStyles.buttonSecondary,
                'w-full h-16 text-lg font-semibold rounded-xl hover:scale-105 transition-all duration-200'
              )}
            >
              Observe Game
            </Button>
          </div>

          {/* Auth State Display */}
          {!isSystemConnected && (
            <div className="bg-red-900/20 backdrop-blur-sm border border-red-500/30 rounded-lg p-4 max-w-md mx-auto">
              <p className="text-red-200 text-sm">
                System offline. Please wait...
              </p>
            </div>
          )}

          {needsProfile && (
            <div className="bg-yellow-900/20 backdrop-blur-sm border border-yellow-500/30 rounded-lg p-4 max-w-md mx-auto">
              <p className="text-yellow-200 text-sm">
                Please complete your profile to continue
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-auto pb-8 text-center">
          <p className="text-white/60 text-sm">
            Created by{' '}
            <a 
              href="https://github.com/mitchellwhite" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-white/80 hover:text-white underline"
            >
              @MitchForest
            </a>
          </p>
        </div>
      </div>

      {/* User Avatar Menu (bottom left) */}
      <UserAvatarMenu />

      {/* Connection Status */}
      <ConnectionStatus 
        status={isSystemConnected ? 'connected' : (apiStatus === 'testing' ? 'connecting' : 'error')} 
      />

      {/* Authentication Dialogs */}
      <MagicLinkDialog
        open={showMagicLink}
        onClose={() => {
          setShowMagicLink(false)
          setPendingAction(null)
        }}
        onSuccess={handleAuthComplete}
        title={pendingAction ? `Sign in to ${pendingAction} game` : "Join the Game!"}
        description="Enter your email to sign in and continue"
      />

      <ProfileSetupDialog
        open={!!needsProfile}
        onComplete={handleProfileComplete}
      />

      <CreateGameDialog
        open={showCreateGame}
        onClose={() => setShowCreateGame(false)}
        onGameCreated={handleGameCreated}
      />

      <JoinGameDialog
        open={showJoinGame}
        onOpenChange={setShowJoinGame}
      />

      <ObserveGameDialog
        open={showObserveGame}
        onOpenChange={setShowObserveGame}
      />
    </HoneycombBackground>
  )
}
