'use client'

import React, { useEffect, useState } from 'react'
import { Board, GameAction } from '@settlers/core'
import { GameTheme } from '@/lib/theme-types'
import { HexGridLayer } from './layers/HexGridLayer'
import { PortLayer } from './layers/PortLayer'
import { PieceLayer } from './layers/PieceLayer'
import { useGameStore } from '@/stores/gameStore'

interface GameBoardProps {
  board: Board
  theme: GameTheme | null
  onGameAction?: (action: GameAction) => void
}

export function GameBoard({ board, theme, onGameAction }: GameBoardProps) {
  const [loading, setLoading] = useState(false)
  
  // Get game state and hex interaction functions from store
  const gameState = useGameStore(state => state.gameState)
  const setHoveredHex = useGameStore(state => state.setHoveredHex)
  const setSelectedHex = useGameStore(state => state.setSelectedHex)
  const localPlayerId = useGameStore(state => state.localPlayerId)

  // Track asset loading state
  useEffect(() => {
    if (!theme) {
      setLoading(false)
      return
    }

    setLoading(true)
    const timer = setTimeout(() => setLoading(false), 500)
    return () => clearTimeout(timer)
  }, [theme])

  // Enhanced hex click handler that supports robber movement
  const handleHexClick = (hexId: string | null) => {
    if (!hexId || !gameState || !localPlayerId) {
      setSelectedHex(hexId)
      return
    }

    // Check if this is robber movement phase
    if (gameState.phase === 'moveRobber' && gameState.currentPlayer === localPlayerId) {
      // Parse hex coordinates from hexId
      const coords = hexId.split(',').map(Number)
      if (coords.length >= 3) {
        const [q, r, s] = coords
        
        // Check if this hex is different from current robber position
        const currentRobber = board.robberPosition
        if (!currentRobber || currentRobber.q !== q || currentRobber.r !== r || currentRobber.s !== s) {
          // Find the hex to ensure it's not sea
          const targetHex = Array.from(board.hexes.values()).find(hex => 
            hex.position.q === q && hex.position.r === r && hex.position.s === s
          )
          
          if (targetHex && targetHex.terrain !== 'sea') {
            // Create moveRobber action
            const action = {
              type: 'moveRobber' as const,
              playerId: localPlayerId,
              data: {
                hexPosition: { q, r, s }
              }
            }
            
            if (onGameAction) {
              onGameAction(action)
            }
            return
          }
        }
      }
    }

    // Default hex selection behavior
    setSelectedHex(hexId)
  }

  console.log('GameBoard render:', {
    boardExists: !!board,
    themeExists: !!theme,
    hexCount: board?.hexes?.size || 0,
    gamePhase: gameState?.phase,
    canMoveRobber: gameState?.phase === 'moveRobber' && gameState?.currentPlayer === localPlayerId
  })

  return (
    <div className="game-board relative w-full h-full bg-gradient-to-br from-blue-400 to-blue-600 overflow-hidden">
      {/* Main board rendering */}
      <div 
        className="absolute inset-0 flex items-center justify-center"
        style={{ pointerEvents: 'none' }}  // Disable pointer events on container
      >
        <svg
          className="board-svg"
          viewBox="-400 -400 800 800"
          style={{ 
            width: '800px', 
            height: '800px',
            left: '50%',
            top: '50%',
            marginLeft: '-400px',
            marginTop: '-400px',
            pointerEvents: 'all'  // Re-enable pointer events for SVG content
          }}
        >
          <HexGridLayer
            board={board} 
            theme={theme}
            disableTransitions={false}
            onHexHover={setHoveredHex}
            onHexClick={handleHexClick}
          />
          <PortLayer board={board} />
          <PieceLayer board={board} />
        </svg>
      </div>
      
      {/* Theme loading indicator (optional, non-blocking) */}
      {loading && (
        <div className="absolute top-4 left-4 z-50 bg-black/50 text-white px-3 py-1 rounded-md text-sm">
          Loading theme...
        </div>
      )}
    </div>
  )
} 