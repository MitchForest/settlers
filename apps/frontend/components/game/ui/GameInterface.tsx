'use client'

import { useState, useEffect } from 'react'
import { GameFlowManager, GameState, GameAction } from '@settlers/core'
import { DiceRoller } from './DiceRoller'
import { PlayerDashboard } from './PlayerDashboard'
import { DevelopmentCards } from './DevelopmentCards'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface GameInterfaceProps {
  onAction?: (action: GameAction) => void
}

export function GameInterface({ onAction }: GameInterfaceProps) {
  const [gameManager, setGameManager] = useState<GameFlowManager | null>(null)
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [localPlayerId, setLocalPlayerId] = useState<string | null>(null)

  // Initialize demo game with starting resources
  useEffect(() => {
    try {
      const manager = GameFlowManager.createGame({
        playerNames: ['You', 'AI Player 1', 'AI Player 2', 'AI Player 3'],
        randomizePlayerOrder: true
      })
      
      // Give players starting resources for testing
      const state = manager.getState()
      const updatedPlayers = new Map(state.players)
      
      updatedPlayers.forEach((player) => {
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
      })
      
      const modifiedState = {
        ...state,
        players: updatedPlayers,
        turn: 1 // Start at turn 1 so cards are playable
      }
      
      setGameManager(manager)
      setGameState(modifiedState)
      
      // Set local player as the first player
      const playerIds = Array.from(modifiedState.players.keys())
      setLocalPlayerId(playerIds[0])
      
      toast.success('Demo game created with starting resources!')
    } catch (error) {
      console.error('Failed to create demo game:', error)
      toast.error('Failed to create demo game')
    }
  }, [])

  const handleGameAction = (actionType: string, data?: unknown) => {
    if (!gameManager || !gameState || !localPlayerId) {
      toast.error('Game not initialized')
      return
    }

    let action: GameAction

    switch (actionType) {
      case 'roll':
        action = {
          type: 'roll',
          playerId: localPlayerId,
          data: {}
        }
        break
      case 'endTurn':
        action = {
          type: 'endTurn',
          playerId: localPlayerId,
          data: {}
        }
        break
      case 'playCard':
        action = {
          type: 'playCard',
          playerId: localPlayerId,
          data: { cardId: data }
        }
        break
      case 'buyCard':
        // Simulate buying a development card
        const localPlayer = gameState.players.get(localPlayerId)!
        if (gameState.developmentDeck.length > 0) {
          const newCard = gameState.developmentDeck[0]
          newCard.purchasedTurn = gameState.turn
          
          // Update state manually since we don't have full action processing for buy card yet
          const newState = { ...gameState }
          const newPlayers = new Map(newState.players)
          const updatedPlayer = { ...localPlayer }
          
          // Deduct resources
          updatedPlayer.resources = {
            wood: Math.max(0, updatedPlayer.resources.wood),
            brick: Math.max(0, updatedPlayer.resources.brick),
            ore: Math.max(0, updatedPlayer.resources.ore - 1),
            wheat: Math.max(0, updatedPlayer.resources.wheat - 1),
            sheep: Math.max(0, updatedPlayer.resources.sheep - 1)
          }
          
          // Add card
          updatedPlayer.developmentCards.push({ ...newCard })
          newState.developmentDeck = newState.developmentDeck.slice(1)
          newPlayers.set(localPlayerId, updatedPlayer)
          newState.players = newPlayers
          
          setGameState(newState)
          toast.success('Development card purchased!')
          return
        } else {
          toast.error('No development cards left')
          return
        }
      case 'buildSettlement':
        toast.info('Settlement placement not implemented yet')
        return
      case 'buildCity':
        toast.info('City placement not implemented yet')
        return
      case 'buildRoad':
        toast.info('Road placement not implemented yet')
        return
      case 'trade':
        toast.info('Trading not implemented yet')
        return
      default:
        toast.error(`Unknown action: ${actionType}`)
        return
    }

    const result = gameManager.processAction(action)
    
    if (result.success) {
      setGameState(result.newState)
      toast.success(result.message || 'Action completed')
      
      // Call external handler if provided
      if (onAction) {
        onAction(action)
      }
    } else {
      toast.error(result.error || 'Action failed')
    }
  }

  const handleDiceRoll = () => {
    // The dice component handles the UI, this is called after animation
    handleGameAction('roll')
  }

  const handlePlayCard = (cardId: string) => {
    handleGameAction('playCard', cardId)
  }

  const getCurrentPlayer = () => {
    if (!gameState) return null
    return gameState.players.get(gameState.currentPlayer) || null
  }

  const getLocalPlayer = () => {
    if (!gameState || !localPlayerId) return null
    return gameState.players.get(localPlayerId) || null
  }

  const restartGame = () => {
    try {
      const manager = GameFlowManager.createGame({
        playerNames: ['You', 'AI Player 1', 'AI Player 2', 'AI Player 3'],
        randomizePlayerOrder: true
      })
      
      // Give players starting resources for testing
      const state = manager.getState()
      const updatedPlayers = new Map(state.players)
      
      updatedPlayers.forEach((player) => {
        player.resources = {
          wood: 2,
          brick: 2,
          ore: 1,
          wheat: 2,
          sheep: 1
        }
        
        if (state.developmentDeck.length > 0) {
          const card1 = state.developmentDeck.pop()!
          const card2 = state.developmentDeck.pop()!
          card1.purchasedTurn = 0
          card2.purchasedTurn = 0
          player.developmentCards.push(card1, card2)
        }
      })
      
      const modifiedState = {
        ...state,
        players: updatedPlayers,
        turn: 1
      }
      
      setGameManager(manager)
      setGameState(modifiedState)
      
      const playerIds = Array.from(modifiedState.players.keys())
      setLocalPlayerId(playerIds[0])
      
      toast.success('Game restarted!')
    } catch (error) {
      console.error('Failed to restart game:', error)
      toast.error('Failed to restart game')
    }
  }

  if (!gameState || !localPlayerId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-white text-lg">Initializing game...</div>
      </div>
    )
  }

  const currentPlayer = getCurrentPlayer()
  const localPlayer = getLocalPlayer()
  const isMyTurn = gameState.currentPlayer === localPlayerId

  return (
    <div className="space-y-6">
      {/* Game Status */}
      <Card className="p-4 bg-white/10 backdrop-blur-sm border-white/20">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Settlers Demo Game</h2>
            <div className="text-sm text-white/70">
              Turn {gameState.turn} | Current: {currentPlayer?.name} | Phase: {gameState.phase}
            </div>
          </div>
          <Button onClick={restartGame} variant="outline" size="sm">
            Restart Game
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6">
        {/* Player Dashboard */}
        {localPlayer && (
          <PlayerDashboard
            player={localPlayer}
            gamePhase={gameState.phase}
            isCurrentPlayer={isMyTurn}
            canRoll={gameState.phase === 'roll' && isMyTurn}
            onAction={handleGameAction}
          />
        )}

        {/* Development Cards */}
        {localPlayer && localPlayer.developmentCards.length > 0 && (
          <DevelopmentCards
            cards={localPlayer.developmentCards}
            currentTurn={gameState.turn}
            onPlayCard={handlePlayCard}
            onBuyCard={() => handleGameAction('buyCard')}
            canBuyCard={localPlayer.resources.ore >= 1 && localPlayer.resources.wheat >= 1 && localPlayer.resources.sheep >= 1}
          />
        )}

        {/* Game Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Dice Roller */}
          {gameState.phase === 'roll' && isMyTurn && (
            <DiceRoller
              onRoll={handleDiceRoll}
              disabled={!isMyTurn}
              isRolling={false}
            />
          )}

          {/* Last Dice Roll */}
          {gameState.dice && (
            <Card className="p-4 bg-white/10 backdrop-blur-sm border-white/20">
              <h3 className="text-lg font-semibold text-white mb-2">Last Roll</h3>
              <div className="text-center">
                <div className="text-3xl font-bold text-white">
                  {gameState.dice.sum}
                </div>
                <div className="text-sm text-white/70">
                  {gameState.dice.die1} + {gameState.dice.die2}
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Other Players */}
        <Card className="p-4 bg-white/10 backdrop-blur-sm border-white/20">
          <h3 className="text-lg font-semibold text-white mb-2">Other Players</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from(gameState.players.values())
              .filter(p => p.id !== localPlayerId)
              .map(player => (
                <div key={player.id} className="bg-white/5 rounded p-3">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className={`w-4 h-4 rounded-full`} 
                         style={{ backgroundColor: `var(--color-player-${player.color})` }} />
                    <span className="text-white text-sm font-medium">{player.name}</span>
                  </div>
                  <div className="text-xs text-white/70 space-y-1">
                    <div>Score: {player.score.total} pts</div>
                    <div>Cards: {player.developmentCards.length}</div>
                    <div>Resources: {Object.values(player.resources).reduce((a, b) => a + b, 0)}</div>
                  </div>
                </div>
              ))}
          </div>
        </Card>

        {/* Game Help */}
        <Card className="p-4 bg-white/10 backdrop-blur-sm border-white/20">
          <h3 className="text-lg font-semibold text-white mb-2">Demo Instructions</h3>
          <div className="text-sm text-white/70 space-y-1">
            <p>• This is a working demo of the Settlers game engine with starting resources</p>
            <p>• Current features: dice rolling, turn management, resource tracking, development cards</p>
            <p>• Try: buying cards, playing cards (wait a turn after buying), rolling dice</p>
            <p>• Coming soon: piece placement, trading, robber mechanics</p>
          </div>
        </Card>
      </div>
    </div>
  )
} 