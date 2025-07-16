'use client'

import { use, useEffect, useState, useCallback } from 'react'
import { useGameTheme } from '@/components/theme-provider'
import { GameBoard } from '@/components/game/board/GameBoard'
import { generateBoard } from '@settlers/core'
import type { Board } from '@settlers/core'
import { Button } from '@/components/ui/button'
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

      {/* Controls */}
      {board && (
        <div className="fixed top-4 left-4 space-y-2 z-40">
          <Button 
            onClick={regenerateBoard}
            variant="outline"
            disabled={isGenerating}
          >
            {isGenerating ? 'Generating...' : 'Regenerate Board'}
          </Button>
        </div>
      )}

      {/* Status Bar */}
      <div className="fixed bottom-4 right-4 bg-black/50 rounded-lg p-3 backdrop-blur-sm text-white text-sm">
        Game ID: {gameId} | 
        Theme: {theme.meta.name} |
        Board: {board ? 'Generated' : 'None'}
      </div>
    </div>
  )
} 