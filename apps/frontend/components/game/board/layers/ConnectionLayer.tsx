'use client'

import { useMemo } from 'react'

interface ConnectionLayerProps {
  viewBox?: string
}

export function ConnectionLayer({ viewBox = "0 0 400 400" }: ConnectionLayerProps) {
  // Calculate road/connection positions based on board layout
  const connections = useMemo(() => {
    // TODO: Generate connections between adjacent hexes
    // This is a placeholder - implement based on game logic
    return []
  }, [])
  
  return (
    <svg
      width="100%"
      height="100%"
      viewBox={viewBox}
      className="connection-layer-svg"
      style={{ background: 'transparent' }}
    >
      <g className="connection-layer">
        {/* Roads and connections will be rendered here */}
        {connections.map((connection, index) => (
          <line
            key={index}
            stroke="var(--foreground)"
            strokeWidth="2"
            className="cursor-pointer hover:stroke-blue-500 transition-colors"
          />
        ))}
      </g>
    </svg>
  )
} 