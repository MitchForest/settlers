'use client'

import { Road } from '@settlers/core'

interface RoadPieceProps {
  road: Road
  startPosition: { x: number; y: number }
  endPosition: { x: number; y: number }
  playerColor?: number // Player color index (0-3)
  width?: number
  isHighlighted?: boolean
  onClick?: () => void
}

export function RoadPiece({ 
  startPosition, 
  endPosition, 
  playerColor = 0,
  width = 8, 
  isHighlighted = false,
  onClick 
}: RoadPieceProps) {
  // Get player color using CSS variables
  const cssPlayerColor = `var(--player-${playerColor})`
  
  return (
    <g onClick={onClick} className={onClick ? 'cursor-pointer' : ''}>
      {/* Road line */}
      <line
        x1={startPosition.x}
        y1={startPosition.y}
        x2={endPosition.x}
        y2={endPosition.y}
        stroke={cssPlayerColor}
        strokeWidth={width}
        strokeLinecap="round"
        className={`drop-shadow-sm transition-all duration-200 ${
          isHighlighted ? 'brightness-110' : ''
        }`}
        style={{
          filter: isHighlighted ? 'drop-shadow(0 0 4px rgba(255,255,255,0.8))' : undefined
        }}
      />
      
      {/* White outline for better visibility */}
      <line
        x1={startPosition.x}
        y1={startPosition.y}
        x2={endPosition.x}
        y2={endPosition.y}
        stroke="white"
        strokeWidth={width + 2}
        strokeLinecap="round"
        className="opacity-40"
        style={{ zIndex: -1 }}
      />
    </g>
  )
} 