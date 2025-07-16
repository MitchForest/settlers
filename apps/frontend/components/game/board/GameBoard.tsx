'use client'

import React, { useRef, useEffect } from 'react'
import { Board } from '@settlers/core'
import { useGameStore } from '@/stores/gameStore'

import { useGameTheme } from '@/components/theme-provider'
import { GameTheme } from '@/lib/theme-types'
import { HexGridLayer } from './layers/HexGridLayer'
import { PieceLayer } from './layers/PieceLayer'
import { PortLayer } from './layers/PortLayer'


import { initializeBoardGrid } from '@/lib/board-utils'
import { useSimplePanZoom } from '@/lib/use-simple-pan-zoom'

interface TestPiece {
  type: 'settlement' | 'city' | 'road'
  playerId: string
  position: { x: number, y: number }
  rotation?: number
}

interface GameBoardProps {
  board?: Board
  testPieces?: TestPiece[]
  onBoardClear?: (callback: () => void) => void
  disableTransitions?: boolean
  forceTheme?: GameTheme | null
}

export function GameBoard({ board: propBoard, onBoardClear, forceTheme }: GameBoardProps = {}) {
  // === UNIFIED STATE MANAGEMENT ===
  const gameState = useGameStore(state => state.gameState)
  const setHoveredHex = useGameStore(state => state.setHoveredHex)
  const setSelectedHex = useGameStore(state => state.setSelectedHex)
  const { theme: contextTheme, loading } = useGameTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Use forceTheme if provided, otherwise use context theme
  const theme = forceTheme !== undefined ? forceTheme : contextTheme
  
  // Use prop board if provided, otherwise fall back to store
  const board = propBoard || gameState?.board
  
  console.log('GameBoard render:', { 
    propBoard: !!propBoard, 
    storeBoard: !!gameState?.board, 
    finalBoard: !!board,
    gameState: !!gameState,
    boardHexCount: board?.hexes?.size || 0,
    firstFewHexes: board?.hexes ? Array.from(board.hexes.entries()).slice(0, 3) : []
  })
  
  // === UNIFIED INTERACTION SYSTEM ===
  // === NEW SIMPLE PAN/ZOOM SYSTEM ===
  const { transform, isDragging } = useSimplePanZoom(containerRef, {
    minScale: 0.3,    // Allow zooming out more to see full board
    maxScale: 3.0,    // Allow zooming in more for detail
    zoomStep: 0.05    // Much finer control for smooth zooming
  })
  
  // === INITIALIZATION ===
  
  // Initialize honeycomb grid when board loads
  useEffect(() => {
    if (board) {
      initializeBoardGrid(board)
    }
  }, [board])
  


  // Register board clear callback
  useEffect(() => {
    if (!onBoardClear) return

    const clearSelection = () => {
      // Clear board selection via game store
      useGameStore.getState().setSelectedHex(null)
      useGameStore.getState().setHoveredHex(null)
    }

    onBoardClear(clearSelection)
  }, [onBoardClear])
  

  
  // === RENDER ===
  
  // CRITICAL FIX: Only block if no board exists
  if (!board) {
    return (
      <div className="fixed inset-0 w-screen h-screen flex items-center justify-center">
        <div className="text-lg text-gray-500">
          No board data available
        </div>
      </div>
    )
  }
  
  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 w-screen h-screen overflow-hidden select-none"
      style={{
        cursor: isDragging ? 'grabbing' : 'grab',
        background: `linear-gradient(135deg, var(--color-game-bg-primary), var(--color-game-bg-secondary), var(--color-game-bg-accent))`
      }}
      onContextMenu={(e) => e.preventDefault()}
      tabIndex={0}
    >
      {/* Background pattern - stays fixed */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,var(--color-game-bg-primary)_0%,transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,var(--color-game-bg-accent)_0%,transparent_50%)]" />
      </div>
    
      {/* MAIN BOARD CONTENT - CSS Transform Applied Here */}
      <div 
        className="absolute inset-0 origin-center"
        style={{ 
          transform,
          pointerEvents: 'none'  // Let mouse events pass through to SVG elements
        }}
      >
        {/* Fixed-size SVG container with proper viewBox for hexagon board */}
        <svg 
          className="absolute"
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
            onHexClick={setSelectedHex}
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