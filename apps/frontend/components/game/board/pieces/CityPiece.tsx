'use client'

import { Building } from '@settlers/core'
import { TOKEN_DESIGN, PIECE_EMOJIS } from '../../../../lib/game-constants'

interface CityPieceProps {
  building: Building
  position: { x: number; y: number }
  playerColor?: number // Player color index (0-3)
  isHighlighted?: boolean
  onClick?: () => void
}

export function CityPiece({ 
  position, 
  playerColor = 0,
  isHighlighted = false,
  onClick 
}: CityPieceProps) {
  // Get player color using CSS variables for subtle accent
  const cssPlayerColor = `var(--player-${playerColor})`
  
  return (
    <g 
      transform={`translate(${position.x}, ${position.y})`}
      onClick={onClick}
      className={onClick ? 'cursor-pointer' : ''}
    >
      {/* City circle background - solid team color */}
      <circle
        r={TOKEN_DESIGN.radius}
        fill={cssPlayerColor}
        stroke={TOKEN_DESIGN.borderColor}
        strokeWidth={TOKEN_DESIGN.borderWidth}
        className={`drop-shadow-lg transition-all duration-200 ${
          isHighlighted ? 'scale-110 brightness-110' : ''
        }`}
      />
      
      {/* City emoji on top of colored background */}
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={TOKEN_DESIGN.fontSize.emoji}
        fill="white"
        className="select-none pointer-events-none"
        style={{
          textShadow: '0 1px 2px rgba(0,0,0,0.5)',
          fontWeight: 'bold'
        }}
      >
        {PIECE_EMOJIS.city}
      </text>
    </g>
  )
} 