'use client'

import { useGameStore } from '@/stores/gameStore'
import { useTurnStore } from '@/stores/turnStore'
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
import { TurnTimer } from './TurnTimer'
import { ds, componentStyles, designSystem } from '@/lib/design-system'

import { InfoIcon, Clock, Users, Activity } from 'lucide-react'
import { useState } from 'react'

interface GameInterfaceProps {
  onGameAction?: (action: GameAction) => void
  isConnected?: boolean
  gameId?: string
}

export function GameInterface({ onGameAction: _onGameAction, isConnected = true, gameId }: GameInterfaceProps) {
  const gameState = useGameStore(state => state.gameState)
  const localPlayerId = useGameStore(state => state.localPlayerId)
  const { currentTurn, aiTurn, notifications } = useTurnStore()
  const isMyTurn = currentTurn.isMyTurn
  const timeRemaining = currentTurn.timing?.remainingMs || 0
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
      {/* Top Status Bar */}
      <div className="fixed top-4 left-4 right-4 z-50 flex items-center justify-between">
        {/* Left: Turn Status */}
        <div className={ds(designSystem.glass.primary, 'px-4 py-2 rounded-lg flex items-center gap-3')}>
          {/* Connection Status */}
          <div className="flex items-center gap-2">
            <div 
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-400' : 'bg-red-400'
              } animate-pulse`} 
            />
            <span className={designSystem.text.muted}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          {/* Turn Info */}
          <div className="h-4 w-px bg-white/20" />
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-white/60" />
            <span className={designSystem.text.body}>
              {isMyTurn ? 'Your turn' : `${currentPlayer?.name || 'Unknown'}'s turn`}
            </span>
          </div>

          {/* Phase Info */}
          <div className="h-4 w-px bg-white/20" />
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-white/60" />
            <span className={designSystem.text.body}>
              {gameState.phase}
            </span>
          </div>
        </div>

        {/* Center: Turn Timer */}
                 <div className={ds(designSystem.glass.primary, 'px-4 py-2 rounded-lg')}>
           <TurnTimer 
             size="sm" 
             showPhase={false} 
             showPlayerName={false}
           />
         </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowInfoDialog(true)}
            className={ds(
              designSystem.glass.primary,
              designSystem.interactive.primary.hover,
              'border-white/20 text-white'
            )}
          >
            <InfoIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Turn Notifications */}
      {notifications.length > 0 && (
        <div className="fixed top-20 right-4 z-40 space-y-2 max-w-sm">
          {notifications.slice(0, 3).map((notification) => (
            <div
              key={notification.id}
                             className={ds(
                 designSystem.glass.primary,
                 'px-4 py-3 rounded-lg border-l-4',
                 notification.type === 'actionCompleted' && 'border-l-green-400',
                 notification.type === 'turnTimeout' && 'border-l-orange-400',
                 notification.type === 'error' && 'border-l-red-400',
                 (notification.type === 'turnStarted' || notification.type === 'turnEnded' || notification.type === 'phaseChanged') && 'border-l-blue-400',
                 designSystem.animation.normal
               )}
            >
              <div className={designSystem.text.body}>
                {notification.message}
              </div>
              {notification.timestamp && (
                <div className={ds(designSystem.text.muted, 'text-xs mt-1')}>
                  {new Date(notification.timestamp).toLocaleTimeString()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Game Info Dialog */}
      <Dialog open={showInfoDialog} onOpenChange={setShowInfoDialog}>
        <DialogContent className={ds(
          designSystem.glass.primary,
          'sm:max-w-md backdrop-blur-md text-white'
        )}>
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

            {/* Turn Information */}
            <div>
              <h4 className="font-semibold mb-2 text-white">Turn Status</h4>
              <div className="text-sm text-white/80 space-y-1">
                <div>Time Remaining: {Math.ceil(timeRemaining / 1000)}s</div>
                <div>My Turn: {isMyTurn ? 'Yes' : 'No'}</div>
                <div>Available Actions: {currentTurn.availableActions.length}</div>
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
              className={ds(
                designSystem.interactive.primary.base,
                designSystem.interactive.primary.hover,
                'px-4 py-2 rounded-md'
              )}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

 