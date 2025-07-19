'use client'

import { Road } from '@settlers/game-engine'
import { ROAD_DESIGN } from '../../../../lib/game-constants'

interface RoadPieceProps {
  road: Road
  startPosition: { x: number; y: number }
  endPosition: { x: number; y: number }
  playerColor?: number // Player color index (0-3)
  isHighlighted?: boolean
  onClick?: () => void
}

export function RoadPiece({ 
  startPosition, 
  endPosition, 
  playerColor = 0,
  isHighlighted = false,
  onClick 
}: RoadPieceProps) {
  // Get player color using CSS variables
  const cssPlayerColor = `var(--player-${playerColor})`
  
  return (
    <g onClick={onClick} className={onClick ? 'cursor-pointer' : ''}>
      {/* Road outline for better visibility */}
      <line
        x1={startPosition.x}
        y1={startPosition.y}
        x2={endPosition.x}
        y2={endPosition.y}
        stroke={ROAD_DESIGN.outlineColor}
        strokeWidth={ROAD_DESIGN.width + ROAD_DESIGN.outlineWidth * 2}
        strokeLinecap="round"
        className="opacity-80"
      />
      
      {/* Road line - player color */}
      <line
        x1={startPosition.x}
        y1={startPosition.y}
        x2={endPosition.x}
        y2={endPosition.y}
        stroke={cssPlayerColor}
        strokeWidth={ROAD_DESIGN.width}
        strokeLinecap="round"
        className={`drop-shadow-sm transition-all duration-200 ${
          isHighlighted ? 'brightness-110' : ''
        }`}
        style={{
          filter: isHighlighted ? 'drop-shadow(0 0 4px rgba(255,255,255,0.8))' : undefined
        }}
      />
    </g>
  )
} 