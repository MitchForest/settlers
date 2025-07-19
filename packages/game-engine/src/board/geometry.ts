import { Board } from '../types'

/**
 * Board Geometry Functions
 * 
 * Pure geometric calculations for hex grid relationships.
 * These functions deal with the mathematical structure of the board,
 * not game rules or validation logic.
 */

// ============= Core Adjacency Functions =============

/**
 * Get vertex IDs that are adjacent to the given vertex
 * In Settlers, vertices are connected through hex edges
 */
export function getAdjacentVertices(board: Board, vertexId: string): string[] {
  const vertex = board.vertices.get(vertexId)
  if (!vertex) return []

  const adjacentVertices: Set<string> = new Set()
  
  // Simple implementation: find vertices that share edges with our vertex
  board.vertices.forEach((otherVertex, otherVertexId) => {
    if (otherVertexId === vertexId) return
    
    // Check if this vertex shares an edge with our vertex
    // Two vertices are adjacent if they share exactly 2 hexes
    const sharedHexes = vertex.position.hexes.filter(hexA =>
      otherVertex.position.hexes.some(hexB =>
        hexA.q === hexB.q && hexA.r === hexB.r && hexA.s === hexB.s
      )
    )
    
    if (sharedHexes.length === 2) {
      adjacentVertices.add(otherVertexId)
    }
  })
  
  return Array.from(adjacentVertices)
}

/**
 * Get edge IDs that connect to the given vertex
 * A vertex connects to 3 edges (the edges of its adjacent hexes)
 */
export function getVertexEdges(board: Board, vertexId: string): string[] {
  const vertex = board.vertices.get(vertexId)
  if (!vertex) return []

  const connectedEdges: string[] = []
  
  board.edges.forEach((edge, edgeId) => {
    // An edge connects to a vertex if they share exactly 2 hexes
    const sharedHexes = vertex.position.hexes.filter(hexA =>
      edge.position.hexes.some(hexB =>
        hexA.q === hexB.q && hexA.r === hexB.r && hexA.s === hexB.s
      )
    )
    
    if (sharedHexes.length === 2) {
      connectedEdges.push(edgeId)
    }
  })
  
  return connectedEdges
}

/**
 * Get vertex IDs that are connected to the given edge
 * Each edge connects exactly 2 vertices
 */
export function getEdgeVertices(board: Board, edgeId: string): string[] {
  const edge = board.edges.get(edgeId)
  if (!edge) return []

  const connectedVertices: string[] = []
  
  board.vertices.forEach((vertex, vertexId) => {
    // A vertex connects to an edge if they share exactly 2 hexes
    const sharedHexes = edge.position.hexes.filter(hexA =>
      vertex.position.hexes.some(hexB =>
        hexA.q === hexB.q && hexA.r === hexB.r && hexA.s === hexB.s
      )
    )
    
    if (sharedHexes.length === 2) {
      connectedVertices.push(vertexId)
    }
  })
  
  return connectedVertices
}
