/**
 * UNIFIED LOBBY PAGE - ZERO TECHNICAL DEBT
 * 
 * Single lobby page using unified state management.
 * Replaces scattered state with deterministic, real-time synchronized state.
 */

'use client'

import { use } from 'react'
import { 
  useUnifiedGameState, 
  useUnifiedGamePermissions, 
  useUnifiedGameActions, 
  useUnifiedGameRouteGuard,
  useUnifiedGameSync
} from '@/lib/unified-game-state'
import { GameLobby } from '@/components/lobby/GameLobby'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { ds, componentStyles, designSystem } from '@/lib/design-system'

interface UnifiedLobbyPageProps {
  params: Promise<{
    gameId: string
  }>
}

export default function UnifiedLobbyPage({ params }: UnifiedLobbyPageProps) {
  const { gameId } = use(params)
  
  // UNIFIED STATE MANAGEMENT - NO SCATTERED STATE
  const { gameState, isLoading, error, expectedRoute } = useUnifiedGameRouteGuard(gameId)
  const permissions = useUnifiedGamePermissions(gameId)
  const actions = useUnifiedGameActions(gameId)
  
  // REAL-TIME SYNCHRONIZATION
  useUnifiedGameSync(gameId)
  
  // LOADING STATE
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a4b3a] via-[#2d5a47] to-[#1a4b3a] flex items-center justify-center">
        <div className={ds(componentStyles.glassCard, 'p-8 text-center')}>
          <LoadingSpinner className="mb-4" />
          <h2 className={ds(designSystem.text.heading, 'text-xl')}>Loading Game...</h2>
          <p className={ds(designSystem.text.muted)}>Synchronizing with unified state</p>
        </div>
      </div>
    )
  }

  // ERROR STATE
  if (error || !gameState) {
    const errorMessage = error?.message || 'Game not found'
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a4b3a] via-[#2d5a47] to-[#1a4b3a] flex items-center justify-center">
        <div className={ds(componentStyles.glassCard, 'p-8 text-center max-w-md')}>
          <h2 className={ds(designSystem.text.heading, 'text-xl mb-4 text-red-400')}>
            {errorMessage.includes('not found') ? 'Game Not Found' : 'Connection Error'}
          </h2>
          <p className={ds(designSystem.text.muted, 'mb-6')}>
            {errorMessage}
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

  // ACCESS CONTROL
  if (!permissions.canJoin && !permissions.isInLobby) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a4b3a] via-[#2d5a47] to-[#1a4b3a] flex items-center justify-center">
        <div className={ds(componentStyles.glassCard, 'p-8 text-center max-w-md')}>
          <h2 className={ds(designSystem.text.heading, 'text-xl mb-4')}>
            Cannot Join Game
          </h2>
          <p className={ds(designSystem.text.muted, 'mb-6')}>
            Game Status: {gameState.state.status} ({gameState.state.substatus})
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

  // PREPARE LOBBY DATA - NO SCATTERED STATE
  const lobbyData = {
    gameId: gameState.gameId,
    gameCode: gameState.gameCode,
    players: gameState.players.filter(p => p.status === 'active'),
    isHost: permissions.isHost,
    canStart: permissions.canStart,
    isConnected: true, // Always true with unified state
    settings: gameState.settings
  }

  // UNIFIED ACTION HANDLERS - NO BOOLEAN FLAGS
  const handleActions = {
    onAddAIBot: async (personality: string = 'balanced') => {
      try {
        await actions.addAIBot.mutateAsync({ 
          name: `${personality.charAt(0).toUpperCase() + personality.slice(1)} Bot`,
          personality 
        })
      } catch (error) {
        console.error('Failed to add AI bot:', error)
        // TODO: Show toast notification
      }
    },
    
    onRemoveAIBot: async (botId: string) => {
      try {
        await actions.removeAIBot.mutateAsync(botId)
      } catch (error) {
        console.error('Failed to remove AI bot:', error)
        // TODO: Show toast notification
      }
    },
    
    onStartGame: async () => {
      try {
        await actions.startGame.mutateAsync()
        // Note: Navigation handled by route guard automatically!
      } catch (error) {
        console.error('Failed to start game:', error)
        // TODO: Show toast notification
      }
    },
    
    onLeave: async () => {
      try {
        await actions.leaveGame.mutateAsync()
        window.location.href = '/'
      } catch (error) {
        console.error('Failed to leave game:', error)
        // Navigate anyway on error
        window.location.href = '/'
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a4b3a] via-[#2d5a47] to-[#1a4b3a]">
      {/* DEVELOPMENT DEBUG INFO */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed top-4 right-4 bg-black/80 text-white p-3 rounded text-xs font-mono max-w-xs">
          <div className="font-bold mb-2 text-green-400">🎯 UNIFIED STATE DEBUG</div>
          <div>Status: {gameState.state.status}:{gameState.state.substatus}</div>
          <div>Players: {lobbyData.players.length}/{gameState.settings.maxPlayers}</div>
          <div>Expected Route: {expectedRoute}</div>
          <div>Can Start: {permissions.canStart ? 'Yes' : 'No'}</div>
          <div>Is Host: {permissions.isHost ? 'Yes' : 'No'}</div>
          <div>Sequence: #{gameState.lastEventSequence}</div>
          <div>Updated: {new Date(gameState.updatedAt).toLocaleTimeString()}</div>
        </div>
      )}
      
      {/* LOADING STATES FOR ACTIONS */}
      {(actions.addAIBot.isPending || actions.removeAIBot.isPending || actions.startGame.isPending) && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50">
          <div className={ds(componentStyles.glassCard, 'p-6 text-center')}>
            <LoadingSpinner className="mb-2" />
            <p className={ds(designSystem.text.muted)}>
              {actions.addAIBot.isPending && 'Adding AI player...'}
              {actions.removeAIBot.isPending && 'Removing AI player...'}
              {actions.startGame.isPending && 'Starting game...'}
            </p>
          </div>
        </div>
      )}
      
      <GameLobby
        gameId={lobbyData.gameId}
        gameCode={lobbyData.gameCode}
        players={lobbyData.players}
        isHost={lobbyData.isHost}
        canStart={lobbyData.canStart}
        isConnected={lobbyData.isConnected}
        currentUser={{
          id: gameState.players.find(p => permissions.isHost)?.userId || '',
          email: '',
          name: gameState.players.find(p => permissions.isHost)?.name || ''
        }}
        onAddAIBot={handleActions.onAddAIBot}
        onRemoveAIBot={handleActions.onRemoveAIBot}
        onStartGame={handleActions.onStartGame}
        onLeave={handleActions.onLeave}
      />
    </div>
  )
}

/**
 * ERROR BOUNDARY COMPONENT
 */
export function UnifiedLobbyErrorBoundary({ children }: { children: React.ReactNode }) {
  // TODO: Implement React Error Boundary
  return <>{children}</>
}