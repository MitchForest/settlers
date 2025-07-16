'use client'

import { GameState, GameAction } from '@settlers/core'
import { PlayersPanel } from './PlayersPanel'
import { PlayerSidebar } from './PlayerSidebar'
import { DiceRoller } from './DiceRoller'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { LogOut, Info, RotateCcw, Palette, Play } from 'lucide-react'
import { useState, useEffect } from 'react'



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

  // Handle timeout separately to avoid setState during render
  useEffect(() => {
    if (timeRemaining === 0 && gameState?.currentPlayer) {
      onTurnTimeout?.()
      setTimeRemaining(120) // Reset after timeout is handled
    }
  }, [timeRemaining, gameState?.currentPlayer, onTurnTimeout])

  const handleGameAction = (action: GameAction) => {
    // Call external handler
    if (onAction) {
      onAction(action)
    }
  }

  const handleAuto = () => {
    // AI play functionality - to be implemented later
            // Handle auto play
  }

  const handleExit = () => {
    // Exit game functionality
            // Handle exit game
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
      <div className="relative w-full h-screen flex flex-col pointer-events-none">
      {/* 
        CONSISTENT SPACING CALCULATION - FINAL:
        - Top edge: 16px margin (top-4 = 16px)
        - Top bar: 80px height (h-20 = 80px) → ends at 96px from top
        - Gap: 16px (top-28 = 112px, so 112px - 96px = 16px gap)
        - Sidebar: fills space (top-28 to bottom: 112px) → ends at 112px from bottom
        - Gap: 16px (bottom bar starts at 96px from bottom: 112px - 96px = 16px gap)
        - Bottom bar: 80px height (bottom: 16px, height: 80px) → 16px-96px from bottom
        - Bottom edge: 16px margin
        Perfect 16px spacing everywhere!
      */}
      {/* Top Players Panel - FULL WIDTH FOR TESTING */}
      <PlayersPanel
        gameState={gameState}
        playerAvatars={playerAvatars}
      />

      {/* Left Sidebar - Wider for content */}
      <div className="absolute left-4 w-80 top-24 z-10 pointer-events-auto" style={{ bottom: 'calc(16px + var(--bottom-bar-height, 60px) + 16px)' }}>
        <PlayerSidebar
          gameState={gameState}
          localPlayer={localPlayer}
          isMyTurn={isMyTurn()}
          onAction={handleGameAction}
        />
      </div>

      {/* Floating Action Bar - Same width as sidebar */}
      <div className="absolute left-4 w-80 bottom-4 z-10 pointer-events-auto">
        <div className="flex items-center justify-between bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg p-2">
          {/* Turn Timer */}
          <div className="flex items-center space-x-2 px-2 py-1">
            <div className="text-right">
              <div className="text-xs text-white/60">Turn {gameState?.turn || 0}</div>
              <div className="text-sm font-mono text-white">
                {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
              </div>
            </div>
            
            {/* Timer Progress Bar */}
            <div className="w-8 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-1000 ${
                  timeRemaining / 120 > 0.5 ? 'bg-green-500' : 
                  timeRemaining / 120 > 0.25 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${(timeRemaining / 120) * 100}%` }}
              />
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center space-x-0.5">
            {/* Regenerate/Restart Button */}
            <Button
              size="icon"
              onClick={() => setShowRestartDialog(true)}
              className="h-8 w-8 bg-transparent hover:bg-white/10 text-white border-0"
              title={gameState?.turn === 0 ? 'Regenerate Board' : 'Restart Game'}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            
            {/* Theme Toggle Button */}
            <Button
              size="icon"
              onClick={() => {
                // TODO: Implement theme toggle (PNG vs plain backgrounds)
                // Toggle theme assets
              }}
              className="h-8 w-8 bg-transparent hover:bg-white/10 text-white border-0"
              title="Toggle Theme Assets"
            >
              <Palette className="h-4 w-4" />
            </Button>
            
            {/* Auto Mode Button */}
            <Button
              size="icon"
              onClick={handleAuto}
              disabled
              className="h-8 w-8 bg-transparent hover:bg-white/10 text-white/50 border-0 cursor-not-allowed"
              title="Auto Mode (Coming Soon)"
            >
              <Play className="h-4 w-4" />
            </Button>
            
            {/* Exit Button */}
            <Button
              size="icon"
              onClick={handleExit}
              disabled
              className="h-8 w-8 bg-transparent hover:bg-white/10 text-white/50 border-0 cursor-not-allowed"
              title="Exit Game (Coming Soon)"
            >
              <LogOut className="h-4 w-4" />
            </Button>
            
            {/* Info Button */}
            <Button
              size="icon"
              onClick={handleInfo}
              className="h-8 w-8 bg-transparent hover:bg-white/10 text-white border-0"
              title="Game Information"
            >
              <Info className="h-4 w-4" />
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
      
      {/* Restart/Regenerate Confirmation Dialog */}
      <Dialog open={showRestartDialog} onOpenChange={setShowRestartDialog}>
        <DialogContent className="bg-black/60 backdrop-blur-md border border-white/20 text-white">
          <DialogHeader>
            <DialogTitle>Game Actions</DialogTitle>
            <DialogDescription className="text-white/80">
              Choose an action below. These changes cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
            <Button 
              onClick={() => {
                setShowRestartDialog(false)
                // Call the regenerate function from parent
                onRegenerateBoard?.()
              }}
              className="bg-blue-600/80 hover:bg-blue-700/90 text-white border-0"
            >
              Regenerate Board
            </Button>
            <Button 
              onClick={() => {
                setShowRestartDialog(false)
                // TODO: Implement restart functionality
                // Handle game restart
              }}
              className="bg-orange-600/80 hover:bg-orange-700/90 text-white border-0"
            >
              Restart Game
            </Button>
            <Button 
              onClick={() => setShowRestartDialog(false)}
              variant="outline"
              className="bg-transparent border-white/40 text-white hover:bg-white/10"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Info Dialog */}
      <Dialog open={showInfoDialog} onOpenChange={setShowInfoDialog}>
        <DialogContent className="bg-black/60 backdrop-blur-md border border-white/20 text-white max-w-2xl max-h-[80vh] overflow-y-auto">
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