'use client'

import React from 'react'
import { GameState } from '@settlers/core'
import { hexToPixel, HEX_RADIUS } from '@/lib/board-utils'

interface InteractionLayerProps {
  gameState: GameState
  hoveredHexId?: string | null
  selectedHexId?: string | null
  viewBox?: string
}

export function InteractionLayer({ 
  gameState, 
  hoveredHexId, 
  selectedHexId,
  viewBox 
}: InteractionLayerProps) {
  // Calculate bounds for the SVG viewBox if not provided
  const defaultViewBox = viewBox || "0 0 400 400"
  
  return (
    <div className="interaction-layer w-full h-full">
      <svg
        width="100%"
        height="100%"
        viewBox={defaultViewBox}
        className="interaction-overlay-svg"
        style={{ background: 'transparent' }}
      >
        {/* Hover effect overlay */}
        {hoveredHexId && (
          <HexHighlight 
            hexId={hoveredHexId} 
            type="hover" 
            gameState={gameState}
          />
        )}
        
        {/* Selection effect overlay */}
        {selectedHexId && (
          <HexHighlight 
            hexId={selectedHexId} 
            type="selected" 
            gameState={gameState}
          />
        )}
      </svg>
    </div>
  )
}

interface HexHighlightProps {
  hexId: string
  type: 'hover' | 'selected'
  gameState: GameState
}

function HexHighlight({ hexId, type, gameState }: HexHighlightProps) {
  // Parse hex coordinates from ID
  const coords = hexId.split(',').map(Number)
  if (coords.length < 2) return null
  
  const [q, r] = coords
  const pixelPos = hexToPixel(q, r)
  
  // Create hex path using honeycomb calculations
  const points = []
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3
    const x = pixelPos.x + HEX_RADIUS * Math.cos(angle)
    const y = pixelPos.y + HEX_RADIUS * Math.sin(angle)
    points.push(`${x},${y}`)
  }
  const hexPath = `M${points.join('L')}Z`
  
  const isHover = type === 'hover'
  const isSelected = type === 'selected'
  
  return (
    <g className={`hex-highlight hex-highlight-${type}`}>
      {/* Hover effect: subtle white overlay that appears softly */}
      {isHover && (
        <>
          {/* Subtle translucent overlay */}
          <path
            d={hexPath}
            fill="rgba(255, 255, 255, 0.08)"
            className="transition-all duration-200 ease-out"
          />
          {/* Soft border glow */}
          <path
            d={hexPath}
            fill="none"
            stroke="rgba(255, 255, 255, 0.25)"
            strokeWidth={1}
            className="transition-all duration-200 ease-out"
          />
        </>
      )}
      
      {/* Selection highlight: more prominent but still subtle */}
      {isSelected && (
        <>
          <path
            d={hexPath}
            fill="var(--color-primary)"
            fillOpacity={0.06}
            className="transition-all duration-300 ease-out"
          />
          <path
            d={hexPath}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth={2}
            strokeOpacity={0.7}
            className="transition-all duration-300 ease-out"
          />
        </>
      )}
    </g>
  )
} 