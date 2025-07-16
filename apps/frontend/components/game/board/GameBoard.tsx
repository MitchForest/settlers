'use client'

import { HexGridLayer } from './layers/HexGridLayer'
import { ConnectionLayer } from './layers/ConnectionLayer'
import { InteractionLayer } from './layers/InteractionLayer'
import { PortLayer } from './layers/PortLayer'
import { PieceLayer } from './layers/PieceLayer'
import { GamePiece } from './pieces/GamePiece'
import { useGameStore } from '@/stores/gameStore'
import { useGameTheme } from '@/components/theme-provider'
import { getAssetResolver } from '@/lib/theme-loader'
import { cn } from '@/lib/utils'
import { Board } from '@settlers/core'
import { useState, useEffect, useRef } from 'react'
import { AssetResolver, GameTheme } from '@/lib/theme-types'
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

export function GameBoard({ board: propBoard, testPieces = [], onBoardClear, disableTransitions = false, forceTheme }: GameBoardProps = {}) {
  // === UNIFIED STATE MANAGEMENT ===
  const gameState = useGameStore(state => state.gameState)
  const placementMode = useGameStore(state => state.placementMode)
  const { theme: contextTheme, loading } = useGameTheme()
  const [assetResolver, setAssetResolver] = useState<AssetResolver | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Use forceTheme if provided, otherwise use context theme
  const theme = forceTheme !== undefined ? forceTheme : contextTheme
  
  // Use prop board if provided, otherwise fall back to store
  const board = propBoard || gameState?.board
  
  // === UNIFIED INTERACTION SYSTEM ===
  const zoomPanControls = useZoomPan()
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
  
  // Initialize asset resolver
  useEffect(() => {
    if (!theme) {
      setAssetResolver(null)
      return
    }
    
    const initResolver = async () => {
      try {
        const resolver = await getAssetResolver(theme)
        setAssetResolver(() => resolver)
      } catch (error) {
        console.error('Failed to load theme assets, using fallbacks:', error)
        setAssetResolver(null)
      }
    }
    initResolver()
  }, [theme])

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
    
      {/* Base Layer: Hex Grid for terrain */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        <HexGridLayer 
          board={board} 
          theme={theme}
          selectedHexId={interactions.selectedHexId || undefined}
          hoveredHexId={interactions.hoveredHexId || undefined}
          disableTransitions={disableTransitions}
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
      {(testPieces.length > 0 || gameState) && (
        <div className="absolute inset-0 z-15 pointer-events-none">
          <svg
            width="100%"
            height="100%"
            viewBox={zoomPanControls.getViewBoxString()}
            className="piece-layer-svg"
            style={{ background: 'transparent' }}
          >
            {/* Test pieces */}
            {testPieces.map((piece, index) => (
              <GamePiece 
                key={`test-${index}`}
                type={piece.type}
                playerId={piece.playerId}
                position={piece.position}
                theme={theme}
                assetResolver={assetResolver}
                rotation={piece.rotation}
              />
            ))}
            
            {/* Real game pieces would go here when we implement them */}
            <PieceLayer 
              board={board} 
              gameState={gameState || undefined}
              onSettlementClick={(vertexId: string) => {/* Handle settlement click */}}
              onCityClick={(vertexId: string) => {/* Handle city click */}}
              onRoadClick={(edgeId: string) => {/* Handle road click */}}
            />
          </svg>
        </div>
      )}
      
      {/* Connection Layer: SVG for roads and buildings */}
      {placementMode !== 'none' && (
        <div className="absolute inset-0 z-20 pointer-events-none">
          <ConnectionLayer />
        </div>
      )}
      
      {/* Interaction Layer: Overlays, tooltips, highlights */}
      <div className="absolute inset-0 z-30 pointer-events-none">
        {gameState && (
          <InteractionLayer 
            gameState={gameState}
            hoveredHexId={interactions.hoveredHexId}
            selectedHexId={interactions.selectedHexId}
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