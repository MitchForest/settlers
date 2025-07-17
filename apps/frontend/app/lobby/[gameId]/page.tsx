'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useGameStore } from '@/stores/gameStore'
import { GameLobby } from '@/components/lobby/GameLobby'
import { Button } from '@/components/ui/button'
import { use } from 'react'

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
    removeAIBot
  } = useGameStore()

  const [isStartingGame, setIsStartingGame] = useState(false)

  useEffect(() => {
    if (!localPlayerId) {
      // No player ID, redirect to home
      router.push('/')
      return
    }
    
    // Connect to lobby
    connectToLobby(gameId, localPlayerId)
    
    return () => {
      disconnect()
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-white text-xl">Connecting to lobby...</div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
        </div>
      </div>
    )
  }

  if (connectionStatus === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-white text-xl">Failed to connect to lobby</div>
          <Button 
            onClick={() => connectToLobby(gameId, localPlayerId!)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Retry Connection
          </Button>
          <Button 
            onClick={() => router.push('/')}
            variant="outline"
            className="border-white/20 text-white hover:bg-white/10"
          >
            Back to Home
          </Button>
        </div>
      </div>
    )
  }

  if (!gameCode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-white text-xl">Loading lobby...</div>
          <div className="animate-pulse text-white/60">Please wait while we set up your game</div>
        </div>
      </div>
    )
  }

  if (isStartingGame) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
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