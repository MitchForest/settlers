'use client'

import { use, useEffect, useState, useCallback, useMemo } from 'react'
import { useGameTheme } from '@/components/theme-provider'
import { GameBoard } from '@/components/game/board/GameBoard'
import { GameInterface } from '@/components/game/ui/GameInterface'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Board, GameAction, GameFlowManager } from '@settlers/core'
import { useGameStore } from '@/stores/gameStore'

interface PageParams {
  gameId: string
}

export default function GamePage({ params }: { params: Promise<PageParams> }) {
  const { gameId: _gameId } = use(params)
  
  // Theme loading
  const { theme, loading: themeLoading, loadTheme } = useGameTheme()
  const [_board, _setBoard] = useState<Board | null>(null)
  
  // Game state management - USE GAME STORE as single source of truth
  const gameState = useGameStore(state => state.gameState) // Get state from store
  const [gameManager, setGameManager] = useState<GameFlowManager | null>(null)
  const updateGameState = useGameStore(state => state.updateGameState) // Store updater
  const [localPlayerId, setLocalPlayerId] = useState<string | null>(null)

  // State for game board generation
  const [isGenerating, setIsGenerating] = useState(false)

  // Player avatar mapping (for future use)
  const _playerAvatars = useMemo(() => ({
    'player1': { avatar: '👤', name: 'Player 1' },
    'player2': { avatar: '🤖', name: 'Player 2' },
    'player3': { avatar: '👨‍💻', name: 'Player 3' },
    'player4': { avatar: '👩‍🚀', name: 'Player 4' }
  }), [])

  // Demo board generation
  const generateTestBoard = useCallback(async () => {
    if (isGenerating) return

    setIsGenerating(true)
    try {
      // Create a demo game state for testing
      const demoGame = GameFlowManager.createGame({
        playerNames: ['Player 1', 'Player 2', 'Player 3', 'Player 4'],
        gameId: 'demo-game',
        randomizePlayerOrder: false
      })

      const modifiedState = demoGame.getState()
      
      // Modify state to add some demo resources and buildings
      const players = Array.from(modifiedState.players.values())
      
      if (players.length > 0) {
        // Give player 1 some starting resources
        players[0].resources = {
          wood: 3,
          brick: 2,
          ore: 1,
          wheat: 2,
          sheep: 1
        }
        
        // Give other players some resources too
        if (players.length > 1) {
          players[1].resources = {
            wood: 1,
            brick: 1,
            ore: 2,
            wheat: 1,
            sheep: 2
          }
        }
      }

      setGameManager(demoGame)
      updateGameState(modifiedState)

      // Set local player as the first player
      const playerIds = Array.from(modifiedState.players.keys())
      setLocalPlayerId(playerIds[0])
      
      toast.success('Game loaded!')
    } catch (error) {
      console.error('Failed to create demo game:', error)
      toast.error('Failed to create demo game')
    } finally {
      setIsGenerating(false)
    }
  }, [updateGameState, isGenerating])

  // Generate test board when theme is loaded
  useEffect(() => {
    if (theme && !gameState && !isGenerating) {
      generateTestBoard()
    }
  }, [theme, gameState, isGenerating, generateTestBoard])

  // Auto-load settlers theme when component mounts
  useEffect(() => {
    if (!theme && !themeLoading) {
      loadTheme('settlers').catch(error => {
        console.error('Failed to load settlers theme:', error)
        toast.error('Failed to load game theme')
      })
    }
  }, [theme, themeLoading, loadTheme])


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

  const _handleTurnTimeout = () => {
    if (gameState && localPlayerId === gameState.currentPlayer) {
      toast.warning('Time is up! Ending turn automatically.')
      handleGameAction({
        type: 'endTurn',
        playerId: localPlayerId,
        data: {}
      })
    }
  }

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

  return (
    <div className="min-h-screen bg-slate-900 relative">
      {/* Main board display */}
      {gameState ? (
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
      ) : (
        <div className="h-full flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="text-white text-xl">
              {isGenerating ? 'Generating board...' : 'No board generated'}
            </div>
            {!isGenerating && (
              <Button onClick={generateTestBoard} variant="outline">
                Generate Board
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Loading overlay for board generation */}
      {isGenerating && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="p-6 bg-white/10 backdrop-blur-sm border-white/20">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
              <div className="text-white text-lg">Generating new board...</div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
} 