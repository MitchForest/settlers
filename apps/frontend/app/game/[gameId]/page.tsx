'use client'

import { use, useEffect, useState, useCallback } from 'react'
import { useGameTheme } from '@/components/theme-provider'
import { GameBoard } from '@/components/game/board/GameBoard'
import { GameInterface } from '@/components/game/ui/GameInterface'
import { generateBoard, GameFlowManager, GameState, GameAction } from '@settlers/core'
import type { Board } from '@settlers/core'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'

interface GamePageProps {
  params: Promise<{ gameId: string }>
}

export default function GamePage({ params }: GamePageProps) {
  // Unwrap the params promise using React.use()
  const { gameId } = use(params)
  
  const { theme, loading: themeLoading, loadTheme } = useGameTheme()
  const [board, setBoard] = useState<Board | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  
  // Game state management
  const [gameManager, setGameManager] = useState<GameFlowManager | null>(null)
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [localPlayerId, setLocalPlayerId] = useState<string | null>(null)
  const [playerAvatars, setPlayerAvatars] = useState<Record<string, { avatar: string; name: string }>>({})

  // Memoize the generateTestBoard function to fix useEffect dependency
  const generateTestBoard = useCallback(async () => {
    if (!theme) {
      toast.error('Theme must be loaded before generating board')
      return
    }

    setIsGenerating(true)
    try {
      const newBoard = generateBoard()
      setBoard(newBoard)
      toast.success('Board generated successfully!')
    } catch (error) {
      console.error('Failed to generate board:', error)
      toast.error('Failed to generate board')
    } finally {
      setIsGenerating(false)
    }
  }, [theme])

  // Auto-load settlers theme when component mounts
  useEffect(() => {
    if (!theme && !themeLoading) {
      loadTheme('settlers').catch(error => {
        console.error('Failed to load settlers theme:', error)
        toast.error('Failed to load game theme')
      })
    }
  }, [theme, themeLoading, loadTheme])

  // Initialize demo game once when component mounts
  useEffect(() => {
    if (!gameManager && theme) {
      try {
        const manager = GameFlowManager.createGame({
          playerNames: ['You', 'Alice', 'Bob', 'Charlie'],
          randomizePlayerOrder: true
        })
        
        // Give players starting resources for testing
        const state = manager.getState()
        const updatedPlayers = new Map(state.players)
        
        // Set up player avatars
        const avatars: Record<string, { avatar: string; name: string }> = {}
        const defaultAvatars = ['🧙‍♂️', '👩‍🌾', '👨‍🔬', '👸']
        
        let avatarIndex = 0
        updatedPlayers.forEach((player, playerId) => {
          // Give starting resources for testing
          player.resources = {
            wood: 2,
            brick: 2,
            ore: 1,
            wheat: 2,
            sheep: 1
          }
          
          // Give some development cards for testing
          if (state.developmentDeck.length > 0) {
            const card1 = state.developmentDeck.pop()!
            const card2 = state.developmentDeck.pop()!
            card1.purchasedTurn = 0
            card2.purchasedTurn = 0
            player.developmentCards.push(card1, card2)
          }
          
          // Set up avatar
          avatars[playerId] = {
            avatar: defaultAvatars[avatarIndex] || '👤',
            name: player.name
          }
          avatarIndex++
        })
        
        const modifiedState = {
          ...state,
          players: updatedPlayers,
          turn: 1,
          phase: 'actions' as const // Start in actions phase for testing
        }
        
        setGameManager(manager)
        setGameState(modifiedState)
        setPlayerAvatars(avatars)
        
        // Set local player as the first player
        const playerIds = Array.from(modifiedState.players.keys())
        setLocalPlayerId(playerIds[0])
        
        toast.success('Game loaded!')
      } catch (error) {
        console.error('Failed to create demo game:', error)
        toast.error('Failed to create demo game')
      }
    }
  }, [gameManager, theme])

  // Generate test board when theme is loaded
  useEffect(() => {
    if (theme && !board && !isGenerating) {
      generateTestBoard()
    }
  }, [theme, board, isGenerating, generateTestBoard])

  const regenerateBoard = () => {
    setBoard(null)
    generateTestBoard()
  }

  const handleGameAction = (action: GameAction) => {
    if (!gameManager || !gameState) {
      toast.error('Game not initialized')
      return
    }

    // For now, just handle some basic actions
    switch (action.type) {
      case 'roll':
        const result = gameManager.processAction(action)
        if (result.success) {
          setGameState(result.newState)
          toast.success(result.message || 'Dice rolled!')
        } else {
          toast.error(result.error || 'Failed to roll dice')
        }
        break
        
      case 'endTurn':
        const endResult = gameManager.processAction(action)
        if (endResult.success) {
          setGameState(endResult.newState)
          toast.success('Turn ended')
        } else {
          toast.error(endResult.error || 'Failed to end turn')
        }
        break
        
      default:
        toast.info(`${action.type} action not implemented yet`)
    }
  }

  const handleTurnTimeout = () => {
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
    <div className="h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Always show the game interface */}
      {board && gameState ? (
        <div className="relative w-full h-screen">
          {/* Game board - full screen background */}
          <GameBoard 
            board={board} 
            testPieces={[]}
            disableTransitions={false}
            forceTheme={theme}
          />
          
          {/* Game Interface Overlay */}
          <GameInterface
            gameState={gameState}
            localPlayerId={localPlayerId}
            playerAvatars={playerAvatars}
            onAction={handleGameAction}
            onTurnTimeout={handleTurnTimeout}
            onRegenerateBoard={generateTestBoard}
          />

          {/* Board Regeneration Button - Top Right */}

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