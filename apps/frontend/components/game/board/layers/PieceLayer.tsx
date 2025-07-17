'use client'

import { Board, Vertex, Edge, GameState } from '@settlers/core'
import { SettlementPiece } from '../pieces/SettlementPiece'
import { CityPiece } from '../pieces/CityPiece'
import { RoadPiece } from '../pieces/RoadPiece'

import { getVertexPixelPosition, getEdgePixelPositions } from '@/lib/hex-geometry'

interface PieceLayerProps {
  board: Board
  gameState?: GameState // Optional game state to get player colors
  hexSize?: number
  onSettlementClick?: (vertexId: string) => void
  onCityClick?: (vertexId: string) => void
  onRoadClick?: (edgeId: string) => void
}

// Using hexToPixel from board-utils (honeycomb-grid integration)

// Calculate vertex position using proper honeycomb-grid geometry
function getVertexPosition(vertex: Vertex, _hexSize: number): { x: number; y: number } {
  return getVertexPixelPosition(vertex.position)
}

// Calculate edge position using proper honeycomb-grid geometry
function getEdgePositions(edge: Edge, _hexSize: number): { start: { x: number; y: number }, end: { x: number; y: number } } {
  return getEdgePixelPositions(edge.position)
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
    
    // Fallback for any orphaned pieces (shouldn't happen in production)
    console.warn('Player not found for piece, using default color:', playerId)
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