'use client'

import { HexGridLayer } from './layers/HexGridLayer'
import { ConnectionLayer } from './layers/ConnectionLayer'
import { InteractionLayer } from './layers/InteractionLayer'
import { PieceLayer } from './layers/PieceLayer'
import { PortLayer } from './layers/PortLayer'

import { useGameStore } from '@/stores/gameStore'
import { useGameTheme } from '@/components/theme-provider'

import { cn } from '@/lib/utils'
import { Board } from '@settlers/core'
import { useEffect, useRef } from 'react'
import { GameTheme } from '@/lib/theme-types'
import { useZoomPan } from '@/lib/use-zoom-pan'
import { useInteractionSystem } from '@/lib/interaction-system'
import { initializeBoardGrid } from '@/lib/board-utils'

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
  const { theme: contextTheme, loading } = useGameTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Use forceTheme if provided, otherwise use context theme
  const theme = forceTheme !== undefined ? forceTheme : contextTheme
  
  // Use prop board if provided, otherwise fall back to store
  const board = propBoard || gameState?.board
  
  // === UNIFIED INTERACTION SYSTEM ===
  const zoomPanControls = useZoomPan({
    viewportOffsets: {
      left: 400,       // Increased to shift board more to the right
      top: 96,         // Top bar height (estimated with padding)
      right: 0,        // No right UI elements
      bottom: 64       // Bottom button area height (h-12 + spacing)
    },
    initialViewBox: {
      x: -250,    // Zoomed in more (was -300)
      y: -250,    // Zoomed in more (was -300)
      width: 500, // Smaller view area for more zoom (was 600)
      height: 500 // Smaller view area for more zoom (was 600)
    }
  })
  const interactions = useInteractionSystem({
    viewBoxControls: zoomPanControls,
    containerRef
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
      className={cn(
        "fixed inset-0 w-screen h-screen overflow-hidden select-none",
        interactions.isPanning ? "cursor-grabbing" : "cursor-grab"
      )}
      style={{
        background: `linear-gradient(135deg, var(--color-game-bg-primary), var(--color-game-bg-secondary), var(--color-game-bg-accent))`
      }}
    >
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,var(--color-game-bg-primary)_0%,transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,var(--color-game-bg-accent)_0%,transparent_50%)]" />
      </div>
    
      {/* Hex Grid Layer - Main board rendering */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        <HexGridLayer
          board={board} 
          theme={theme}
          disableTransitions={false}
          viewBox={zoomPanControls.getViewBoxString()}
          onHexHover={interactions.onHexHover}
          onHexClick={interactions.onHexSelect}
        />
      </div>
      
      {/* Port Layer - renders ports around the board */}
      {board && (
        <div className="absolute inset-0 z-12 pointer-events-none">
          <svg
            width="100%"
            height="100%"
            viewBox={zoomPanControls.getViewBoxString()}
            className="port-layer-svg"
            style={{ background: 'transparent' }}
          >
            {/* Port components would go here */}
          </svg>
        </div>
      )}
      
      {/* Piece Layer: Game pieces (settlements, cities, roads) */}
      {gameState && (
        <div className="absolute inset-0 z-15 pointer-events-none">
          <svg
            width="100%"
            height="100%"
            viewBox={zoomPanControls.getViewBoxString()}
            className="piece-layer-svg"
            style={{ background: 'transparent' }}
          >
            {/* Test pieces would be rendered here */}
            
            {/* Real game pieces would go here when we implement them */}
            <PieceLayer 
              board={board} 
              gameState={gameState}
              hexSize={32}
              onSettlementClick={(_vertexId: string) => {/* Handle settlement click */}}
              onCityClick={(_vertexId: string) => {/* Handle city click */}}
              onRoadClick={(_edgeId: string) => {/* Handle road click */}}
            />
            
            {/* Render ports */}
            <PortLayer 
              board={board}
              hexSize={32}
            />
          </svg>
        </div>
      )}
      
      {/* Connection Layer: SVG for roads and buildings */}
      <div className="absolute inset-0 z-20 pointer-events-none">
        <ConnectionLayer viewBox={zoomPanControls.getViewBoxString()} />
      </div>

      {/* Interaction Layer: Overlays, tooltips, highlights */}
      <div className="absolute inset-0 z-30 pointer-events-none">
        {gameState && (
          <InteractionLayer 
          viewBox={zoomPanControls.getViewBoxString()}
          />
        )}
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