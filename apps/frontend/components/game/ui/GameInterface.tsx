'use client'

import { useGameStore } from '@/stores/gameStore'
import { Player, GameAction } from '@settlers/core'
import { Button } from '@/components/ui/button'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { InfoIcon, Dices, User, Sword } from 'lucide-react'
import { useState } from 'react'

interface GameInterfaceProps {
  onGameAction?: (action: GameAction) => void
}

export function GameInterface({ onGameAction }: GameInterfaceProps) {
  const gameState = useGameStore(state => state.gameState)
  const localPlayerId = useGameStore(state => state.localPlayerId)
  const [showInfoDialog, setShowInfoDialog] = useState(false)

  if (!gameState || !localPlayerId) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="text-lg text-gray-500">Loading game...</div>
      </div>
    )
  }

  const myPlayer = gameState.players.get(localPlayerId)
  const currentPlayer = gameState.players.get(gameState.currentPlayer)
  const isMyTurn = gameState.currentPlayer === localPlayerId

  if (!myPlayer) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="text-lg text-red-500">Player not found in game</div>
      </div>
    )
  }

  // Get players adjacent to robber for steal phase
  const getAdjacentPlayers = () => {
    if (!gameState.board.robberPosition) return []
    
    const adjacentPlayers: Array<{ playerId: string, player: Player }> = []
    const robberHex = gameState.board.robberPosition
    
    // Find all vertices adjacent to the robber hex
    gameState.board.vertices.forEach((vertex, _vertexId) => {
      const building = vertex.building
      if (building && building.owner !== localPlayerId) {
        // Check if this vertex is adjacent to the robber hex
        const isAdjacent = vertex.position.hexes.some(hexPos => 
          hexPos.q === robberHex.q && hexPos.r === robberHex.r && hexPos.s === robberHex.s
        )
        
        if (isAdjacent) {
          const player = gameState.players.get(building.owner)
          if (player && !adjacentPlayers.some(p => p.playerId === building.owner)) {
            adjacentPlayers.push({ playerId: building.owner, player })
          }
        }
      }
    })
    
    return adjacentPlayers
  }

  const adjacentPlayers = gameState.phase === 'steal' ? getAdjacentPlayers() : []

  const handleStealFromPlayer = (targetPlayerId: string) => {
    if (!onGameAction) return
    
    const action: GameAction = {
      type: 'stealResource',
      playerId: localPlayerId,
      data: {
        targetPlayerId
      }
    }
    
    onGameAction(action)
  }

  const handleSkipSteal = () => {
    if (!onGameAction) return
    
    const action: GameAction = {
      type: 'endTurn',
      playerId: localPlayerId,
      data: {}
    }
    
    onGameAction(action)
  }

  return (
    <div className="game-interface">
      {/* Fixed header with game info */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container max-w-6xl mx-auto px-4 py-2">
          <div className="flex items-center justify-between">
            {/* Left: Current turn info */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span className="font-medium">{currentPlayer?.name || 'Unknown'}</span>
                {isMyTurn && <Badge variant="default">Your Turn</Badge>}
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Phase:</span>
                <Badge variant="outline">{gameState.phase}</Badge>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Turn:</span>
                <span className="font-mono text-sm">{gameState.turn}</span>
              </div>
            </div>

            {/* Center: Phase instructions */}
            <div className="text-center">
              <p className="text-sm font-medium">
                {getPhaseInstructions(gameState.phase, isMyTurn)}
              </p>
            </div>

            {/* Right: Game controls */}
            <div className="flex items-center gap-2">
              {gameState.dice && (
                <div className="flex items-center gap-2 px-3 py-1 bg-muted rounded-md">
                  <Dices className="h-4 w-4" />
                  <span className="font-mono text-sm">
                    {gameState.dice.die1} + {gameState.dice.die2} = {gameState.dice.sum}
                  </span>
                </div>
              )}
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowInfoDialog(true)}
              >
                <InfoIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Steal Phase Dialog */}
      {gameState.phase === 'steal' && isMyTurn && adjacentPlayers.length > 0 && (
        <Dialog open={true} onOpenChange={() => {}}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sword className="h-5 w-5 text-red-500" />
                Choose Player to Steal From
              </DialogTitle>
              <DialogDescription>
                Select a player adjacent to the robber to steal a random resource card from them.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-3">
              {adjacentPlayers.map(({ playerId, player }) => (
                <Card 
                  key={playerId}
                  className="cursor-pointer hover:bg-accent transition-colors"
                  onClick={() => handleStealFromPlayer(playerId)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full bg-player-${player.color}`} />
                        <div>
                          <p className="font-medium">{player.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {Object.values(player.resources).reduce((a, b) => a + b, 0)} cards
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {player.score.total} VP
                        </Badge>
                        {player.hasLongestRoad && (
                          <Badge variant="secondary" className="text-xs">
                            Longest Road
                          </Badge>
                        )}
                        {player.hasLargestArmy && (
                          <Badge variant="secondary" className="text-xs">
                            Largest Army
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={handleSkipSteal}>
                Skip Stealing
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Game Info Dialog */}
      <Dialog open={showInfoDialog} onOpenChange={setShowInfoDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Game Information</DialogTitle>
            <DialogDescription>
              Current game state and victory conditions
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Current Game State</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>Turn: {gameState.turn}</div>
                <div>Phase: {gameState.phase}</div>
                <div>Players: {gameState.players.size}</div>
                <div>Current Player: {currentPlayer?.name || 'Unknown'}</div>
              </div>
            </div>
            
            {gameState.dice && (
              <div>
                <h4 className="font-semibold mb-2">Last Roll</h4>
                <div className="text-sm">
                  {gameState.dice.die1} + {gameState.dice.die2} = {gameState.dice.sum}
                </div>
              </div>
            )}
            
            <div>
              <h4 className="font-semibold mb-2">Victory Conditions</h4>
              <div className="text-sm text-muted-foreground">
                First player to reach 10 victory points wins!
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowInfoDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Helper function to get phase-specific instructions
function getPhaseInstructions(phase: string, isMyTurn: boolean): string {
  if (!isMyTurn) return "Waiting for other player..."
  
  switch (phase) {
    case 'setup1':
      return "Place your first settlement and road"
    case 'setup2':
      return "Place your second settlement and road"
    case 'roll':
      return "Roll the dice to start your turn"
    case 'actions':
      return "Build, trade, or play development cards"
    case 'discard':
      return "Discard half your cards (7+ cards)"
    case 'moveRobber':
      return "Click on a hex to move the robber"
    case 'steal':
      return "Choose a player to steal from"
    case 'ended':
      return "Game Over!"
    default:
      return "Your turn"
  }
} 