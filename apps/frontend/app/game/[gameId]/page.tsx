'use client'

import { use, useEffect, useState, useCallback } from 'react'
import { useGameTheme } from '@/components/theme-provider'
import { GameBoard } from '@/components/game/board/GameBoard'
import { GameInterface } from '@/components/game/ui/GameInterface'

import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          <div className="text-white text-lg">Loading game theme...</div>
        </div>
      </div>
    )
  }

  if (!theme) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
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

  return (
    <div className="min-h-screen bg-slate-900 relative">
      {/* Main board display */}
      <div className="relative w-full h-full">
        {/* Game Board */}
        <GameBoard
          board={gameState.board}
          theme={theme}
          onGameAction={handleGameAction}
        />
        
        {/* Game Interface Overlay */}
        <GameInterface
          onGameAction={handleGameAction}
        />
      </div>
    </div>
  )
} 