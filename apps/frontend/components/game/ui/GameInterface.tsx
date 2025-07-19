'use client'

import { useGameStore } from '@/stores/gameStore'
import { GameAction } from '@settlers/game-engine'
import { Button } from '@/components/ui/button'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog'

import { InfoIcon } from 'lucide-react'
import { useState } from 'react'

interface GameInterfaceProps {
  onGameAction?: (action: GameAction) => void
}

export function GameInterface({ onGameAction: _onGameAction }: GameInterfaceProps) {
  const gameState = useGameStore(state => state.gameState)
  const localPlayerId = useGameStore(state => state.localPlayerId)
  const [showInfoDialog, setShowInfoDialog] = useState(false)

  if (!gameState || !localPlayerId) {
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50">
        <div className="text-lg text-white">Loading game...</div>
      </div>
    )
  }

  const myPlayer = gameState.players.get(localPlayerId)
  const currentPlayer = gameState.players.get(gameState.currentPlayer)
  const _isMyTurn = gameState.currentPlayer === localPlayerId

  if (!myPlayer) {
    console.error('GameInterface: Player not found in game', {
      localPlayerId,
      gameStatePlayerIds: Array.from(gameState.players.keys()),
      gameStatePlayers: Array.from(gameState.players.values()).map((p: unknown) => {
        const player = p as { id: string; name: string }
        return { id: player.id, name: player.name }
      }),
      playerExistsInGame: gameState.players.has(localPlayerId)
    })
    return (
      <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50">
        <div className="text-lg text-red-500">Player not found in game</div>
      </div>
    )
  }



    return (
    <div className="game-interface">
      {/* Floating Info Button - Top Right */}
      <div className="fixed top-4 right-4 z-50">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowInfoDialog(true)}
          className="bg-black/30 backdrop-blur-sm border-white/20 text-white hover:bg-black/40"
        >
          <InfoIcon className="h-4 w-4" />
        </Button>
      </div>

      {/* Game Info Dialog */}
      <Dialog open={showInfoDialog} onOpenChange={setShowInfoDialog}>
        <DialogContent className="sm:max-w-md bg-black/90 backdrop-blur-md border border-white/20 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Game Information</DialogTitle>
            <DialogDescription className="text-white/80">
              Current game state and victory conditions
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2 text-white">Current Game State</h4>
              <div className="grid grid-cols-2 gap-4 text-sm text-white/80">
                <div>Turn: {gameState.turn}</div>
                <div>Phase: {gameState.phase}</div>
                <div>Players: {gameState.players.size}</div>
                <div>Current Player: {currentPlayer?.name || 'Unknown'}</div>
              </div>
            </div>
            
            {gameState.dice && (
              <div>
                <h4 className="font-semibold mb-2 text-white">Last Roll</h4>
                <div className="text-sm text-white/80">
                  {gameState.dice.die1} + {gameState.dice.die2} = {gameState.dice.sum}
                </div>
              </div>
            )}
            
            <div>
              <h4 className="font-semibold mb-2 text-white">Victory Conditions</h4>
              <div className="text-sm text-white/60">
                First player to reach 10 victory points wins!
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button 
              onClick={() => setShowInfoDialog(false)}
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

 