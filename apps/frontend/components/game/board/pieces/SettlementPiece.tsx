'use client'

import { Building, PlayerColor } from '@settlers/core'

interface SettlementPieceProps {
  building: Building
  position: { x: number; y: number }
  playerColor?: number // Player color index (0-3)
  size?: number
  isHighlighted?: boolean
  onClick?: () => void
}

export function SettlementPiece({ 
  building, 
  position, 
  playerColor = 0,
  size = 32, 
  isHighlighted = false,
  onClick 
}: SettlementPieceProps) {
  // Get player color using CSS variables
  const cssPlayerColor = `var(--player-${playerColor})`
  
  return (
    <g 
      transform={`translate(${position.x}, ${position.y})`}
      onClick={onClick}
      className={onClick ? 'cursor-pointer' : ''}
    >
      {/* Settlement circle background */}
      <circle
        r={size / 2}
        fill={cssPlayerColor}
        stroke="white"
        strokeWidth="2"
        className={`drop-shadow-md transition-all duration-200 ${
          isHighlighted ? 'scale-110 brightness-110' : ''
        }`}
      />
      
      {/* House emoji */}
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="16"
        className="select-none pointer-events-none"
      >
        🏠
      </text>
    </g>
  )
} 