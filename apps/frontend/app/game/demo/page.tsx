'use client'

import { useEffect, useState, useCallback } from 'react'
import { useGameTheme } from '@/components/theme-provider'
import { GameBoard } from '@/components/game/board/GameBoard'
import { GameInterface } from '@/components/game/ui/GameInterface'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { GameAction, GameFlowManager, GameState } from '@settlers/core'
import { createDemoGameManager, generateDemoGame } from '@/lib/demo-game-generator'
import Link from 'next/link'
import { ArrowLeft, RotateCcw } from 'lucide-react'

export default function DemoGamePage() {
  // Theme loading
  const { theme, loading: themeLoading, loadTheme } = useGameTheme()
  
  // Local demo state (not connected to backend)
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [gameManager, setGameManager] = useState<GameFlowManager | null>(null)
  const [_localPlayerId, setLocalPlayerId] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  // Generate demo game when theme is loaded
  const generateDemo = useCallback(async () => {
    if (isGenerating) return

    setIsGenerating(true)
    try {
      // Generate demo game state
      const demoState = generateDemoGame()
      const manager = createDemoGameManager()
      
      setGameManager(manager)
      setGameState(demoState)
      
      // Set local player as Alice (first player)
      const playerIds = Array.from(demoState.players.keys())
      setLocalPlayerId(playerIds[0])
      
      toast.success('Demo game loaded! You are playing as Alice.')
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
        setGameState(gameManager.getState())
        toast.info('Some trade offers have expired')
      }
    }, 5000) // Check every 5 seconds

    return () => clearInterval(interval)
  }, [gameManager, gameState])

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
      setGameState(result.newState)
      
      // Handle specific action types with demo-appropriate messages
      switch (action.type) {
        case 'roll':
          const dice = result.newState.dice
          if (dice) {
            if (dice.sum === 7) {
              toast.warning(`Rolled ${dice.sum}! Robber activated! (Demo mode)`)
            } else {
              toast.success(`Rolled ${dice.die1} + ${dice.die2} = ${dice.sum}`)
            }
          }
          break
          
        case 'build':
          const placementEvent = result.events.find(e => e.type === 'placementModeStarted')
          if (placementEvent) {
            toast.info(`Demo: Click on the board to place your ${placementEvent.data.buildingType}`)
          }
          break
          
        case 'buyCard':
          toast.success('Development card purchased! (Demo mode)')
          break
          
        case 'endTurn':
          toast.info('Turn ended (Demo mode)')
          break
          
        default:
          if (result.message) {
            toast.success(`${result.message} (Demo mode)`)
          }
      }
      
      // Log events for debugging
      if (result.events.length > 0) {
        console.log('Demo: Game events:', result.events)
      }
    } else {
      // Show error message
      toast.error(result.error || 'Action failed (Demo mode)')
      console.error('Demo: Action failed:', result.error, action)
    }
  }

  // Reset demo game
  const resetDemo = () => {
    setGameState(null)
    setGameManager(null)
    setLocalPlayerId(null)
    generateDemo()
  }

  // Handle loading states
  if (themeLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          <div className="text-white text-lg">Loading demo theme...</div>
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
          <div className="text-white text-lg">Generating demo game...</div>
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

  return (
    <div className="min-h-screen bg-slate-900 relative">
      {/* Demo Header */}
      <div className="absolute top-4 left-4 right-4 z-50 flex justify-between items-center">
        <Link href="/">
          <Button variant="outline" size="sm" className="bg-black/50 backdrop-blur-sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </Link>
        
        <div className="bg-black/50 backdrop-blur-sm rounded-lg px-4 py-2">
          <span className="text-white text-sm font-medium">DEMO MODE</span>
        </div>
        
        <Button 
          onClick={resetDemo} 
          variant="outline" 
          size="sm" 
          className="bg-black/50 backdrop-blur-sm"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset Demo
        </Button>
      </div>

      {/* Main game display */}
      <div className="relative w-full h-full">
        {/* Game Board */}
        <GameBoard
          board={gameState.board}
          theme={theme}
          onGameAction={handleGameAction}
        />
        
        {/* Game Interface Overlay */}
        <GameInterface
          onGameAction={handleGameAction}
        />
      </div>
    </div>
  )
} 