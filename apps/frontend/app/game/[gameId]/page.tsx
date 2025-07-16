'use client'

import { use, useEffect, useState, useCallback } from 'react'
import { useGameTheme } from '@/components/theme-provider'
import { GameBoard } from '@/components/game/board/GameBoard'
import { GameInterface } from '@/components/game/ui/GameInterface'
import { generateBoard } from '@settlers/core'
import type { Board, GameAction } from '@settlers/core'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'

interface GamePageProps {
  params: Promise<{ gameId: string }>
}

export default function GamePage({ params }: GamePageProps) {
  // Unwrap the params promise using React.use()
  const { gameId } = use(params)
  
  const { theme, loading: themeLoading, loadTheme } = useGameTheme()
  const [board, setBoard] = useState<Board | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showInterface, setShowInterface] = useState(true)

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
      toast.success('Board generated successfully!')
    } catch (error) {
      console.error('Failed to generate board:', error)
      toast.error('Failed to generate board')
    } finally {
      setIsGenerating(false)
    }
  }, [theme])

  // Auto-load settlers theme when component mounts
  useEffect(() => {
    if (!theme && !themeLoading) {
      loadTheme('settlers').catch(error => {
        console.error('Failed to load settlers theme:', error)
        toast.error('Failed to load game theme')
      })
    }
  }, [theme, themeLoading, loadTheme])

  // Generate test board when theme is loaded
  useEffect(() => {
    if (theme && !board && !isGenerating) {
      generateTestBoard()
    }
  }, [theme, board, isGenerating, generateTestBoard])

  const regenerateBoard = () => {
    setBoard(null)
    generateTestBoard()
  }

  const handleGameAction = (action: GameAction) => {
    console.log('Game action:', action)
    // TODO: Integrate with board interactions
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Toggle Interface Button */}
      <div className="fixed top-4 right-4 z-50">
        <Button
          onClick={() => setShowInterface(!showInterface)}
          variant="outline"
          size="sm"
        >
          {showInterface ? 'Hide UI' : 'Show UI'}
        </Button>
      </div>

      {/* Game Board */}
      <div className="absolute inset-0">
        {board ? (
          <GameBoard board={board} />
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
      </div>

      {/* Game Interface Overlay */}
      {showInterface && (
        <div className="fixed inset-0 z-40 pointer-events-none">
          <div className="h-full flex">
            {/* Left side - Game Interface */}
            <div className="w-1/3 max-w-md p-4 pointer-events-auto">
              <div className="h-full overflow-y-auto">
                <GameInterface onAction={handleGameAction} />
              </div>
            </div>
            
            {/* Right side - Board controls */}
            <div className="flex-1 flex flex-col justify-between p-4">
              {/* Top controls */}
              <div className="flex justify-start">
                {board && (
                  <Button 
                    onClick={regenerateBoard}
                    variant="outline"
                    disabled={isGenerating}
                    className="pointer-events-auto"
                  >
                    {isGenerating ? 'Generating...' : 'Regenerate Board'}
                  </Button>
                )}
              </div>

              {/* Bottom status */}
              <div className="flex justify-end">
                <Card className="bg-black/50 rounded-lg p-3 backdrop-blur-sm text-white text-sm pointer-events-auto">
                  Game ID: {gameId} | 
                  Theme: {theme.meta.name} |
                  Board: {board ? 'Generated' : 'None'}
                </Card>
              </div>
            </div>
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