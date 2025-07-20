'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useGameAuth } from '@/lib/unified-auth'
import { useUnifiedWebSocket } from '@/lib/use-unified-websocket'
import { GameLobby } from '@/components/lobby/GameLobby'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { ds, componentStyles, designSystem } from '@/lib/design-system'
import type { LobbyPlayer } from '@/lib/types/lobby-types'

interface LobbyPageProps {
  params: Promise<{
    gameId: string
  }>
}

export default function UnifiedLobbyPage({ params }: LobbyPageProps) {
  const { gameId } = use(params)
  const router = useRouter()
  const auth = useGameAuth(gameId)
  
  // Lobby state
  const [gameCode, setGameCode] = useState<string>('')
  const [players, setPlayers] = useState<LobbyPlayer[]>([])
  const [canStart, setCanStart] = useState(false)
  const [isHost, setIsHost] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // WebSocket connection with unified auth
  const {
    isConnected,
    connectionStatus,
    error: wsError,
    addAIBot,
    removeAIBot,
    startGame,
    leaveGame
  } = useUnifiedWebSocket({
    gameId,
    onLobbyJoined: (data) => {
      console.log('🎮 Joined lobby:', data)
      setGameCode(data.gameCode)
      setPlayers(data.players || [])
      setCanStart(data.canStart || false)
      setIsHost(data.isHost || false)
      setError(null)
    },
    onLobbyUpdate: (updatedPlayers, updatedCanStart) => {
      console.log('🔄 Lobby update:', updatedPlayers.length, 'players')
      setPlayers(updatedPlayers)
      setCanStart(updatedCanStart)
    },
    onGameStarted: () => {
      console.log('🚀 Game started, redirecting...')
      router.push(`/game/${gameId}`)
    },
    onError: (errorMsg) => {
      console.error('❌ Lobby error:', errorMsg)
      setError(errorMsg)
    }
  })

  // Show loading while auth is initializing
  if (auth.loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a4b3a] via-[#2d5a47] to-[#1a4b3a] flex items-center justify-center">
        <div className={ds(componentStyles.glassCard, 'p-8 text-center')}>
          <LoadingSpinner className="mb-4" />
          <h2 className={ds(designSystem.text.heading, 'text-xl')}>Loading...</h2>
          <p className={ds(designSystem.text.muted)}>Initializing game session</p>
        </div>
      </div>
    )
  }

  // Require authentication
  if (!auth.isAuthenticated()) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a4b3a] via-[#2d5a47] to-[#1a4b3a] flex items-center justify-center">
        <div className={ds(componentStyles.glassCard, 'p-8 text-center max-w-md')}>
          <h2 className={ds(designSystem.text.heading, 'text-xl mb-4')}>Authentication Required</h2>
          <p className={ds(designSystem.text.muted, 'mb-6')}>
            You need to be signed in to join this game.
          </p>
          <button
            onClick={() => router.push('/')}
            className={ds(componentStyles.primaryButton)}
          >
            Go to Home
          </button>
        </div>
      </div>
    )
  }

  // Show connection status
  if (connectionStatus === 'connecting') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a4b3a] via-[#2d5a47] to-[#1a4b3a] flex items-center justify-center">
        <div className={ds(componentStyles.glassCard, 'p-8 text-center')}>
          <LoadingSpinner className="mb-4" />
          <h2 className={ds(designSystem.text.heading, 'text-xl')}>Connecting...</h2>
          <p className={ds(designSystem.text.muted)}>Joining game lobby</p>
        </div>
      </div>
    )
  }

  // Show error state
  if (error || wsError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a4b3a] via-[#2d5a47] to-[#1a4b3a] flex items-center justify-center">
        <div className={ds(componentStyles.glassCard, 'p-8 text-center max-w-md')}>
          <h2 className={ds(designSystem.text.heading, 'text-xl mb-4 text-red-400')}>
            Connection Error
          </h2>
          <p className={ds(designSystem.text.muted, 'mb-6')}>
            {error || wsError || 'Failed to connect to game'}
          </p>
          <button
            onClick={() => router.push('/')}
            className={ds(componentStyles.primaryButton)}
          >
            Go to Home
          </button>
        </div>
      </div>
    )
  }

  // Show lobby interface when connected
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a4b3a] via-[#2d5a47] to-[#1a4b3a]">
      <GameLobby
        gameId={gameId}
        gameCode={gameCode}
        players={players}
        isHost={isHost}
        canStart={canStart}
        isConnected={isConnected}
        currentUser={auth.user}
        onAddAIBot={addAIBot}
        onRemoveAIBot={removeAIBot}
        onStartGame={startGame}
        onLeave={() => {
          leaveGame()
          router.push('/')
        }}
      />
    </div>
  )
}