'use client'

import React, { useEffect, useState, useRef } from 'react'
import { Board, GameAction } from '@settlers/game-engine'
import { GameTheme } from '@/lib/theme-types'
import { HexGridLayer } from './layers/HexGridLayer'
import { PortLayer } from './layers/PortLayer'
import { PieceLayer } from './layers/PieceLayer'
import { BuildingPlacementLayer } from './layers/BuildingPlacementLayer'
import { useGameStore } from '@/stores/gameStore'
import { useSimplePanZoom } from '@/lib/use-simple-pan-zoom'

interface GameBoardProps {
  board: Board
  theme: GameTheme | null
  onGameAction?: (action: GameAction) => void
  placementMode?: 'settlement' | 'city' | 'road' | null
  onPlacementModeChange?: (mode: 'settlement' | 'city' | 'road' | null) => void
}

export function GameBoard({ board, theme, onGameAction, placementMode, onPlacementModeChange }: GameBoardProps) {
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Get game state and hex interaction functions from store
  const gameState = useGameStore(state => state.gameState)
  const setHoveredHex = useGameStore(state => state.setHoveredHex)
  const setSelectedHex = useGameStore(state => state.setSelectedHex)
  const localPlayerId = useGameStore(state => state.localPlayerId)
  
  // Pan and zoom controls
  const { transform, isDragging, reset, zoomIn, zoomOut, canZoomIn, canZoomOut } = useSimplePanZoom(containerRef)

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
    <div 
      ref={containerRef}
      className="game-board relative w-full h-full bg-gradient-to-br from-blue-400 to-blue-600 overflow-hidden cursor-grab"
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
    >
      {/* Main board rendering */}
      <div 
        className="absolute inset-0 flex items-center justify-center"
        style={{ 
          pointerEvents: 'none',
          transform 
        }}
      >
        <svg
          className="board-svg"
          viewBox="-400 -400 800 800"
          style={{ 
            width: '800px', 
            height: '800px',
            pointerEvents: 'all'
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
          {gameState && localPlayerId && onGameAction && (
            <BuildingPlacementLayer
              board={board}
              gameState={gameState}
              localPlayerId={localPlayerId}
              isMyTurn={gameState.currentPlayer === localPlayerId}
              placementMode={placementMode || null}
              onGameAction={onGameAction}
              onModeChange={onPlacementModeChange || (() => {})}
            />
          )}
        </svg>
      </div>
      
      {/* Zoom Controls */}
      <div className="absolute top-4 right-4 z-50 flex flex-col gap-2">
        <button
          onClick={zoomIn}
          disabled={!canZoomIn}
          className="w-10 h-10 bg-black/70 text-white rounded-md hover:bg-black/90 disabled:opacity-50 flex items-center justify-center"
        >
          +
        </button>
        <button
          onClick={reset}
          className="w-10 h-10 bg-black/70 text-white rounded-md hover:bg-black/90 flex items-center justify-center text-xs"
        >
          ⌂
        </button>
        <button
          onClick={zoomOut}
          disabled={!canZoomOut}
          className="w-10 h-10 bg-black/70 text-white rounded-md hover:bg-black/90 disabled:opacity-50 flex items-center justify-center"
        >
          −
        </button>
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