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
      {/* City circle background - standardized design */}
      <circle
        r={TOKEN_DESIGN.radius}
        fill={TOKEN_DESIGN.backgroundColor}
        stroke={cssPlayerColor}
        strokeWidth={TOKEN_DESIGN.playerAccent.borderWidth}
        className={`drop-shadow-lg transition-all duration-200 ${
          isHighlighted ? 'scale-110 brightness-110' : ''
        }`}
      />
      
      {/* City emoji - changed from 🏙️ to 🏢 */}
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={TOKEN_DESIGN.fontSize.emoji}
        fill={TOKEN_DESIGN.textColor}
        className="select-none pointer-events-none"
      >
        {PIECE_EMOJIS.city}
      </text>
    </g>
  )
} 