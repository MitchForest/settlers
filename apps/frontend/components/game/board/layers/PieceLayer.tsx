'use client'

import { Board, Vertex, Edge, GameState } from '@settlers/core'
import { SettlementPiece } from '../pieces/SettlementPiece'
import { CityPiece } from '../pieces/CityPiece'
import { RoadPiece } from '../pieces/RoadPiece'
import { hexToPixel } from '@/lib/board-utils'

interface PieceLayerProps {
  board: Board
  gameState?: GameState // Optional game state to get player colors
  hexSize?: number
  onSettlementClick?: (vertexId: string) => void
  onCityClick?: (vertexId: string) => void
  onRoadClick?: (edgeId: string) => void
}

// Using hexToPixel from board-utils (honeycomb-grid integration)

// Calculate vertex position (junction between hexes)
function getVertexPosition(vertex: Vertex, hexSize: number): { x: number; y: number } {
  if (vertex.position.hexes.length === 0) {
    return { x: 0, y: 0 }
  }
  
  // For now, use the first hex position as a base
  // In a real implementation, this would calculate the exact vertex position
  // based on the direction and connected hexes
  const baseHex = hexToPixel(vertex.position.hexes[0].q, vertex.position.hexes[0].r)
  
  // Offset based on direction to approximate vertex positions
  const offsets = {
    'N': { x: 0, y: -hexSize * 0.866 }, // sqrt(3)/2
    'NE': { x: hexSize * 0.75, y: -hexSize * 0.433 },
    'SE': { x: hexSize * 0.75, y: hexSize * 0.433 },
    'S': { x: 0, y: hexSize * 0.866 },
    'SW': { x: -hexSize * 0.75, y: hexSize * 0.433 },
    'NW': { x: -hexSize * 0.75, y: -hexSize * 0.433 }
  }
  
  const offset = offsets[vertex.position.direction] || { x: 0, y: 0 }
  
  return {
    x: baseHex.x + offset.x,
    y: baseHex.y + offset.y
  }
}

// Calculate edge position (connection between vertices)
function getEdgePositions(edge: Edge, _hexSize: number): { start: { x: number; y: number }, end: { x: number; y: number } } {
  if (edge.position.hexes.length < 2) {
    const fallback = edge.position.hexes[0] || { q: 0, r: 0, s: 0 }
    const pos = hexToPixel(fallback.q, fallback.r)
    return { start: pos, end: pos }
  }
  
  const hex1 = hexToPixel(edge.position.hexes[0].q, edge.position.hexes[0].r)
  const hex2 = hexToPixel(edge.position.hexes[1].q, edge.position.hexes[1].r)
  
  // For now, draw roads between hex centers
  // In a real implementation, this would calculate exact edge positions
  return { start: hex1, end: hex2 }
}

export function PieceLayer({ 
  board, 
  gameState,
  hexSize = 60, 
  onSettlementClick, 
  onCityClick, 
  onRoadClick 
}: PieceLayerProps) {
  // Helper function to get player color from player ID
  const getPlayerColor = (playerId: string): number => {
    const player = gameState?.players.get(playerId)
    if (player) {
      return player.color
    }
    
    // Handle demo players for testing
    if (playerId.includes('demo')) {
      const match = playerId.match(/demo-(\d+)/)
      return match ? parseInt(match[1], 10) : 0
    }
    
    return 0
  }

  // Removed debug logging to prevent console spam

  return (
    <g className="piece-layer">
      {/* Render roads first (underneath buildings) */}
      {Array.from(board.edges.values()).map((edge) => {
        if (!edge.connection) return null
        
        const positions = getEdgePositions(edge, hexSize)
        
        return (
          <RoadPiece
            key={edge.id}
            road={edge.connection}
            startPosition={positions.start}
            endPosition={positions.end}
            playerColor={getPlayerColor(edge.connection.owner)}
            onClick={() => onRoadClick?.(edge.id)}
          />
        )
      })}
      
      {/* Render buildings on top */}
      {Array.from(board.vertices.values()).map((vertex) => {
        if (!vertex.building) return null
        
        const position = getVertexPosition(vertex, hexSize)
        
        if (vertex.building.type === 'settlement') {
          return (
            <SettlementPiece
              key={vertex.id}
              building={vertex.building}
              position={position}
              playerColor={getPlayerColor(vertex.building.owner)}
              onClick={() => onSettlementClick?.(vertex.id)}
            />
          )
        } else if (vertex.building.type === 'city') {
          return (
            <CityPiece
              key={vertex.id}
              building={vertex.building}
              position={position}
              playerColor={getPlayerColor(vertex.building.owner)}
              onClick={() => onCityClick?.(vertex.id)}
            />
          )
        }
        
        return null
      })}
    </g>
  )
} 