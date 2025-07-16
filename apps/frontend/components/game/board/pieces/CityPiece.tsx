'use client'

import { Building } from '@settlers/core'

interface CityPieceProps {
  building: Building
  position: { x: number; y: number }
  playerColor?: number // Player color index (0-3)
  size?: number
  isHighlighted?: boolean
  onClick?: () => void
}

export function CityPiece({ 
  building, 
  position, 
  playerColor = 0,
  size = 40, 
  isHighlighted = false,
  onClick 
}: CityPieceProps) {
  // Get player color using CSS variables
  const cssPlayerColor = `var(--player-${playerColor})`
  
  return (
    <g 
      transform={`translate(${position.x}, ${position.y})`}
      onClick={onClick}
      className={onClick ? 'cursor-pointer' : ''}
    >
      {/* City circle background */}
      <circle
        r={size / 2}
        fill={cssPlayerColor}
        stroke="white"
        strokeWidth="3"
        className={`drop-shadow-lg transition-all duration-200 ${
          isHighlighted ? 'scale-110 brightness-110' : ''
        }`}
      />
      
      {/* City emoji */}
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="20"
        className="select-none pointer-events-none"
      >
        🏙️
      </text>
    </g>
  )
} 