'use client'

import { use, useEffect, useState, useCallback } from 'react'
import { useGameTheme } from '@/components/theme-provider'
import { GameBoard } from '@/components/game/board/GameBoard'
import { PlayerSidebar } from '@/components/game/ui/PlayerSidebar'
import { PlayersPanel } from '@/components/game/ui/PlayersPanel'
import { DiceRoller } from '@/components/game/ui/DiceRoller'
import { GameInterface } from '@/components/game/ui/GameInterface'
import { TurnActionsPanel } from '@/components/game/ui/TurnActionsPanel'

import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { RotateCcw, Palette, LogOut, Info } from 'lucide-react'
import type { GameAction } from '@settlers/game-engine'
import { loadGameEngine } from '@/lib/game-engine-loader'
import { DynamicLoading } from '@/components/ui/dynamic-loading'
import { useGameStore } from '@/stores/gameStore'
import { useTurnManager } from '@/lib/use-turn-manager'
import { useRouter } from 'next/navigation'
import { HoneycombBackground } from '@/components/ui/honeycomb-background'
import { ConnectionStatus } from '@/components/ui/connection-status'
import { ds, componentStyles, designSystem } from '@/lib/design-system'

interface PageParams {
  gameId: string
}

function GamePageContent({ gameId }: { gameId: string }) {
  const router = useRouter()
  
  // Theme loading
  const { theme, loading: themeLoading, loadTheme } = useGameTheme()
  
  // Game state from store (legacy for initial game state)
  const { gameState, localPlayerId, setLocalPlayerId } = useGameStore()
  
  // Turn management integration
  const turnManager = useTurnManager({
    gameId,
    sessionToken: localStorage.getItem(`sessionToken_${gameId}`) || '', 
    playerId: localPlayerId || '',
    enableToasts: true,
    enableNotifications: true
  })
  
  const [gameEngine, setGameEngine] = useState<unknown | null>(null)

  // Load game engine on mount
  useEffect(() => {
    loadGameEngine().then(setGameEngine).catch(console.error)
  }, [])

  // Get player ID from URL params or localStorage
  const getPlayerIdForGame = useCallback(() => {
    // Try URL params first
    const urlParams = new URLSearchParams(window.location.search)
    const urlPlayerId = urlParams.get('playerId')
    if (urlPlayerId) return urlPlayerId

    // Try localStorage for this specific game
    const storedPlayerId = localStorage.getItem(`playerId_${gameId}`)
    if (storedPlayerId) return storedPlayerId

    // No player ID found - redirect to home
    return null
  }, [gameId])

  // Initialize player ID when component mounts
  useEffect(() => {
    if (!localPlayerId) {
      const playerId = getPlayerIdForGame()
      if (!playerId) {
        console.warn('No player ID found for game, redirecting to home')
        router.push('/')
        return
      }
      setLocalPlayerId(playerId)
    }
  }, [localPlayerId, getPlayerIdForGame, router, setLocalPlayerId])

  // Auto-load settlers theme when component mounts
  useEffect(() => {
    if (!theme && !themeLoading) {
      loadTheme('settlers').catch((error: unknown) => {
        console.error('Failed to load settlers theme:', error)
        toast.error('Failed to load game theme')
      })
    }
  }, [theme, themeLoading, loadTheme])

  // Action handlers
  const handleGameAction = async (action: GameAction) => {
    if (!turnManager.isConnected) {
      toast.error('Not connected to game')
      return false
    }

    console.log('Processing action:', action)

    try {
      const success = await turnManager.executeAction(action)
      return success
    } catch (error) {
      console.error('Action failed:', error)
      return false
    }
  }

  // Legacy action handler for components that don't support async
  const handleGameActionLegacy = (action: GameAction) => {
    handleGameAction(action).catch(console.error)
  }

  // Handle loading states
  if (themeLoading) {
    return (
      <HoneycombBackground>
        <div className="min-h-screen flex items-center justify-center">
          <div className={ds(componentStyles.glassCard, 'text-center space-y-4 p-8')}>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
            <div className={ds(designSystem.text.body, 'text-lg')}>Loading game theme...</div>
          </div>
        </div>
      </HoneycombBackground>
    )
  }

  if (!theme) {
    return (
      <HoneycombBackground>
        <div className="min-h-screen flex items-center justify-center">
          <div className={ds(componentStyles.glassCard, 'text-center space-y-4 p-8')}>
            <div className={ds(designSystem.text.heading, 'text-xl')}>Failed to load game theme</div>
            <Button 
              onClick={() => loadTheme('settlers')}
              className={ds(componentStyles.buttonSecondary)}
            >
              Retry Loading Theme
            </Button>
          </div>
        </div>
      </HoneycombBackground>
    )
  }

  // Handle connection states
  if (!turnManager.isConnected && localPlayerId) {
    return (
      <HoneycombBackground>
        <div className="min-h-screen flex items-center justify-center">
          <div className={ds(componentStyles.glassCard, 'text-center space-y-4 p-8')}>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
            <div className={ds(designSystem.text.body, 'text-lg')}>Connecting to game...</div>
          </div>
        </div>
      </HoneycombBackground>
    )
  }

  if (turnManager.error) {
    return (
      <HoneycombBackground>
        <div className="min-h-screen flex items-center justify-center">
          <div className={ds(componentStyles.glassCard, 'text-center space-y-4 p-8')}>
            <div className={ds(designSystem.text.heading, 'text-xl')}>Failed to connect to game</div>
            <div className={ds(designSystem.text.body)}>
              {String(turnManager.error)}
            </div>
            <div className="flex gap-4">
              <Button 
                onClick={() => {
                  // Could trigger reconnection here
                  router.push('/')
                }}
                className={ds(componentStyles.buttonSecondary)}
              >
                Back to Home
              </Button>
            </div>
          </div>
        </div>
      </HoneycombBackground>
    )
  }

  // Use game state from turn manager if available, otherwise fallback to store
  const currentGameState = turnManager.gameState || gameState
  
  if (!currentGameState || !localPlayerId) {
    return (
      <HoneycombBackground>
        <div className="min-h-screen flex items-center justify-center">
          <div className={ds(componentStyles.glassCard, 'text-center space-y-4 p-8')}>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
            <div className={ds(designSystem.text.body, 'text-lg')}>Loading game...</div>
          </div>
        </div>
      </HoneycombBackground>
    )
  }

  const localPlayer = localPlayerId ? currentGameState.players.get(localPlayerId) : null

  return (
    <HoneycombBackground className="h-screen">
      {/* Game Interface - Top status bar with turn management */}
      <GameInterface 
        isConnected={turnManager.isConnected}
        gameId={gameId}
      />

      {/* Main game display */}
      <div className="relative w-full h-full">
        {/* Game Board */}
        <GameBoard
          board={currentGameState.board}
          theme={theme}
          onGameAction={handleGameActionLegacy}
        />
        
        {/* Players Panel - Top edge to edge */}
        <PlayersPanel
          gameState={currentGameState}
          playerAvatars={Object.fromEntries(
            Array.from(currentGameState.players.entries()).map((entry: unknown) => {
              const [id, player] = entry as [string, { name: string }]
              return [id, { avatar: '👤', name: player.name }]
            })
          )}
        />

        {/* Connection Status - Top Left Corner */}
        <ConnectionStatus 
          status={turnManager.isConnected ? 'connected' : 'disconnected'}
          className="absolute top-20 left-4 z-40"
        />

        {/* Left Sidebar - Player Resources & Actions */}
        {localPlayer && (
          <div className="absolute left-4 top-32 bottom-4 w-80 z-20 space-y-4">
            {/* Player Sidebar */}
            <PlayerSidebar
              gameState={currentGameState}
              localPlayer={localPlayer}
              isMyTurn={turnManager.isMyTurn}
              onAction={handleGameActionLegacy}
            />

            {/* Turn Actions Panel */}
            <TurnActionsPanel 
              onAction={handleGameAction}
              compactMode={false}
            />
          </div>
        )}

        {/* Right Sidebar - Game Controls */}
        <div className="absolute right-4 top-32 bottom-4 w-64 z-20 space-y-4">
          {/* Dice Roller */}
          <DiceRoller
            onRoll={(dice) => handleGameActionLegacy({
              type: 'roll',
              playerId: localPlayerId,
              data: { dice }
            })}
          />

          {/* Game Controls */}
          <div className={ds(componentStyles.glassCard, 'p-4 space-y-3')}>
            <div className={ds(designSystem.text.heading, 'text-lg mb-3')}>
              Game Controls
            </div>
            
            <Button
              onClick={() => {
                if (window.confirm('Are you sure you want to leave the game?')) {
                  router.push('/')
                }
              }}
              className={ds(
                componentStyles.buttonSecondary,
                'w-full flex items-center gap-2',
                designSystem.interactive.destructive.base,
                designSystem.interactive.destructive.hover
              )}
            >
              <LogOut className="w-4 h-4" />
              Leave Game
            </Button>
          </div>
        </div>
      </div>
    </HoneycombBackground>
  )
}

export default function GamePage({
  params
}: {
  params: Promise<PageParams>
}) {
  const resolvedParams = use(params)
  
  return (
    <DynamicLoading loader={() => Promise.resolve(<div>Loading...</div>)}>
      <GamePageContent gameId={resolvedParams.gameId} />
    </DynamicLoading>
  )
} 