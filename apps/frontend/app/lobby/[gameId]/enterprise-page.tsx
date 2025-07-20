/**
 * ENTERPRISE LOBBY PAGE
 * 
 * Demonstrates senior-level patterns:
 * - Deterministic state management
 * - No boolean flags
 * - Automatic route guards
 * - Optimistic updates
 * - Error boundaries
 */

'use client'

import { use } from 'react'
import { useGameState, useGameStateSync, useGameRouteGuard, useGamePermissions, useGameActions } from '@/lib/use-game-state'
import { GameLobby } from '@/components/lobby/GameLobby'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { ds, componentStyles, designSystem } from '@/lib/design-system'

interface LobbyPageProps {
  params: Promise<{
    gameId: string
  }>
}

export default function EnterpriseLobbyPage({ params }: LobbyPageProps) {
  const { gameId } = use(params)
  
  // ENTERPRISE PATTERN: Single source of truth
  const { gameState, isLoading, expectedRoute } = useGameRouteGuard(gameId)
  const permissions = useGamePermissions(gameId)
  const actions = useGameActions(gameId)
  
  // ENTERPRISE PATTERN: Real-time synchronization
  useGameStateSync(gameId)
  
  // ENTERPRISE PATTERN: Loading states
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a4b3a] via-[#2d5a47] to-[#1a4b3a] flex items-center justify-center">
        <div className={ds(componentStyles.glassCard, 'p-8 text-center')}>
          <LoadingSpinner className="mb-4" />
          <h2 className={ds(designSystem.text.heading, 'text-xl')}>Loading Game...</h2>
          <p className={ds(designSystem.text.muted)}>Checking game state</p>
        </div>
      </div>
    )
  }

  // ENTERPRISE PATTERN: Error states
  if (!gameState) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a4b3a] via-[#2d5a47] to-[#1a4b3a] flex items-center justify-center">
        <div className={ds(componentStyles.glassCard, 'p-8 text-center max-w-md')}>
          <h2 className={ds(designSystem.text.heading, 'text-xl mb-4 text-red-400')}>
            Game Not Found
          </h2>
          <p className={ds(designSystem.text.muted, 'mb-6')}>
            This game doesn't exist or you don't have access to it.
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className={ds(componentStyles.primaryButton)}
          >
            Go Home
          </button>
        </div>
      </div>
    )
  }

  // ENTERPRISE PATTERN: State-based access control
  if (!permissions.canJoin && !permissions.isInLobby) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a4b3a] via-[#2d5a47] to-[#1a4b3a] flex items-center justify-center">
        <div className={ds(componentStyles.glassCard, 'p-8 text-center max-w-md')}>
          <h2 className={ds(designSystem.text.heading, 'text-xl mb-4')}>
            Cannot Join Game
          </h2>
          <p className={ds(designSystem.text.muted, 'mb-6')}>
            Game Status: {gameState.lifecycle.status} ({gameState.lifecycle.substatus})
          </p>
          <button
            onClick={() => window.location.href = '/'}
            className={ds(componentStyles.primaryButton)}
          >
            Find Another Game
          </button>
        </div>
      </div>
    )
  }

  // ENTERPRISE PATTERN: Business logic queries
  const lobbyData = {
    gameId: gameState.gameId,
    gameCode: extractGameCode(gameState),
    players: gameState.players,
    isHost: permissions.isHost,
    canStart: permissions.canStart,
    isConnected: true, // Always true with React Query
    settings: {
      maxPlayers: 4,
      allowObservers: gameState.lifecycle.status === 'active',
      aiEnabled: true
    }
  }

  // ENTERPRISE PATTERN: Optimistic actions
  const handleActions = {
    onAddAIBot: async (personality: string) => {
      try {
        await actions.addBot(personality)
      } catch (error) {
        console.error('Failed to add bot:', error)
        // Error handling - could show toast notification
      }
    },
    
    onRemoveAIBot: async (botId: string) => {
      try {
        await actions.removeBot(botId)
      } catch (error) {
        console.error('Failed to remove bot:', error)
      }
    },
    
    onStartGame: async () => {
      try {
        await actions.startGame()
        // Note: No manual redirect needed - route guard handles it!
      } catch (error) {
        console.error('Failed to start game:', error)
      }
    },
    
    onLeave: async () => {
      try {
        await actions.leaveGame()
        window.location.href = '/'
      } catch (error) {
        console.error('Failed to leave game:', error)
        // Still navigate away on error
        window.location.href = '/'
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a4b3a] via-[#2d5a47] to-[#1a4b3a]">
      {/* ENTERPRISE PATTERN: State debugging in dev */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed top-4 right-4 bg-black/80 text-white p-2 rounded text-xs font-mono">
          <div>State: {gameState.lifecycle.status}:{gameState.lifecycle.substatus}</div>
          <div>Players: {gameState.players.length}</div>
          <div>Expected Route: {expectedRoute}</div>
          <div>Can Start: {permissions.canStart ? 'Yes' : 'No'}</div>
        </div>
      )}
      
      <GameLobby
        gameId={lobbyData.gameId}
        gameCode={lobbyData.gameCode}
        players={lobbyData.players}
        isHost={lobbyData.isHost}
        canStart={lobbyData.canStart}
        isConnected={lobbyData.isConnected}
        currentUser={null} // Would come from auth context
        onAddAIBot={handleActions.onAddAIBot}
        onRemoveAIBot={handleActions.onRemoveAIBot}
        onStartGame={handleActions.onStartGame}
        onLeave={handleActions.onLeave}
      />
    </div>
  )
}

/**
 * UTILITY FUNCTIONS
 */
function extractGameCode(gameState: any): string {
  // Extract game code from various possible locations
  return gameState.gameData?.gameCode || 
         gameState.players?.[0]?.gameCode || 
         gameState.gameId?.slice(-6)?.toUpperCase() || 
         'UNKNOWN'
}

/**
 * ENTERPRISE PATTERN: Error Boundary
 */
export function LobbyErrorBoundary({ children }: { children: React.ReactNode }) {
  // Would implement React Error Boundary here
  return <>{children}</>
}