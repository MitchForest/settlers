'use client'

import React, { useMemo } from 'react'
import { Board } from '@settlers/game-engine'
import { GameTheme } from '@/lib/theme-types'
import { hexToPixel } from '@/lib/board-utils'
import { HexTile } from './HexTile'
import { useGameStore } from '@/stores/gameStore'

interface HexGridLayerProps {
  board: Board
  theme: GameTheme | null
  disableTransitions?: boolean
  onHexHover?: (hexId: string | null) => void
  onHexClick?: (hexId: string | null) => void
}

export const HexGridLayer: React.FC<HexGridLayerProps> = ({ 
  board, 
  theme, 
  disableTransitions = false,
  onHexHover,
  onHexClick
}) => {
  // Get hex selection state from store
  const gameState = useGameStore(state => state.gameState)
  const selectedHexId = useGameStore(state => state.selectedHex)
  const hoveredHexId = useGameStore(state => state.hoveredHex)
  
  // Convert hexes to pixel coordinates for rendering
  const renderHexes = useMemo(() => {
    const hexes = Array.from(board.hexes.values()).map(hex => {
      const hexId = `${hex.position.q},${hex.position.r},${hex.position.s}`
      const pixelPos = hexToPixel(hex.position.q, hex.position.r)
      
      // Check if this hex has the robber
      const hasRobber = board.robberPosition && 
        hex.position.q === board.robberPosition.q &&
        hex.position.r === board.robberPosition.r &&
        hex.position.s === board.robberPosition.s
      
      // Check if player can move robber to this hex
      const canMoveRobber = gameState?.phase === 'moveRobber' && 
        gameState.players?.get(gameState.currentPlayer)?.id === gameState.currentPlayer &&
        !hasRobber && // Can't move to same hex
        hex.terrain !== 'sea' // Can't move to sea hexes
      
      return {
        ...hex,
        id: hexId,
        pixelPosition: pixelPos,
        hasRobber: hasRobber || false,
        canMoveRobber: canMoveRobber || false
      }
    })
    
    console.log('HexGridLayer renderHexes:', {
      totalHexes: hexes.length,
      robberPosition: board.robberPosition,
      gamePhase: gameState?.phase,
      hexesWithRobber: hexes.filter(h => h.hasRobber).length,
      canMoveRobberCount: hexes.filter(h => h.canMoveRobber).length
    })
    
    return hexes
  }, [board.hexes, board.robberPosition, gameState?.phase, gameState?.currentPlayer, gameState?.players])
  

  
  // Sort hexes for proper z-index rendering (selected/hovered on top)
  const sortedHexes = useMemo(() => {
    return [...renderHexes].sort((a, b) => {
      if (a.id === selectedHexId) return 1
      if (b.id === selectedHexId) return -1
      if (a.id === hoveredHexId) return 1  
      if (b.id === hoveredHexId) return -1
      return 0
    })
  }, [renderHexes, selectedHexId, hoveredHexId])

  // CRITICAL FIX: Return SVG elements directly, not wrapped in another SVG
  // This component now returns JSX to be rendered inside the parent SVG
  return (
    <g className="hex-grid-layer">
      {/* Filter definitions */}
      <defs>
        {/* Add any global filters here if needed */}
      </defs>
      
      {/* Hex tiles - render with geometric fallbacks if no theme/assetResolver */}
      {sortedHexes.map(hex => {
        const isEmptySlot = hex.terrain === null || hex.terrain === undefined
        const isHovered = hoveredHexId === hex.id
        const isSelected = selectedHexId === hex.id
        
        return (
          <HexTile
            key={hex.id}
            terrain={hex.terrain}
            numberToken={hex.numberToken}
            position={hex.pixelPosition}
            theme={theme} // Can be null - HexTile handles fallbacks
            assetResolver={null} // Asset resolver is no longer a prop, so pass null
            isHovered={isHovered}
            isSelected={isSelected}
            isEmpty={isEmptySlot}
            disableTransitions={disableTransitions}
            hexId={hex.id}
            hasRobber={hex.hasRobber}
            canMoveRobber={hex.canMoveRobber}
            onHexHover={onHexHover}
            onHexClick={onHexClick}
          />
        )
      })}
    </g>
  )
} 