'use client'

import { useState } from 'react'
import { Board, GameState, GameAction } from '@settlers/game-engine'
import { getVertexPixelPosition, getEdgePixelPositions } from '@/lib/hex-geometry'

interface BuildingPlacementLayerProps {
  board: Board
  gameState: GameState
  localPlayerId: string
  isMyTurn: boolean
  placementMode: 'settlement' | 'city' | 'road' | null
  onGameAction: (action: GameAction) => void
  onModeChange: (mode: 'settlement' | 'city' | 'road' | null) => void
}

export function BuildingPlacementLayer({
  board,
  gameState,
  localPlayerId,
  isMyTurn,
  placementMode,
  onGameAction,
  onModeChange
}: BuildingPlacementLayerProps) {
  const [hoveredPosition, setHoveredPosition] = useState<string | null>(null)

  // Get available settlement positions
  const getAvailableSettlementPositions = () => {
    const available: string[] = []
    
    board.vertices.forEach((vertex, vertexId) => {
      // Check if vertex is empty
      if (vertex.building) return
      
      // Check distance rule (no building within 2 edges)
      let tooClose = false
      board.vertices.forEach((otherVertex, otherVertexId) => {
        if (otherVertexId === vertexId || !otherVertex.building) return
        
        // Simple distance check - in production this would use proper pathfinding
        const distance = calculateVertexDistance(vertex.position, otherVertex.position)
        if (distance < 2) {
          tooClose = true
        }
      })
      
      if (!tooClose) {
        // Check if connected to player's road network (except initial placement)
        if (gameState.phase === 'setup1' || gameState.phase === 'setup2' || isConnectedToPlayerNetwork(vertexId, localPlayerId)) {
          available.push(vertexId)
        }
      }
    })
    
    return available
  }

  // Get available city positions (upgrade existing settlements)
  const getAvailableCityPositions = () => {
    const available: string[] = []
    
    board.vertices.forEach((vertex, vertexId) => {
      if (vertex.building?.type === 'settlement' && vertex.building.owner === localPlayerId) {
        available.push(vertexId)
      }
    })
    
    return available
  }

  // Get available road positions
  const getAvailableRoadPositions = () => {
    const available: string[] = []
    
    board.edges.forEach((edge, edgeId) => {
      // Check if edge is empty
      if (edge.connection) return
      
      // Check if connected to player's network
      if (gameState.phase === 'setup1' || gameState.phase === 'setup2' || isEdgeConnectedToPlayer(edgeId, localPlayerId)) {
        available.push(edgeId)
      }
    })
    
    return available
  }

  // Helper functions (simplified - in production these would use proper game engine validation)
  const calculateVertexDistance = (pos1: unknown, pos2: unknown): number => {
    // Simplified distance calculation with type guards
    const p1 = pos1 as { hexes?: Array<{ q?: number; r?: number }> }
    const p2 = pos2 as { hexes?: Array<{ q?: number; r?: number }> }
    const dx = Math.abs((p1.hexes?.[0]?.q ?? 0) - (p2.hexes?.[0]?.q ?? 0))
    const dy = Math.abs((p1.hexes?.[0]?.r ?? 0) - (p2.hexes?.[0]?.r ?? 0))
    return Math.max(dx, dy)
  }

  const isConnectedToPlayerNetwork = (vertexId: string, playerId: string): boolean => {
    // Check if any adjacent edge has a road owned by the player
    const vertex = board.vertices.get(vertexId)
    if (!vertex) return false
    
    // Simple check - in production this would use proper pathfinding
    let connected = false
    board.edges.forEach((edge) => {
      if (edge.connection?.owner === playerId) {
        // Check if edge is adjacent to vertex (simplified)
        connected = true
      }
    })
    
    return connected
  }

  const isEdgeConnectedToPlayer = (edgeId: string, playerId: string): boolean => {
    // Check if either endpoint has a building or connected road owned by the player
    const edge = board.edges.get(edgeId)
    if (!edge) return false
    
    // Simple check - in production this would use proper validation
    let connected = false
    board.vertices.forEach((vertex) => {
      if (vertex.building?.owner === playerId) {
        connected = true
      }
    })
    
    return connected
  }

  // Handle clicks on available positions
  const handleVertexClick = (vertexId: string) => {
    if (!isMyTurn || !placementMode) return

    if (placementMode === 'settlement') {
      onGameAction({
        type: 'build',
        playerId: localPlayerId,
        data: {
          buildingType: 'settlement',
          position: vertexId
        }
      })
    } else if (placementMode === 'city') {
      onGameAction({
        type: 'build',
        playerId: localPlayerId,
        data: {
          buildingType: 'city',
          position: vertexId
        }
      })
    }

    onModeChange(null) // Exit placement mode
  }

  const handleEdgeClick = (edgeId: string) => {
    if (!isMyTurn || placementMode !== 'road') return

    onGameAction({
      type: 'build',
      playerId: localPlayerId,
      data: {
        buildingType: 'road',
        position: edgeId
      }
    })

    onModeChange(null) // Exit placement mode
  }

  // Get available positions based on current mode
  const availableVertices = placementMode === 'settlement' 
    ? getAvailableSettlementPositions()
    : placementMode === 'city'
    ? getAvailableCityPositions()
    : []

  const availableEdges = placementMode === 'road' 
    ? getAvailableRoadPositions()
    : []

  if (!placementMode || !isMyTurn) {
    return null
  }

  return (
    <g className="building-placement-layer">
      {/* Available vertex positions */}
      {availableVertices.map(vertexId => {
        const vertex = board.vertices.get(vertexId)
        if (!vertex) return null

        const position = getVertexPixelPosition(vertex.position)
        const isHovered = hoveredPosition === vertexId

        return (
          <g key={vertexId}>
            {/* Placement indicator */}
            <circle
              cx={position.x}
              cy={position.y}
              r={12}
              fill={placementMode === 'settlement' ? '#22c55e' : '#eab308'}
              fillOpacity={isHovered ? 0.8 : 0.6}
              stroke="#ffffff"
              strokeWidth={2}
              className="cursor-pointer"
              onMouseEnter={() => setHoveredPosition(vertexId)}
              onMouseLeave={() => setHoveredPosition(null)}
              onClick={() => handleVertexClick(vertexId)}
            />
            
            {/* Icon */}
            <text
              x={position.x}
              y={position.y + 4}
              textAnchor="middle"
              fontSize="12"
              fill="white"
              className="pointer-events-none select-none"
            >
              {placementMode === 'settlement' ? '🏠' : '🏛️'}
            </text>
          </g>
        )
      })}

      {/* Available edge positions */}
      {availableEdges.map(edgeId => {
        const edge = board.edges.get(edgeId)
        if (!edge) return null

        const positions = getEdgePixelPositions(edge.position)
        const midX = (positions.start.x + positions.end.x) / 2
        const midY = (positions.start.y + positions.end.y) / 2
        const isHovered = hoveredPosition === edgeId

        return (
          <g key={edgeId}>
            {/* Road placement indicator */}
            <line
              x1={positions.start.x}
              y1={positions.start.y}
              x2={positions.end.x}
              y2={positions.end.y}
              stroke="#8b5cf6"
              strokeWidth={isHovered ? 6 : 4}
              strokeOpacity={isHovered ? 0.8 : 0.6}
              className="cursor-pointer"
              onMouseEnter={() => setHoveredPosition(edgeId)}
              onMouseLeave={() => setHoveredPosition(null)}
              onClick={() => handleEdgeClick(edgeId)}
            />
            
            {/* Road icon at midpoint */}
            <circle
              cx={midX}
              cy={midY}
              r={8}
              fill="#8b5cf6"
              fillOpacity={isHovered ? 0.8 : 0.6}
              stroke="#ffffff"
              strokeWidth={1}
              className="pointer-events-none"
            />
            <text
              x={midX}
              y={midY + 3}
              textAnchor="middle"
              fontSize="8"
              fill="white"
              className="pointer-events-none select-none"
            >
              🛤️
            </text>
          </g>
        )
      })}

      {/* Cancel button */}
      <g>
        <circle
          cx={-300}
          cy={300}
          r={20}
          fill="#ef4444"
          fillOpacity={0.8}
          stroke="#ffffff"
          strokeWidth={2}
          className="cursor-pointer"
          onClick={() => onModeChange(null)}
        />
        <text
          x={-300}
          y={305}
          textAnchor="middle"
          fontSize="14"
          fill="white"
          className="pointer-events-none select-none"
        >
          ✕
        </text>
      </g>
    </g>
  )
}