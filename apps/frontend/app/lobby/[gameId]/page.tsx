'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useGameStore } from '@/stores/gameStore'
import { GameLobby } from '@/components/lobby/GameLobby'
import { Button } from '@/components/ui/button'
import { use } from 'react'
import { componentStyles, ds } from '@/lib/design-system'

interface PageParams {
  gameId: string
}

export default function LobbyPage({ params }: { params: Promise<PageParams> }) {
  const { gameId } = use(params)
  const router = useRouter()
  
  const { 
    lobbyPlayers, 
    gameCode, 
    isHost, 
    localPlayerId,
    connectionStatus,
    connectToLobby, 
    startGame,
    disconnect,
    addAIBot,
    removeAIBot,
    setLocalPlayerId
  } = useGameStore()

  const [isStartingGame, setIsStartingGame] = useState(false)

  useEffect(() => {
    // Add a small delay to allow store to initialize
    const timer = setTimeout(() => {
      // Check both store and localStorage for player ID
      const storedPlayerId = localStorage.getItem(`playerId_${gameId}`)
      const effectivePlayerId = localPlayerId || storedPlayerId
      
      if (!effectivePlayerId) {
        console.warn('No localPlayerId found in store or localStorage, redirecting to home')
        router.push('/')
        return
      }
      
      // If we got player ID from localStorage but not store, update the store
      if (!localPlayerId && storedPlayerId) {
        console.log('Restoring player ID from localStorage:', storedPlayerId)
        setLocalPlayerId(storedPlayerId)
      }
      
      // Only connect if not already connecting or connected
      if (connectionStatus === 'disconnected') {
        connectToLobby(gameId, effectivePlayerId)
      }
    }, 100)
    
    // Listen for game navigation events from the store
    const handleNavigateToGame = (event: CustomEvent) => {
      const { gameId: targetGameId } = event.detail
      router.push(`/game/${targetGameId}`)
    }
    
    window.addEventListener('navigateToGame', handleNavigateToGame as EventListener)
    
    return () => {
      clearTimeout(timer)
      window.removeEventListener('navigateToGame', handleNavigateToGame as EventListener)
      if (localPlayerId) {
        disconnect()
      }
    }
  }, [gameId, localPlayerId, connectToLobby, disconnect, router])

  const handleStartGame = async () => {
    setIsStartingGame(true)
    try {
      await startGame(gameId)
      // WebSocket will trigger redirect to game
    } catch (error) {
      console.error('Failed to start game:', error)
      setIsStartingGame(false)
    }
  }

  const handleLeaveLobby = () => {
    disconnect()
    router.push('/')
  }

  const handleAddAIBot = async (difficulty: 'easy' | 'medium' | 'hard', personality: 'aggressive' | 'balanced' | 'defensive' | 'economic') => {
    try {
      await addAIBot(gameId, difficulty, personality)
    } catch (error) {
      console.error('Failed to add AI bot:', error)
      // Could add toast notification here
    }
  }

  const handleRemoveAIBot = async (botPlayerId: string) => {
    try {
      await removeAIBot(gameId, botPlayerId)
    } catch (error) {
      console.error('Failed to remove AI bot:', error)
      // Could add toast notification here
    }
  }

  if (connectionStatus === 'connecting') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a4b3a] via-[#2d5a47] to-[#1a4b3a] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-white text-xl">Connecting to lobby...</div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
        </div>
      </div>
    )
  }

  if (connectionStatus === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a4b3a] via-[#2d5a47] to-[#1a4b3a] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-white text-xl">Failed to connect to lobby</div>
          <Button 
            onClick={() => connectToLobby(gameId, localPlayerId!)}
            className={ds(
              componentStyles.buttonPrimary,
              'bg-blue-500/20 border-blue-400/30 hover:bg-blue-500/30'
            )}
          >
            Retry Connection
          </Button>
          <Button 
            onClick={() => router.push('/')}
            variant="outline"
            className={componentStyles.buttonSecondary}
          >
            Back to Home
          </Button>
        </div>
      </div>
    )
  }

  if (!gameCode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a4b3a] via-[#2d5a47] to-[#1a4b3a] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-white text-xl">Loading lobby...</div>
          <div className="animate-pulse text-white/60">Please wait while we set up your game</div>
        </div>
      </div>
    )
  }

  if (isStartingGame) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a4b3a] via-[#2d5a47] to-[#1a4b3a] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-white text-xl">Starting game...</div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
          <div className="text-white/60">Get ready to play!</div>
        </div>
      </div>
    )
  }

  return (
    <GameLobby
      gameCode={gameCode}
      players={lobbyPlayers}
      isHost={isHost}
      canStart={lobbyPlayers.length >= 3}
      onStartGame={handleStartGame}
      onLeave={handleLeaveLobby}
      onAddAIBot={handleAddAIBot}
      onRemoveAIBot={handleRemoveAIBot}
    />
  )
} 