'use client'

import React, { useMemo } from 'react'
import { Board } from '@settlers/core'
import { GameTheme } from '@/lib/theme-types'
import { hexToPixel } from '@/lib/board-utils'
import { HexTile } from './HexTile'
import { useGameStore } from '@/stores/gameStore'

interface HexGridLayerProps {
  board: Board
  theme: GameTheme | null
  disableTransitions?: boolean
  viewBox?: string // Override viewBox calculation
  onHexHover?: (hexId: string | null) => void
  onHexClick?: (hexId: string | null) => void
}

export const HexGridLayer: React.FC<HexGridLayerProps> = ({ 
  board, 
  theme, 
  disableTransitions = false,
  viewBox,
  onHexHover,
  onHexClick
}) => {
  // Get hex selection state from store
  const selectedHexId = useGameStore(state => state.selectedHex)
  const hoveredHexId = useGameStore(state => state.hoveredHex)
  
  // Convert hexes to pixel coordinates for rendering
  const renderHexes = useMemo(() => {
    return Array.from(board.hexes.values()).map(hex => {
      const hexId = `${hex.position.q},${hex.position.r},${hex.position.s}`
      const pixelPos = hexToPixel(hex.position.q, hex.position.r)
      
      return {
        ...hex,
        id: hexId,
        pixelPosition: pixelPos
      }
    })
  }, [board.hexes])
  
  // Calculate SVG viewBox to fit all hexes with padding
  const bounds = useMemo(() => {
    if (renderHexes.length === 0) {
      return { minX: 0, minY: 0, width: 400, height: 400 }
    }
    
    const positions = renderHexes.map(hex => hex.pixelPosition)
    
    const minX = Math.min(...positions.map(p => p.x)) - 50
    const maxX = Math.max(...positions.map(p => p.x)) + 50
    const minY = Math.min(...positions.map(p => p.y)) - 50  
    const maxY = Math.max(...positions.map(p => p.y)) + 50
    
    return {
      minX,
      minY,
      width: maxX - minX,
      height: maxY - minY
    }
  }, [renderHexes])
  
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

  // CRITICAL FIX: Always render, assetResolver is optional
  // When assetResolver is null, HexTile components will use geometric fallbacks
  return (
    <div className="hex-grid-layer w-full h-full">
      <svg
        width="100%"
        height="100%"
        viewBox={viewBox || `${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
        className="hex-grid-svg"
        style={{ background: 'transparent' }}
      >
        {/* Filter definitions */}
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
              onHexHover={onHexHover}
              onHexClick={onHexClick}
            />
          )
        })}
      </svg>
    </div>
  )
} 