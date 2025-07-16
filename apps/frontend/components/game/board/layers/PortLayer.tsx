'use client'

import { Board, Port, HexCoordinate } from '@settlers/core'
import { PortPiece } from '../pieces/PortPiece'

interface PortLayerProps {
  board: Board
  hexSize?: number
}

// Hex coordinate to pixel position conversion
function hexToPixel(hex: HexCoordinate, size: number): { x: number; y: number } {
  const x = size * (3/2 * hex.q)
  const y = size * (Math.sqrt(3)/2 * hex.q + Math.sqrt(3) * hex.r)
  return { x, y }
}

// Calculate position between two hex centers for port placement
function getPortPosition(port: Port, hexSize: number): { x: number; y: number } {
  if (port.position.hexes.length < 2) {
    // Fallback to first hex center
    return hexToPixel(port.position.hexes[0], hexSize)
  }
  
  const hex1 = hexToPixel(port.position.hexes[0], hexSize)
  const hex2 = hexToPixel(port.position.hexes[1], hexSize)
  
  // Place port halfway between the two hex centers
  return {
    x: (hex1.x + hex2.x) / 2,
    y: (hex1.y + hex2.y) / 2
  }
}

export function PortLayer({ board, hexSize = 60 }: PortLayerProps) {
  if (!board.ports || board.ports.length === 0) {
    return null
  }

  return (
    <g className="port-layer">
      {board.ports.map((port) => {
        const position = getPortPosition(port, hexSize)
        
        return (
          <PortPiece
            key={port.id}
            port={port}
            position={position}
            size={36}
          />
        )
      })}
    </g>
  )
} 