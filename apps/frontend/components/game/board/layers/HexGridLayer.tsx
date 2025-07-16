'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { HexTile, HexTileFilters } from './HexTile'
import { GameTheme, AssetResolver } from '@/lib/theme-types'
import { getAssetResolver } from '@/lib/theme-loader'
import { hexToPixel } from '@/lib/board-utils'
import type { Board, Hex } from '@settlers/core'



interface HexGridLayerProps {
  board: Board
  theme: GameTheme | null
  onHexSelect?: (hexId: string) => void
  selectedHexId?: string
  disableTransitions?: boolean
}

export const HexGridLayer: React.FC<HexGridLayerProps> = ({ 
  board, 
  theme, 
  onHexSelect,
  selectedHexId,
  disableTransitions = false
}) => {
  const [hoveredHexId, setHoveredHexId] = useState<string | null>(null)
  const [assetResolver, setAssetResolver] = useState<AssetResolver | null>(null)
  
  // Initialize asset resolver
  useEffect(() => {
    if (!theme) {
      setAssetResolver(null) // No theme = use geometric fallbacks
      return
    }
    
    const initResolver = async () => {
      try {
        const resolver = await getAssetResolver(theme)
        setAssetResolver(() => resolver)
      } catch (error) {
        console.error('Failed to load theme assets, using fallbacks:', error)
        setAssetResolver(null) // Fall back to geometric shapes on error
      }
    }
    initResolver()
  }, [theme])
  
  // Convert hexes to pixel coordinates for rendering
  const renderHexes = useMemo(() => {
    return Array.from(board.hexes.values()).map(hex => {
      const hexId = `${hex.position.q},${hex.position.r},${hex.position.s}`
      const pixelPos = hexToPixel(hex.position.q, hex.position.r, 32)
      
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

  const handleHexClick = (hexId: string, hex: Hex) => {
    // Only allow selection of filled hexes (not empty slots)
    const isEmptySlot = hex.terrain === null || hex.terrain === undefined
    if (!isEmptySlot && onHexSelect) {
      onHexSelect(hexId)
    }
  }

  const handleHexHover = (hexId: string | null) => {
    // Allow hover on all hexes, but empty ones show different cursor
    setHoveredHexId(hexId)
  }

  // CRITICAL FIX: Always render, assetResolver is optional
  // When assetResolver is null, HexTile components will use geometric fallbacks
  return (
    <div className="hex-grid-layer w-full h-full">
      <svg
        width="100%"
        height="100%"
        viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
        className="hex-grid-svg"
        style={{ background: 'transparent' }}
      >
        {/* Filter definitions */}
        <HexTileFilters />
        

        

        
        {/* Hex tiles - render with geometric fallbacks if no theme/assetResolver */}
        {sortedHexes.map(hex => {
          const isEmptySlot = hex.terrain === null || hex.terrain === undefined
          const isHovered = hoveredHexId === hex.id
          const isSelected = selectedHexId === hex.id
          
          return (
            <g
              key={hex.id}
              style={{ 
                cursor: isEmptySlot ? 'default' : 'pointer'
              }}
              onMouseEnter={() => handleHexHover(hex.id)}
              onMouseLeave={() => handleHexHover(null)}
              onClick={() => handleHexClick(hex.id, hex)}
            >
              <HexTile
                terrain={hex.terrain}
                numberToken={hex.numberToken}
                position={hex.pixelPosition}
                theme={theme} // Can be null - HexTile handles fallbacks
                assetResolver={assetResolver} // Can be null - HexTile handles fallbacks
                isHovered={isHovered}
                isSelected={isSelected}
                isEmpty={isEmptySlot}
                disableTransitions={disableTransitions}
              />
            </g>
          )
        })}
      </svg>
    </div>
  )
} 