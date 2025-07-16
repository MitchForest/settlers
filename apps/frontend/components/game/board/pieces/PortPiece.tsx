'use client'

import { Port, ResourceType } from '@settlers/core'
import { useGameTheme } from '@/components/theme-provider'
import { TOKEN_DESIGN, PIECE_EMOJIS } from '../../../../lib/game-constants'

interface PortPieceProps {
  port: Port
  position: { x: number; y: number }
}

// Resource type to emoji mapping
const RESOURCE_EMOJIS: Record<ResourceType, string> = {
  wood: '🌲',
  brick: '🧱', 
  ore: '🪨',   // Rock emoji for ore ports
  wheat: '🌾',
  sheep: '🐑'
}

export function PortPiece({ port, position }: PortPieceProps) {
  const { theme } = useGameTheme()
  
  // Determine display content
  const isGeneric = port.type === 'generic'
  const emoji = isGeneric ? PIECE_EMOJIS.port : RESOURCE_EMOJIS[port.type as ResourceType]
  const ratio = `${port.ratio}:1`
  
  // Get port color for accent
  const portColor = isGeneric 
    ? TOKEN_DESIGN.borderColor // Use standard border color
    : theme?.resourceMapping?.[port.type as ResourceType]?.color || TOKEN_DESIGN.borderColor

  return (
    <g transform={`translate(${position.x}, ${position.y})`}>
      {/* Port circle background - standardized design */}
      <circle
        r={TOKEN_DESIGN.radius}
        fill={TOKEN_DESIGN.backgroundColor}
        stroke={portColor}
        strokeWidth={TOKEN_DESIGN.borderWidth}
        className="drop-shadow-md"
      />
      
      {/* Resource emoji */}
      <text
        y="-6"
        textAnchor="middle"
        fontSize={TOKEN_DESIGN.fontSize.emoji}
        fill={TOKEN_DESIGN.textColor}
        className="select-none pointer-events-none"
      >
        {emoji}
      </text>
      
      {/* Ratio text */}
      <text
        y="6"
        textAnchor="middle"
        fontSize={TOKEN_DESIGN.fontSize.ratio}
        fontWeight="600"
        fill={TOKEN_DESIGN.textColor}
        className="select-none pointer-events-none"
      >
        {ratio}
      </text>
    </g>
  )
} 