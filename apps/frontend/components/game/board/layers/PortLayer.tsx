'use client'

import { Board } from '@settlers/game-engine'
import { PortPiece } from '../pieces/PortPiece'
import { hexToPixel } from '@/lib/board-utils'

interface PortLayerProps {
  board: Board
  hexSize?: number
}

export function PortLayer({ board, hexSize: _hexSize = 32 }: PortLayerProps) {
  if (!board.ports || board.ports.length === 0) {
    return null
  }

  return (
    <g className="port-layer">
      {board.ports.map((port) => {
        // Get the sea hex position where this port should be centered
        const seaHex = port.position.hexes[0]
        const seaHexPixelPos = hexToPixel(seaHex.q, seaHex.r)
        
        return (
          <g 
            key={port.id}
            transform={`translate(${seaHexPixelPos.x}, ${seaHexPixelPos.y})`}
          >
            <PortPiece
              port={port}
              position={{ x: 0, y: 0 }} // Port centered at (0,0) relative to sea hex
            />
          </g>
        )
      })}
    </g>
  )
} 