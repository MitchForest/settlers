// UNIFIED LOBBY PAGE - MODERN APPROACH
// ✅ Uses unified game state system with automatic WebSocket management
//
'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useGameAuth } from '@/lib/unified-auth'
import { useUnifiedGameState, useUnifiedGameActions } from '@/lib/unified-game-state'
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
  
  // Unified game state (includes automatic WebSocket connection)
  const { gameState, isLoading, error } = useUnifiedGameState(gameId)
  
  // Game actions (handled through unified system)
  const { startGame } = useUnifiedGameActions(gameId)
  
  // Extract lobby data from unified state
  const gameCode = gameState?.gameCode || ''
  const players = gameState?.players || []
  const canStart = gameState?.state.status === 'lobby' && players.length >= 2
  const isHost = gameState?.players.find((p: any) => p.userId === auth.user?.id)?.isHost || false

  // Show loading while auth is initializing or game state is loading
  if (auth.loading || isLoading) {
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

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a4b3a] via-[#2d5a47] to-[#1a4b3a] flex items-center justify-center">
        <div className={ds(componentStyles.glassCard, 'p-8 text-center max-w-md')}>
          <h2 className={ds(designSystem.text.heading, 'text-xl mb-4 text-red-400')}>
            Connection Error
          </h2>
          <p className={ds(designSystem.text.muted, 'mb-6')}>
            {error || 'Failed to connect to game'}
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

  // Show lobby interface
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a4b3a] via-[#2d5a47] to-[#1a4b3a]">
      <GameLobby
        gameId={gameId}
        gameCode={gameCode}
        players={players}
        isHost={isHost}
        canStart={canStart}
        isConnected={true} // WebSocket connection is automatic with unified state
        currentUser={auth.user}
        onAddAIBot={(personality, name) => {
          // TODO: Implement through unified actions
          console.log('Add AI bot:', personality, name)
        }}
        onRemoveAIBot={(botPlayerId) => {
          // TODO: Implement through unified actions
          console.log('Remove AI bot:', botPlayerId)
        }}
        onStartGame={() => {
          startGame({ type: 'startGame' })
        }}
        onLeave={() => {
          // TODO: Implement through unified actions
          console.log('Leave game')
          router.push('/')
        }}
      />
    </div>
  )
}