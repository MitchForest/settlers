'use client'

import { useEffect, use } from 'react'
import { GameBoard } from '@/components/game/board/GameBoard'
import { useGameStore } from '@/stores/gameStore'
import { GameFlowManager } from '@settlers/core'

interface GamePageProps {
  params: Promise<{ gameId: string }>
}

export default function GamePage({ params }: GamePageProps) {
  const resolvedParams = use(params)
  
  useEffect(() => {
    // Create a test game state for development
    const testGame = GameFlowManager.createGame({
      playerNames: ['Player 1', 'Player 2', 'Player 3'],
      gameId: resolvedParams.gameId
    })
    
    // Set the game state in the store
    useGameStore.setState({ 
      gameState: testGame.getState(),
      localPlayerId: testGame.getState().playerOrder[0]
    })
  }, [resolvedParams.gameId])
  
  return (
    <div 
      className="fixed inset-0 w-screen h-screen overflow-hidden"
      style={{
        background: `linear-gradient(135deg, var(--color-game-bg-primary), var(--color-game-bg-secondary), var(--color-game-bg-accent))`,
        margin: 0,
        padding: 0,
        top: 0,
        left: 0,
        zIndex: 0
      }}
    >
      <GameBoard />
    </div>
  )
} 