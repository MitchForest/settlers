'use client'

import { Port, ResourceType } from '@settlers/core'
import { useGameTheme } from '@/components/theme-provider'

interface PortPieceProps {
  port: Port
  position: { x: number; y: number }
  size?: number
}

// Resource type to emoji mapping
const RESOURCE_EMOJIS: Record<ResourceType, string> = {
  wood: '🌲',
  brick: '🧱', 
  ore: '⛏️',
  wheat: '🌾',
  sheep: '🐑'
}

export function PortPiece({ port, position, size = 40 }: PortPieceProps) {
  const { theme } = useGameTheme()
  
  // Determine display content
  const isGeneric = port.type === 'generic'
  const emoji = isGeneric ? '❓' : RESOURCE_EMOJIS[port.type as ResourceType]
  const ratio = `${port.ratio}:1`
  
  // Get port color
  const portColor = isGeneric 
    ? 'rgb(107, 114, 128)' // gray-500
    : theme?.resourceMapping?.[port.type as ResourceType]?.color || 'rgb(107, 114, 128)'

  return (
    <g transform={`translate(${position.x}, ${position.y})`}>
      {/* Port circle background */}
      <circle
        r={size / 2}
        fill="white"
        stroke={portColor}
        strokeWidth="3"
        className="drop-shadow-md"
      />
      
      {/* Resource emoji */}
      <text
        y="-8"
        textAnchor="middle"
        fontSize="16"
        className="select-none pointer-events-none"
      >
        {emoji}
      </text>
      
      {/* Ratio text */}
      <text
        y="8"
        textAnchor="middle"
        fontSize="12"
        fontWeight="600"
        fill={portColor}
        className="select-none pointer-events-none"
      >
        {ratio}
      </text>
    </g>
  )
} 