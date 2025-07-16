'use client'

import { GameState, GameAction, PlayerId } from '@settlers/core'
import { PlayersPanel } from './PlayersPanel'
import { PlayerSidebar } from './PlayerSidebar'
import { DiceRoller } from './DiceRoller'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { LogOut, Info, RotateCcw, Palette, Play } from 'lucide-react'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'

interface GameInterfaceProps {
  gameState: GameState | null
  localPlayerId: string | null
  playerAvatars: Record<string, { avatar: string; name: string }>
  onAction?: (action: GameAction) => void
  onTurnTimeout?: () => void
  onRegenerateBoard?: () => void
}

export function GameInterface({ 
  gameState, 
  localPlayerId, 
  playerAvatars, 
  onAction, 
  onTurnTimeout,
  onRegenerateBoard
}: GameInterfaceProps) {

  const [showRestartDialog, setShowRestartDialog] = useState(false)
  const [showInfoDialog, setShowInfoDialog] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(120)

  // Get current player and determine if it's their turn
  const currentPlayer = gameState?.players.get(gameState.currentPlayer)
  const isMyTurn = localPlayerId === gameState?.currentPlayer
  const myPlayer = localPlayerId ? gameState?.players.get(localPlayerId) : null

  // Determine if player can roll dice
  const canRoll = isMyTurn && gameState?.phase === 'roll'

  // Timer countdown
  useEffect(() => {
    if (!gameState?.currentPlayer) return
    
    setTimeRemaining(120)
    
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          return 0 // Don't reset to 120 here, let separate effect handle timeout
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [gameState?.currentPlayer, gameState?.turn])

  // Handle timeout
  useEffect(() => {
    if (timeRemaining === 0 && onTurnTimeout) {
      onTurnTimeout()
    }
  }, [timeRemaining, onTurnTimeout])

  // Format time display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Handle game actions
  const handleAction = (action: GameAction) => {
    if (!localPlayerId || !onAction) {
      toast.error('Cannot perform action: Not connected to game')
      return
    }

    // Set the player ID for the action
    const actionWithPlayer = {
      ...action,
      playerId: localPlayerId
    }

    console.log('Sending game action:', actionWithPlayer)
    onAction(actionWithPlayer)
  }

  // Handle dice roll
  const handleDiceRoll = (action: GameAction) => {
    if (!canRoll) {
      toast.error('You cannot roll dice right now')
      return
    }
    handleAction(action)
  }

  // Handle end turn
  const handleEndTurn = () => {
    if (!isMyTurn) {
      toast.error('Not your turn')
      return
    }

    const endTurnAction: GameAction = {
      type: 'endTurn',
      playerId: localPlayerId!,
      data: {}
    }
    handleAction(endTurnAction)
  }

  // Don't render if no game state
  if (!gameState) {
    return (
      <div className="fixed inset-0 w-screen h-screen flex items-center justify-center bg-black/50">
        <div className="text-white text-xl">Loading game...</div>
      </div>
    )
  }

  return (
    <div className="absolute inset-0 w-full h-full pointer-events-none">
      {/* Game Header */}
      <div className="absolute top-4 left-4 right-4 z-20 pointer-events-auto">
        <div className="flex items-center justify-between bg-black/20 backdrop-blur-sm rounded-lg p-4 border border-white/20">
          {/* Left side - Game info */}
          <div className="flex items-center space-x-4">
            <div className="text-white">
              <div className="font-semibold">Turn {gameState.turn}</div>
              <div className="text-sm text-white/70">
                Phase: {gameState.phase} | {currentPlayer ? `${currentPlayer.name}'s turn` : 'Waiting...'}
              </div>
            </div>
            
            {/* Turn Timer */}
            <div className="text-white bg-black/30 px-3 py-1 rounded-md">
              <div className="text-sm font-mono">{formatTime(timeRemaining)}</div>
            </div>
          </div>

          {/* Right side - Action buttons */}
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowInfoDialog(true)}
            >
              <Info className="w-4 h-4" />
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={onRegenerateBoard}
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
            <Button 
              variant="destructive" 
              size="sm"
              onClick={() => setShowRestartDialog(true)}
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

             {/* Left Sidebar - My Player Info */}
       {myPlayer && (
         <div className="absolute left-4 top-24 bottom-4 z-20 pointer-events-auto w-80">
           <PlayerSidebar 
             gameState={gameState}
             localPlayer={myPlayer}
             isMyTurn={isMyTurn}
             onAction={handleAction}
             timeRemaining={timeRemaining}
           />
         </div>
       )}

       {/* Right Sidebar - Other Players */}
       <div className="absolute right-4 top-24 bottom-4 z-20 pointer-events-auto w-80">
         <PlayersPanel 
           gameState={gameState}
           playerAvatars={playerAvatars}
         />
       </div>

      {/* Bottom Center - Game Actions */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20 pointer-events-auto">
        <div className="flex items-center space-x-4">
          {/* Dice Roller */}
          <DiceRoller
            onRoll={handleDiceRoll}
            disabled={!isMyTurn}
            canRoll={canRoll}
            currentRoll={gameState.dice}
          />

          {/* End Turn Button */}
          {isMyTurn && gameState.phase === 'actions' && (
            <Button
              onClick={handleEndTurn}
              size="lg"
              variant="secondary"
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              End Turn
            </Button>
          )}

          {/* Phase-specific instructions */}
          <div className="bg-black/20 backdrop-blur-sm rounded-lg p-4 border border-white/20 text-white text-center max-w-md">
            <div className="text-sm">
              {getPhaseInstructions(gameState.phase, isMyTurn)}
            </div>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <Dialog open={showRestartDialog} onOpenChange={setShowRestartDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restart Game?</DialogTitle>
            <DialogDescription>
              This will end the current game and return you to the main menu. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRestartDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => window.location.href = '/'}>
              Restart Game
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showInfoDialog} onOpenChange={setShowInfoDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Game Information</DialogTitle>
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
      return "Move the robber to a new hex"
    case 'steal':
      return "Choose a player to steal from"
    case 'ended':
      return "Game Over!"
    default:
      return "Your turn"
  }
} 