'use client'

import { use, useEffect, useState, useCallback } from 'react'
import { useGameTheme } from '@/components/theme-provider'
import { GameBoard } from '@/components/game/board/GameBoard'
import { PlayerSidebar } from '@/components/game/ui/PlayerSidebar'
import { PlayersPanel } from '@/components/game/ui/PlayersPanel'
import { DiceRoller } from '@/components/game/ui/DiceRoller'

import { Button } from '@/components/ui/button'
// Removed unused Dialog components
import { toast } from 'sonner'
import { RotateCcw, Palette, Play, LogOut, Info } from 'lucide-react'
import { GameAction, GameFlowManager } from '@settlers/core'
import { useGameStore } from '@/stores/gameStore'
import { useRouter } from 'next/navigation'

interface PageParams {
  gameId: string
}

export default function GamePage({ params }: { params: Promise<PageParams> }) {
  const { gameId } = use(params)
  const router = useRouter()
  
  // Theme loading
  const { theme, loading: themeLoading, loadTheme } = useGameTheme()
  
  // Game state management - USE GAME STORE as single source of truth
  const { 
    gameState, 
    localPlayerId,
    connectionStatus,
    connect,
    disconnect,
    updateGameState 
  } = useGameStore()
  
  const [gameManager, setGameManager] = useState<GameFlowManager | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)

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

  // Connect to backend game when theme is loaded
  useEffect(() => {
    if (!theme || isConnecting || gameState) return

    const playerId = getPlayerIdForGame()
    if (!playerId) {
      console.warn('No player ID found for game, redirecting to home')
      router.push('/')
      return
    }

    setIsConnecting(true)
    connect(gameId, playerId)
      .catch((error) => {
        console.error('Failed to connect to game:', error)
        toast.error('Failed to connect to game')
        setIsConnecting(false)
      })
  }, [theme, gameId, connect, getPlayerIdForGame, isConnecting, gameState, router])

  // Update game manager when state changes
  useEffect(() => {
    if (gameState) {
      const manager = new GameFlowManager(gameState)
      setGameManager(manager)
      setIsConnecting(false)
    }
  }, [gameState])

  // Auto-load settlers theme when component mounts
  useEffect(() => {
    if (!theme && !themeLoading) {
      loadTheme('settlers').catch(error => {
        console.error('Failed to load settlers theme:', error)
        toast.error('Failed to load game theme')
      })
    }
  }, [theme, themeLoading, loadTheme])

  // Check for expired trades periodically
  useEffect(() => {
    if (!gameManager || !gameState) return

    const interval = setInterval(() => {
      const hadExpiredTrades = gameManager.cleanupExpiredTrades()
      if (hadExpiredTrades) {
        updateGameState(gameManager.getState())
        toast.info('Some trade offers have expired')
      }
    }, 5000) // Check every 5 seconds

    return () => clearInterval(interval)
  }, [gameManager, gameState, updateGameState])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  const handleGameAction = (action: GameAction) => {
    if (!gameManager || !gameState) {
      toast.error('Game not initialized')
      return
    }

    console.log('Processing action:', action)

    // Process the action through the game manager
    const result = gameManager.processAction(action)
    
    if (result.success) {
      // Update the game state
      updateGameState(result.newState)
      
      // Handle specific action types
      switch (action.type) {
        case 'roll':
          const dice = result.newState.dice
          if (dice) {
            if (dice.sum === 7) {
              toast.warning(`Rolled ${dice.sum}! Robber activated!`)
            } else {
              toast.success(`Rolled ${dice.die1} + ${dice.die2} = ${dice.sum}`)
              
              // Show resource distribution if any
              const resourceEvent = result.events.find(e => e.type === 'resourcesDistributed')
              if (resourceEvent) {
                const distribution = resourceEvent.data.distribution as Record<string, Record<string, number>>
                let totalGained = 0
                Object.values(distribution).forEach((playerResources) => {
                  Object.values(playerResources).forEach((amount) => {
                    totalGained += amount
                  })
                })
                if (totalGained > 0) {
                  toast.info(`${totalGained} resources distributed to players`)
                }
              }
            }
          }
          break
          
        case 'build':
          // Check if this started placement mode
          const placementEvent = result.events.find(e => e.type === 'placementModeStarted')
          if (placementEvent) {
            toast.info(`Click on the board to place your ${placementEvent.data.buildingType}`)
          }
          break
          
        case 'buyCard':
          const cardEvent = result.events.find(e => e.type === 'developmentCardPurchased')
          if (cardEvent) {
            toast.success(`Development card purchased!`)
          }
          break
          
        case 'moveRobber':
          toast.success('Robber moved!')
          // Check if we need to steal
          if (result.newState.phase === 'steal') {
            toast.info('Select a player to steal from')
          }
          break
          
        case 'stealResource':
          const stealEvent = result.events.find(e => e.type === 'resourceStolen')
          if (stealEvent) {
            const targetPlayer = result.newState.players.get(stealEvent.data.targetPlayerId)
            toast.success(`Stole a ${stealEvent.data.resourceType} from ${targetPlayer?.name}!`)
          } else {
            toast.info('No resources to steal')
          }
          // Show resource distribution if any
          const resourceEvent = result.events.find(e => e.type === 'resourcesDistributed')
          if (resourceEvent) {
            const distribution = resourceEvent.data.distribution as Record<string, Record<string, number>>
            let totalGained = 0
            Object.values(distribution).forEach((playerResources) => {
              Object.values(playerResources).forEach((amount) => {
                totalGained += amount
              })
            })
            if (totalGained > 0) {
              toast.info(`${totalGained} resources distributed to players`)
            }
          }
          break
          
        case 'discard':
          toast.success('Cards discarded')
          break
          
        case 'endTurn':
          toast.info('Turn ended')
          break

        case 'bankTrade':
          toast.success('Bank trade completed!')
          break

        case 'portTrade':
          const portEvent = result.events.find(e => e.type === 'portTradeExecuted')
          if (portEvent) {
            const portType = portEvent.data.portType
            toast.success(`${portType === 'generic' ? 'Generic' : portType} port trade completed!`)
          }
          break

        case 'createTradeOffer':
          const tradeOfferEvent = result.events.find(e => e.type === 'tradeOfferCreated')
          if (tradeOfferEvent) {
            const isOpen = tradeOfferEvent.data.isOpenOffer
            toast.success(isOpen ? 'Open trade offer created!' : 'Trade offer sent!')
          }
          break

        case 'acceptTrade':
          const acceptEvent = result.events.find(e => e.type === 'tradeAccepted')
          if (acceptEvent) {
            const initiatorName = result.newState.players.get(acceptEvent.data.initiator)?.name
            toast.success(`Trade with ${initiatorName} completed!`)
          }
          break

        case 'rejectTrade':
          const rejectEvent = result.events.find(e => e.type === 'tradeRejected')
          if (rejectEvent) {
            const initiatorName = result.newState.players.get(rejectEvent.data.initiator)?.name
            toast.info(`Trade with ${initiatorName} rejected`)
          }
          break

        case 'cancelTrade':
          toast.info('Trade offer cancelled')
          break
          
        default:
          // Show generic success for other actions
          if (result.message) {
            toast.success(result.message)
          } else {
            toast.success('Action completed')
          }
      }
      
      // Log events for debugging
      if (result.events.length > 0) {
        console.log('Game events:', result.events)
      }
    } else {
      // Show error message
      toast.error(result.error || 'Action failed')
      console.error('Action failed:', result.error, action)
    }
  }

  // Handle loading states
  if (themeLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a4b3a] via-[#2d5a47] to-[#1a4b3a] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          <div className="text-white text-lg">Loading game theme...</div>
        </div>
      </div>
    )
  }

  if (!theme) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a4b3a] via-[#2d5a47] to-[#1a4b3a] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-white text-xl">Failed to load game theme</div>
          <Button 
            onClick={() => loadTheme('settlers')}
            variant="outline"
          >
            Retry Loading Theme
          </Button>
        </div>
      </div>
    )
  }

  // Handle connection states
  if (connectionStatus === 'connecting' || isConnecting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          <div className="text-white text-lg">Connecting to game...</div>
        </div>
      </div>
    )
  }

  if (connectionStatus === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-white text-xl">Failed to connect to game</div>
          <div className="flex gap-4">
            <Button 
              onClick={() => {
                const playerId = getPlayerIdForGame()
                if (playerId) {
                  setIsConnecting(true)
                  connect(gameId, playerId)
                }
              }}
              variant="outline"
            >
              Retry Connection
            </Button>
            <Button 
              onClick={() => router.push('/')}
              variant="outline"
            >
              Back to Home
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!gameState || !gameManager) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          <div className="text-white text-lg">Loading game...</div>
        </div>
      </div>
    )
  }

  const localPlayer = localPlayerId ? gameState.players.get(localPlayerId) : null
  const isMyTurn = gameState.currentPlayer === localPlayerId

  return (
    <div className="h-screen bg-gradient-to-br from-[#1a4b3a] via-[#2d5a47] to-[#1a4b3a] relative overflow-hidden">
      {/* Main game display */}
      <div className="relative w-full h-full">
        {/* Game Board */}
        <GameBoard
          board={gameState.board}
          theme={theme}
          onGameAction={handleGameAction}
        />
        
        {/* Players Panel - Top edge to edge */}
        <PlayersPanel
          gameState={gameState}
          playerAvatars={Object.fromEntries(
            Array.from(gameState.players.entries()).map(([id, player]) => [
              id, 
              { avatar: '👤', name: player.name }
            ])
          )}
        />

        {/* Player Sidebar - Left side with proper spacing */}
        {localPlayerId && gameState && gameState.players.get(localPlayerId) && (
          <div className="fixed left-4 w-80 top-20 z-40" style={{ bottom: 'calc(16px + 48px + 16px)' }}>
            <PlayerSidebar
              gameState={gameState}
              localPlayer={gameState.players.get(localPlayerId)!}
              isMyTurn={isMyTurn}
              onAction={handleGameAction}
            />
          </div>
        )}

        {/* Floating Action Buttons - Below sidebar */}
        <div className="fixed left-4 w-80 bottom-4 z-40">
          <div className="flex flex-row justify-between">
            {/* Regenerate/Restart Button */}
            <Button
              size="icon"
              onClick={() => {
                // TODO: Implement restart functionality for real games
                toast.info('Restart functionality coming soon')
              }}
              className="h-12 w-12 bg-black/30 backdrop-blur-sm hover:bg-black/40 text-white border border-white/20 rounded-lg"
              title="Restart Game"
            >
              <RotateCcw className="h-6 w-6" />
            </Button>
            
            {/* Theme Toggle Button */}
            <Button
              size="icon"
              onClick={() => {
                // TODO: Implement theme toggle
                toast.info('Theme toggle coming soon')
              }}
              className="h-12 w-12 bg-black/30 backdrop-blur-sm hover:bg-black/40 text-white border border-white/20 rounded-lg"
              title="Toggle Theme Assets"
            >
              <Palette className="h-6 w-6" />
            </Button>
            
            {/* Auto Mode Button */}
            <Button
              size="icon"
              onClick={() => {
                toast.info('Auto mode coming soon')
              }}
              disabled
              className="h-12 w-12 bg-black/30 backdrop-blur-sm hover:bg-black/40 text-white/50 border border-white/20 rounded-lg cursor-not-allowed"
              title="Auto Mode (Coming Soon)"
            >
              <Play className="h-6 w-6" />
            </Button>
            
            {/* Exit Button */}
            <Button
              size="icon"
              onClick={() => router.push('/')}
              className="h-12 w-12 bg-black/30 backdrop-blur-sm hover:bg-black/40 text-white border border-white/20 rounded-lg"
              title="Exit Game"
            >
              <LogOut className="h-6 w-6" />
            </Button>
            
            {/* Info Button */}
            <Button
              size="icon"
              onClick={() => {
                toast.info('Game information coming soon')
              }}
              className="h-12 w-12 bg-black/30 backdrop-blur-sm hover:bg-black/40 text-white border border-white/20 rounded-lg"
              title="Game Information"
            >
              <Info className="h-6 w-6" />
            </Button>
          </div>
        </div>

        {/* Bottom Action Bar - Dice Roller */}
        {localPlayer && gameState && isMyTurn && gameState.phase === 'roll' && (
          <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-40">
            <DiceRoller
              onRoll={(_dice) => handleGameAction({
                type: 'roll',
                playerId: localPlayerId || '',
                data: {}
              })}
              canRoll={true}
            />
          </div>
        )}
      </div>
    </div>
  )
} 