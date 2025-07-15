'use client'

import { useMemo } from 'react'

export function ConnectionLayer() {
  // Calculate road/connection positions based on board layout
  const connections = useMemo(() => {
    // TODO: Generate connections between adjacent hexes
    // This is a placeholder - implement based on game logic
    return []
  }, [])
  
  return (
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
  )
} 