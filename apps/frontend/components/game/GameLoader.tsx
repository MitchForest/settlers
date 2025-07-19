'use client'

import { useEffect, useState } from 'react'
import { useGameStore } from '@/stores/gameStore'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

interface GameLoaderProps {
  players: unknown[]
  onLoaded: (packages: { gameEngine: unknown; aiSystem: unknown | null }) => void
  children: React.ReactNode
}

export function GameLoader({ players, onLoaded, children }: GameLoaderProps) {
  const { loadGamePackages, isLoading, error, gameEngine, aiSystem } = useGameStore()
  const [progress, setProgress] = useState(0)
  
  useEffect(() => {
    if (!gameEngine && !isLoading && !error) {
      // Start loading packages
      loadGamePackages()
        .catch(console.error)
    }
  }, [players, loadGamePackages, gameEngine, isLoading, error])
  
  useEffect(() => {
    if (gameEngine && !isLoading) {
      // Call onLoaded when packages are ready
      onLoaded({ gameEngine, aiSystem })
    }
  }, [gameEngine, aiSystem, isLoading, onLoaded])
  
  useEffect(() => {
    if (isLoading) {
      // Simulate progress for better UX
      const interval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90))
      }, 200)
      
      return () => clearInterval(interval)
    } else if (gameEngine) {
      setProgress(100)
    }
  }, [isLoading, gameEngine])
  
  if (error) {
    return (
      <Card className="m-4">
        <CardContent className="p-6 text-center">
          <h3 className="text-lg font-semibold text-red-600 mb-2">Loading Error</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={() => loadGamePackages().then(() => onLoaded({ gameEngine, aiSystem }))}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </CardContent>
      </Card>
    )
  }
  
  if (isLoading || !gameEngine) {
    const hasAI = players.some((p: unknown) => {
      if (typeof p !== 'object' || p === null) return false
      const player = p as Record<string, unknown>
      return player.playerType === 'ai' || player.isAI === true
    })
    
    return (
      <Card className="m-4">
        <CardContent className="p-6 text-center">
          <h3 className="text-lg font-semibold mb-4">🎮 Loading Game Engine</h3>
          
          <div className="space-y-4">
            <div className="text-sm text-gray-600">
              Loading game engine{hasAI ? ' and AI system' : ''}...
            </div>
            
            <Progress value={progress} className="w-full" />
            
            <div className="text-xs text-gray-500">
              {progress < 50 && '📦 Downloading game engine...'}
              {progress >= 50 && progress < 90 && hasAI && '🤖 Loading AI system...'}
              {progress >= 90 && '⚡ Initializing...'}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }
  
  return <>{children}</>
} 