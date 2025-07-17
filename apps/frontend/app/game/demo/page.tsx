'use client'

import { useEffect, useState, useCallback } from 'react'
import { useGameTheme } from '@/components/theme-provider'
import { GameBoard } from '@/components/game/board/GameBoard'
import { PlayerSidebar } from '@/components/game/ui/PlayerSidebar'
import { PlayersPanel } from '@/components/game/ui/PlayersPanel'
import { DiceRoller } from '@/components/game/ui/DiceRoller'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { GameAction, GameFlowManager } from '@settlers/core'
import { createDemoGameManager, generateDemoGame } from '@/lib/demo-game-generator'
import { useGameStore } from '@/stores/gameStore'
import { Home, RotateCcw, ChevronUp, ChevronDown, Palette, Play, LogOut, Info } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function DemoGamePage() {
  const router = useRouter()
  
  // Theme loading
  const { theme, loading: themeLoading, loadTheme } = useGameTheme()
  
  // Use game store for demo state so GameInterface can access it
  const { gameState, updateGameState, localPlayerId } = useGameStore()
  
  // Local demo state (not connected to backend)
  const [gameManager, setGameManager] = useState<GameFlowManager | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [panelCollapsed, setPanelCollapsed] = useState(false)
  const [showInfoDialog, setShowInfoDialog] = useState(false)

  // Generate demo game when theme is loaded
  const generateDemo = useCallback(async () => {
    if (isGenerating) return

    setIsGenerating(true)
    try {
      // Generate demo game state
      const demoState = generateDemoGame()
      const manager = createDemoGameManager()
      
      // Set local player as Alice (first player) BEFORE updating game state
      const playerIds = Array.from(demoState.players.keys())
      const aliceId = playerIds[0]
      
      // Double check that Alice exists in the game state
      if (!demoState.players.has(aliceId)) {
        console.error('Alice player ID not found in demo game state!', {
          aliceId,
          availablePlayerIds: playerIds
        })
        throw new Error('Demo game setup failed - Alice not found')
      }
      
      console.log('Demo game player setup:', {
        aliceId,
        playerIds,
        playersInState: Array.from(demoState.players.keys()),
        aliceExists: demoState.players.has(aliceId),
        alicePlayer: demoState.players.get(aliceId)
      })
      
      // Update both at the same time to ensure consistency
      useGameStore.setState({
        gameState: demoState,
        localPlayerId: aliceId
      })
      
      setGameManager(manager)
      
      console.log('Demo game generated successfully:', {
        players: demoState.players.size,
        phase: demoState.phase,
        turn: demoState.turn,
        aliceId,
        playerIds
      })
      
      // Verify the store state was updated
      setTimeout(() => {
        const storeState = useGameStore.getState()
        console.log('Store state after update:', {
          hasGameState: !!storeState.gameState,
          localPlayerId: storeState.localPlayerId,
          gamePhase: storeState.gameState?.phase
        })
      }, 100)
    } catch (error) {
      console.error('Failed to generate demo game:', error)
      toast.error('Failed to generate demo game')
    } finally {
      setIsGenerating(false)
    }
  }, [isGenerating])

  // Generate demo when theme is loaded
  useEffect(() => {
    if (theme && !gameState && !isGenerating) {
      generateDemo()
    }
  }, [theme, gameState, isGenerating, generateDemo])

  // Auto-load settlers theme when component mounts
  useEffect(() => {
    if (!theme && !themeLoading) {
      loadTheme('settlers').catch(error => {
        console.error('Failed to load settlers theme:', error)
        toast.error('Failed to load game theme')
      })
    }
  }, [theme, themeLoading, loadTheme])

  // Check for expired trades periodically
  useEffect(() => {
    if (!gameManager || !gameState) return

    const interval = setInterval(() => {
      const hadExpiredTrades = gameManager.cleanupExpiredTrades()
      if (hadExpiredTrades) {
        updateGameState(gameManager.getState())
        toast.info('Some trade offers have expired')
      }
    }, 5000) // Check every 5 seconds

    return () => clearInterval(interval)
  }, [gameManager, gameState, updateGameState])

  const handleGameAction = (action: GameAction) => {
    if (!gameManager || !gameState) {
      toast.error('Demo game not initialized')
      return
    }

    console.log('Demo: Processing action:', action)

    // Process the action through the game manager
    const result = gameManager.processAction(action)
    
    if (result.success) {
      // Update the local game state
      updateGameState(result.newState)
      
      // Handle specific action types with clean messages (no demo mode indicators)
      switch (action.type) {
        case 'roll':
          const dice = result.newState.dice
          if (dice) {
            if (dice.sum === 7) {
              toast.warning(`Rolled ${dice.sum}! Robber activated!`)
            } else {
              toast.success(`Rolled ${dice.die1} + ${dice.die2} = ${dice.sum}`)
            }
          }
          break
          
        case 'build':
          const placementEvent = result.events.find(e => e.type === 'placementModeStarted')
          if (placementEvent) {
            toast.info(`Click on the board to place your ${placementEvent.data.buildingType}`)
          }
          break
          
        case 'buyCard':
          toast.success('Development card purchased!')
          break
          
        case 'endTurn':
          toast.info('Turn ended')
          break
          
        default:
          if (result.message) {
            toast.success(result.message)
          }
      }
      
      // Log events for debugging
      if (result.events.length > 0) {
        console.log('Demo: Game events:', result.events)
      }
    } else {
      // Show error message
      toast.error(result.error || 'Action failed')
      console.error('Demo: Action failed:', result.error, action)
    }
  }

  // Reset demo game
  const resetDemo = () => {
    useGameStore.setState({ gameState: null, localPlayerId: null })
    setGameManager(null)
    generateDemo()
  }

  // Handle loading states
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

  if (isGenerating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          <div className="text-white text-lg">Loading demo...</div>
        </div>
      </div>
    )
  }

  if (!gameState || !gameManager) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-white text-xl">Demo game not loaded</div>
          <Button onClick={generateDemo} variant="outline">
            Generate Demo Game
          </Button>
        </div>
      </div>
    )
  }

  const myPlayer = gameState ? gameState.players.get(localPlayerId || '') : null
  const isMyTurn = gameState ? gameState.currentPlayer === localPlayerId : false

  return (
    <div className="h-screen bg-slate-900 relative overflow-hidden">
      {/* Main game display - EXACTLY like real game */}
      <div className="relative w-full h-full">
        {/* Game Board */}
        <GameBoard
          board={gameState.board}
          theme={theme}
          onGameAction={handleGameAction}
        />
        


        {/* Player Sidebar - Left side with proper spacing */}
        {localPlayerId && gameState && gameState.players.get(localPlayerId) && (
          <div className="fixed left-4 w-80 top-20 z-40" style={{ bottom: 'calc(16px + 48px + 16px)' }}>
            <PlayerSidebar
              gameState={gameState}
              localPlayer={gameState.players.get(localPlayerId)!}
              isMyTurn={isMyTurn}
              onAction={handleGameAction}
            />
          </div>
        )}

        {/* Players Panel - Top edge to edge */}
        {gameState && (
          <PlayersPanel
            gameState={gameState}
            playerAvatars={Object.fromEntries(
              Array.from(gameState.players.entries()).map(([id, player]) => [
                id, 
                { avatar: '👤', name: player.name }
              ])
            )}
          />
        )}

        {/* Floating Action Buttons - Below sidebar */}
        <div className="fixed left-4 w-80 bottom-4 z-40">
          <div className="flex flex-row justify-between">
            {/* Regenerate/Restart Button */}
            <Button
              size="icon"
              onClick={resetDemo}
              className="h-12 w-12 bg-black/30 backdrop-blur-sm hover:bg-black/40 text-white border border-white/20 rounded-lg"
              title="Regenerate Board"
            >
              <RotateCcw className="h-6 w-6" />
            </Button>
            
            {/* Theme Toggle Button */}
            <Button
              size="icon"
              onClick={() => {
                // TODO: Implement theme toggle (PNG vs plain backgrounds)
                // Toggle theme assets
              }}
              className="h-12 w-12 bg-black/30 backdrop-blur-sm hover:bg-black/40 text-white border border-white/20 rounded-lg"
              title="Toggle Theme Assets"
            >
              <Palette className="h-6 w-6" />
            </Button>
            
            {/* Auto Mode Button */}
            <Button
              size="icon"
              onClick={() => {
                // TODO: Implement auto mode
              }}
              disabled
              className="h-12 w-12 bg-black/30 backdrop-blur-sm hover:bg-black/40 text-white/50 border border-white/20 rounded-lg cursor-not-allowed"
              title="Auto Mode (Coming Soon)"
            >
              <Play className="h-6 w-6" />
            </Button>
            
            {/* Exit Button */}
            <Button
              size="icon"
              onClick={() => router.push('/')}
              className="h-12 w-12 bg-black/30 backdrop-blur-sm hover:bg-black/40 text-white border border-white/20 rounded-lg"
              title="Exit Game"
            >
              <LogOut className="h-6 w-6" />
            </Button>
            
            {/* Info Button */}
            <Button
              size="icon"
              onClick={() => setShowInfoDialog(true)}
              className="h-12 w-12 bg-black/30 backdrop-blur-sm hover:bg-black/40 text-white border border-white/20 rounded-lg"
              title="Game Information"
            >
              <Info className="h-6 w-6" />
            </Button>
          </div>
        </div>

        {/* Bottom Action Bar - Dice Roller */}
        {myPlayer && gameState && isMyTurn && gameState.phase === 'roll' && (
          <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-40">
            <DiceRoller
              onRoll={(_dice) => handleGameAction({
                type: 'roll',
                playerId: localPlayerId || '',
                data: {}
              })}
              canRoll={true}
            />
          </div>
        )}
      </div>

      {/* Small floating demo panel in bottom right */}
      <div className="fixed bottom-4 right-4 z-50">
        <Card className="bg-black/80 backdrop-blur-sm border-white/20 text-white">
          <div className="p-2">
            {panelCollapsed ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/60">Demo</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPanelCollapsed(false)}
                  className="h-6 w-6 p-0 text-white/60 hover:text-white"
                >
                  <ChevronUp className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-white/60">Demo Mode</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPanelCollapsed(true)}
                    className="h-6 w-6 p-0 text-white/60 hover:text-white"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push('/')}
                    className="h-8 px-2 text-white/80 hover:text-white hover:bg-white/10"
                  >
                    <Home className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetDemo}
                    className="h-8 px-2 text-white/80 hover:text-white hover:bg-white/10"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
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
                <div>Turn: {gameState?.turn || 0}</div>
                <div>Phase: {gameState?.phase || 'Loading'}</div>
                <div>Players: {gameState?.players.size || 0}</div>
                <div>Current Player: {Array.from(gameState?.players.values() || [])[0]?.name || 'Unknown'}</div>
              </div>
            </div>
            
            {gameState?.dice && (
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