'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

import { testConnection, healthCheck } from '@/lib/api'
import { toast } from 'sonner'

import { CreateGameDialog } from '@/components/lobby/CreateGameDialog'
import { JoinGameDialog } from '@/components/lobby/JoinGameDialog'
import { ObserveGameDialog } from '@/components/lobby/ObserveGameDialog'
import { MagicLinkDialog } from '@/components/auth/MagicLinkDialog'
// Removed unused import: ProfileSetupDialog
import { UserAvatarMenu } from '@/components/auth/UserAvatarMenu'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/stores/appStore'
import { useAuth } from '@/lib/auth-context'
// Removed unused import: ds, componentStyles
import { HoneycombBackground } from '@/components/ui/honeycomb-background'
import { ConnectionStatus } from '@/components/ui/connection-status'

export default function Home() {
  const [apiStatus, setApiStatus] = useState<'testing' | 'connected' | 'failed'>('testing')
  const [_dbStatus, setDbStatus] = useState<'unknown' | 'connected' | 'failed'>('unknown')
  const [pendingAction, setPendingAction] = useState<'create' | 'join' | 'observe' | null>(null)
  
  const router = useRouter()
  const { 
    showCreateGame,
    setShowCreateGame,
    showJoinGame,
    setShowJoinGame,
    showObserveGame,
    setShowObserveGame,
    showMagicLink,
    setShowMagicLink
  } = useAppStore()
  const { user, profile, loading: authLoading, isGuest } = useAuth()

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
      setDbStatus(health.status === 'healthy' ? 'connected' : 'failed')
      
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
      
      // Note: Player ID will be managed by lobby/game components
      
      // Navigate to lobby (will need session validation)
      router.push(`/lobby/${gameId}`)
    } else {
      console.error('No hostPlayerId or lobbyUrl provided')
      toast.error('Failed to join game - missing session data')
    }
  }

  // Temporarily override for demo - always show as connected if API works
  const isSystemConnected = apiStatus === 'connected' // && dbStatus === 'connected'
  const isAuthenticated = user && !isGuest

  // Handle authentication interception
  const handleGameAction = (action: 'create' | 'join' | 'observe') => {
    // Check if user needs to authenticate
    if (isGuest) {
      setPendingAction(action)
      setShowMagicLink(true)
      return
    }
    
    // Check if authenticated user needs profile setup
    if (isAuthenticated && !profile && !authLoading) {
      toast.error('Please complete your profile setup first')
      // Could show profile setup dialog here
      return
    }
    
    // User is ready, proceed with action
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

  // Handle successful authentication from magic link dialog
  const handleAuthSuccess = () => {
    setShowMagicLink(false)
    
    // If there was a pending action, execute it
    if (pendingAction) {
      const action = pendingAction
      setPendingAction(null)
      
      // Wait a bit for profile to load, then proceed
      setTimeout(() => {
        handleGameAction(action)
      }, 1000)
    }
  }

    return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <HoneycombBackground>
        {/* Header */}
        <header className="relative z-10 flex justify-between items-center p-6">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-foreground">Builders</h1>
          <ConnectionStatus 
            status={isSystemConnected ? 'connected' : (apiStatus === 'testing' ? 'connecting' : 'error')}
            className="hidden sm:flex"
          />
        </div>
        
        <div className="flex items-center gap-4">
          {!isGuest && user ? (
            <UserAvatarMenu />
          ) : (
            <Button
              variant="outline"
              onClick={() => setShowMagicLink(true)}
              className="flex items-center gap-2"
            >
              ✨ Sign In
            </Button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
        <div className="max-w-2xl mx-auto space-y-8">
          {/* Hero Section */}
          <div className="space-y-4">
            <h2 className="text-4xl sm:text-6xl font-bold text-foreground tracking-tight">
              Master the Art of
              <span className="block text-primary">Strategic Trade</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-xl mx-auto">
              Build settlements, trade resources, and outmaneuver your opponents in this 
              modern take on the classic strategy game.
            </p>
          </div>

          {/* Status Display */}
          {!isSystemConnected && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <p className="text-destructive text-sm">
                System not ready. Check your backend connection.
              </p>
            </div>
          )}

          {/* Game Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg mx-auto">
            <Button
              onClick={() => handleGameAction('create')}
              disabled={!isSystemConnected}
              size="lg"
              className="h-16 flex flex-col gap-1"
            >
              <span className="text-lg">🎯</span>
              <span>Create Game</span>
            </Button>
            
            <Button
              variant="outline"
              onClick={() => handleGameAction('join')}
              disabled={!isSystemConnected}
              size="lg"
              className="h-16 flex flex-col gap-1"
            >
              <span className="text-lg">🤝</span>
              <span>Join Game</span>
            </Button>
            
            <Button
              variant="outline"
              onClick={() => handleGameAction('observe')}
              disabled={!isSystemConnected}
              size="lg"
              className="h-16 flex flex-col gap-1"
            >
              <span className="text-lg">👁️</span>
              <span>Observe Game</span>
            </Button>
          </div>

          {/* Guest Notice */}
          {isGuest && (
            <div className="bg-info/10 border border-info/20 rounded-lg p-4 max-w-md mx-auto">
              <p className="text-info text-sm">
                💡 You&apos;re browsing as a guest. Sign in to save your game history and create a profile.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Dialogs */}
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
      
      <MagicLinkDialog
        open={showMagicLink}
        onClose={() => {
          setShowMagicLink(false)
          setPendingAction(null)
        }}
        onSuccess={handleAuthSuccess}
      />
      </HoneycombBackground>
    </div>
  )
}
