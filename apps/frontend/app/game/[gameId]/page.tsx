'use client'

import { use, useEffect, useState, useCallback } from 'react'
import { useGameTheme } from '@/components/theme-provider'
import { GameBoard } from '@/components/game/board/GameBoard'
import { GameInterface } from '@/components/game/ui/GameInterface'
import { generateBoard, GameFlowManager, GameAction, DevelopmentCardType } from '@settlers/core'
import type { Board } from '@settlers/core'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'
import { useGameStore } from '@/stores/gameStore'

interface GamePageProps {
  params: Promise<{ gameId: string }>
}

export default function GamePage({ params }: GamePageProps) {
  // Unwrap the params promise using React.use()
  const { gameId: _gameId } = use(params)
  
  const { theme, loading: themeLoading, loadTheme } = useGameTheme()
  const [board, setBoard] = useState<Board | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  
  // Game state management - USE GAME STORE as single source of truth
  const [gameManager, setGameManager] = useState<GameFlowManager | null>(null)
  const gameState = useGameStore(state => state.gameState) // Read from store
  const updateGameState = useGameStore(state => state.updateGameState) // Store updater
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
      
      // Update game state with the new board if game manager exists
      if (gameManager && gameState) {
        const updatedState = {
          ...gameState,
          board: newBoard
        }
        updateGameState(updatedState)
      }
      
      toast.success('Board generated successfully!')
    } catch (error) {
      console.error('Failed to generate board:', error)
      toast.error('Failed to generate board')
    } finally {
      setIsGenerating(false)
    }
  }, [theme, gameManager, gameState, updateGameState])

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
          if (avatarIndex === 0) {
            // Current player - give lots of resources and all types of development cards
            player.resources = {
              wood: 5,
              brick: 4,
              ore: 3,
              wheat: 6,
              sheep: 4
            }
            
            // Give current player one of each development card type (playable)
            const cardTypes: DevelopmentCardType[] = ['knight', 'roadBuilding', 'yearOfPlenty', 'monopoly', 'victory']
            cardTypes.forEach((cardType, _index) => {
              const card = state.developmentDeck.find(c => c.type === cardType)
              if (card) {
                const cardIndex = state.developmentDeck.indexOf(card)
                state.developmentDeck.splice(cardIndex, 1)
                card.purchasedTurn = 0 // Can be played immediately
                player.developmentCards.push(card)
              }
            })
            
            // Add some extra knights for largest army demo
            for (let i = 0; i < 2; i++) {
              const knightCard = state.developmentDeck.find(c => c.type === 'knight')
              if (knightCard) {
                const cardIndex = state.developmentDeck.indexOf(knightCard)
                state.developmentDeck.splice(cardIndex, 1)
                knightCard.purchasedTurn = 0
                player.developmentCards.push(knightCard)
              }
            }
            
            // Add some newly bought cards (can't be played this turn)
            for (let i = 0; i < 2; i++) {
              const newCard = state.developmentDeck.pop()
              if (newCard) {
                newCard.purchasedTurn = 1 // Current turn, can't play yet
                player.developmentCards.push(newCard)
              }
            }
            
            player.knightsPlayed = 2 // For largest army demonstration
            player.score.public = 7 // Close to winning
            player.score.hidden = 1 // Victory point card
            player.score.total = 8
            player.hasLargestArmy = true
            
          } else if (avatarIndex === 1) {
            // Second player - moderate resources, some cards, longest road
            player.resources = {
              wood: 3,
              brick: 2,
              ore: 1,
              wheat: 3,
              sheep: 2
            }
            
            // Give a few development cards
            for (let i = 0; i < 3; i++) {
              const card = state.developmentDeck.pop()
              if (card) {
                card.purchasedTurn = 0
                player.developmentCards.push(card)
              }
            }
            
            player.knightsPlayed = 1
            player.score.public = 5
            player.score.hidden = 0
            player.score.total = 5
            player.hasLongestRoad = true
            
          } else if (avatarIndex === 2) {
            // Third player - minimal resources, few cards
            player.resources = {
              wood: 1,
              brick: 1,
              ore: 0,
              wheat: 2,
              sheep: 1
            }
            
            // Give one development card
            const card = state.developmentDeck.pop()
            if (card) {
              card.purchasedTurn = 0
              player.developmentCards.push(card)
            }
            
            player.score.public = 3
            player.score.hidden = 0
            player.score.total = 3
            
          } else {
            // Fourth player - balanced resources
            player.resources = {
              wood: 2,
              brick: 2,
              ore: 2,
              wheat: 2,
              sheep: 2
            }
            
            // Give two development cards
            for (let i = 0; i < 2; i++) {
              const card = state.developmentDeck.pop()
              if (card) {
                card.purchasedTurn = 0
                player.developmentCards.push(card)
              }
            }
            
            player.score.public = 4
            player.score.hidden = 0
            player.score.total = 4
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
          phase: 'actions' as const, // Start in actions phase for testing
          board: board || state.board // Use local board if available
        }
        
        setGameManager(manager)
        updateGameState(modifiedState)
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
  }, [gameManager, theme, updateGameState])

  // Generate test board when theme is loaded
  useEffect(() => {
    if (theme && !board && !isGenerating) {
      generateTestBoard()
    }
  }, [theme, board, isGenerating, generateTestBoard])



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
          updateGameState(result.newState)
          toast.success(result.message || 'Dice rolled!')
        } else {
          toast.error(result.error || 'Failed to roll dice')
        }
        break
        
      case 'endTurn':
        const endResult = gameManager.processAction(action)
        if (endResult.success) {
          updateGameState(endResult.newState)
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