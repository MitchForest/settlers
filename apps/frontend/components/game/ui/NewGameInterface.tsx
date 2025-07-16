'use client'

import { GameState, GameAction } from '@settlers/core'
import { PlayersPanel } from './PlayersPanel'
import { PlayerSidebar } from './PlayerSidebar'
import { DiceRoller } from './DiceRoller'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Bot, LogOut, Info } from 'lucide-react'
import { useState, useEffect } from 'react'

// Turn Timer Component
interface TurnTimerProps {
  timeRemaining: number
  turnTimeLimit: number
  currentTurn: number
}

function TurnTimer({ timeRemaining, turnTimeLimit, currentTurn }: TurnTimerProps) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getProgressColor = (percentage: number) => {
    if (percentage > 50) return 'bg-green-500'
    if (percentage > 25) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  return (
    <div className="flex items-center space-x-3 bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg px-4 py-3">
      <div className="text-right">
        <div className="text-xs text-white/60">Turn {currentTurn}</div>
        <div className="text-sm font-mono text-white">
          {formatTime(timeRemaining)}
        </div>
      </div>
      
      {/* Timer Progress Bar */}
      <div className="w-12 h-2 bg-white/20 rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all duration-1000 ${getProgressColor((timeRemaining / turnTimeLimit) * 100)}`}
          style={{ width: `${(timeRemaining / turnTimeLimit) * 100}%` }}
        />
      </div>
    </div>
  )
}

interface NewGameInterfaceProps {
  gameState: GameState | null
  localPlayerId: string | null
  playerAvatars: Record<string, { avatar: string; name: string }>
  onAction?: (action: GameAction) => void
  onTurnTimeout?: () => void
}

export function NewGameInterface({ 
  gameState, 
  localPlayerId, 
  playerAvatars, 
  onAction, 
  onTurnTimeout
}: NewGameInterfaceProps) {

  const [showRestartDialog, setShowRestartDialog] = useState(false)
  const [showInfoDialog, setShowInfoDialog] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(120)

  // Timer countdown
  useEffect(() => {
    if (!gameState?.currentPlayer) return
    
    setTimeRemaining(120)
    
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          onTurnTimeout?.()
          return 120
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [gameState?.currentPlayer, gameState?.turn, onTurnTimeout])

  const handleGameAction = (action: GameAction) => {
    // Call external handler
    if (onAction) {
      onAction(action)
    }
  }

  const handleAuto = () => {
    // AI play functionality - to be implemented later
    console.log('Auto play')
  }

  const handleExit = () => {
    // Exit game functionality
    console.log('Exit game')
  }

  const handleInfo = () => {
    setShowInfoDialog(true)
  }


  const getLocalPlayer = () => {
    if (!gameState || !localPlayerId) return null
    return gameState.players.get(localPlayerId) || null
  }

  const isMyTurn = () => {
    return gameState?.currentPlayer === localPlayerId
  }

  if (!gameState || !localPlayerId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-white">Loading game...</div>
      </div>
    )
  }

  const localPlayer = getLocalPlayer()
  if (!localPlayer) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-white">Player not found</div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-screen flex flex-col">
      {/* Top Players Panel */}
      <div className="absolute top-4 left-4 right-4 z-20">
        <PlayersPanel
          gameState={gameState}
          playerAvatars={playerAvatars}
        />
      </div>

      {/* Left Sidebar - positioned below top panel to avoid overlap */}
      <div className="absolute left-4 top-24 bottom-20 w-80 z-10">
        <PlayerSidebar
          gameState={gameState}
          localPlayer={localPlayer}
          isMyTurn={isMyTurn()}
          onAction={handleGameAction}
        />
      </div>

      {/* Control Buttons and Timer - Bottom left */}
      <div className="absolute left-4 bottom-4 z-10">
        <div className="flex items-center space-x-4">
          {/* Turn Timer */}
          <TurnTimer 
            timeRemaining={timeRemaining}
            turnTimeLimit={120}
            currentTurn={gameState?.turn || 0}
          />
          
          {/* Control Buttons */}
          <div className="flex space-x-3">
            
            <Button
              size="icon"
              onClick={handleAuto}
              disabled
              className="h-12 w-12 bg-black/30 backdrop-blur-sm border border-white/20 text-white/50 cursor-not-allowed"
            >
              <Bot className="h-5 w-5" />
            </Button>
            
            <Button
              size="icon"
              onClick={handleExit}
              disabled
              className="h-12 w-12 bg-black/30 backdrop-blur-sm border border-white/20 text-white/50 cursor-not-allowed"
            >
              <LogOut className="h-5 w-5" />
            </Button>
            
            <Button
              size="icon"
              onClick={handleInfo}
              className="h-12 w-12 bg-black/30 backdrop-blur-sm border border-white/20 text-white hover:bg-white/10 transition-colors"
            >
              <Info className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Dice Roller (center-bottom when needed) */}
      {gameState.phase === 'roll' && isMyTurn() && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10">
          <DiceRoller
            onRoll={() => {
              handleGameAction({
                type: 'roll',
                playerId: localPlayerId,
                data: {}
              })
            }}
            disabled={false}
          />
        </div>
      )}
      
      {/* Restart Confirmation Dialog */}
      <Dialog open={showRestartDialog} onOpenChange={setShowRestartDialog}>
        <DialogContent className="bg-black/90 backdrop-blur-sm border border-white/20 text-white">
          <DialogHeader>
            <DialogTitle>Restart Game</DialogTitle>
            <DialogDescription className="text-white/70">
              Are you sure you want to restart the game? All progress will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowRestartDialog(false)}
              className="border-white/20 text-white hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button 
              onClick={() => {
                setShowRestartDialog(false)
                // TODO: Implement restart functionality
                console.log('Restarting game...')
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Restart
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Info Dialog */}
      <Dialog open={showInfoDialog} onOpenChange={setShowInfoDialog}>
        <DialogContent className="bg-black/90 backdrop-blur-sm border border-white/20 text-white max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Game Information</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 text-sm">
            {/* Building Costs */}
            <div>
              <h3 className="font-semibold text-white mb-3">Building Costs</h3>
              <div className="space-y-2 bg-white/10 rounded p-3">
                <div className="flex justify-between items-center">
                  <span>🏠 Settlement</span>
                  <div className="flex space-x-1">
                    <span>🌲</span><span>🧱</span><span>🌾</span><span>🐑</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span>🏙️ City</span>
                  <div className="flex space-x-1">
                    <span>🌾🌾</span><span>⛏️⛏️⛏️</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span>🛤️ Road</span>
                  <div className="flex space-x-1">
                    <span>🌲</span><span>🧱</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span>📜 Development Card</span>
                  <div className="flex space-x-1">
                    <span>🌾</span><span>🐑</span><span>⛏️</span>
                  </div>
                </div>
              </div>
            </div>

            {/* How to Play */}
            <div>
              <h3 className="font-semibold text-white mb-3">How to Play</h3>
              <div className="space-y-2 text-white/80">
                <p><strong>Goal:</strong> Be the first to reach 10 victory points</p>
                <p><strong>Turn Structure:</strong></p>
                <ul className="list-disc ml-4 space-y-1">
                  <li>Roll dice to produce resources</li>
                  <li>Trade resources with other players or the bank</li>
                  <li>Build roads, settlements, cities, or buy development cards</li>
                  <li>End your turn</li>
                </ul>
                <p><strong>Victory Points:</strong></p>
                <ul className="list-disc ml-4 space-y-1">
                  <li>Settlement = 1 point</li>
                  <li>City = 2 points</li>
                  <li>Longest Road = 2 points (5+ roads)</li>
                  <li>Largest Army = 2 points (3+ knights)</li>
                  <li>Victory Point development cards = 1 point each</li>
                </ul>
              </div>
            </div>

            {/* Resources */}
            <div>
              <h3 className="font-semibold text-white mb-3">Resources</h3>
              <div className="grid grid-cols-2 gap-2 text-white/80">
                <div>🌲 Wood (Forest)</div>
                <div>🧱 Brick (Hills)</div>
                <div>⛏️ Ore (Mountains)</div>
                <div>🌾 Wheat (Fields)</div>
                <div>🐑 Sheep (Pasture)</div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
} 