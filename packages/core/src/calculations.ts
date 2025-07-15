// Core calculation utilities for Settlers
// Uses Honeycomb library for hex grid calculations

import { defineHex, Direction, neighborOf, distance } from 'honeycomb-grid'
import { 
  HexCoordinate, 
  ResourceCards, 
  DiceRoll, 
  PlayerId,
  Vertex,
  Edge,
  VertexPosition,
  EdgePosition
} from './types'

// Define our hex class with default settings
export const GameHex = defineHex()

// ============= Game Utility Functions =============

export function rollDice(): DiceRoll {
  const die1 = Math.floor(Math.random() * 6) + 1
  const die2 = Math.floor(Math.random() * 6) + 1
  return {
    die1,
    die2,
    sum: die1 + die2
  }
}

export function calculateDiscardCount(totalResources: number): number {
  return Math.floor(totalResources / 2)
}

export function randomChoice<T>(array: T[]): T | undefined {
  if (array.length === 0) return undefined
  return array[Math.floor(Math.random() * array.length)]
}

export function generatePlayerId(): string {
  return Math.random().toString(36).substring(2, 15)
}

// ============= Resource Management =============

export function createEmptyResources(): ResourceCards {
  return {
    resource1: 0,
    resource2: 0, 
    resource3: 0,
    resource4: 0,
    resource5: 0
  }
}

export function addResources(a: Partial<ResourceCards>, b: Partial<ResourceCards>): ResourceCards {
  return {
    resource1: (a.resource1 || 0) + (b.resource1 || 0),
    resource2: (a.resource2 || 0) + (b.resource2 || 0),
    resource3: (a.resource3 || 0) + (b.resource3 || 0),
    resource4: (a.resource4 || 0) + (b.resource4 || 0),
    resource5: (a.resource5 || 0) + (b.resource5 || 0)
  }
}

export function subtractResources(a: ResourceCards, b: Partial<ResourceCards>): ResourceCards {
  return {
    resource1: Math.max(0, a.resource1 - (b.resource1 || 0)),
    resource2: Math.max(0, a.resource2 - (b.resource2 || 0)),
    resource3: Math.max(0, a.resource3 - (b.resource3 || 0)),
    resource4: Math.max(0, a.resource4 - (b.resource4 || 0)),
    resource5: Math.max(0, a.resource5 - (b.resource5 || 0))
  }
}

export function hasResources(available: ResourceCards, required: Partial<ResourceCards>): boolean {
  return Object.entries(required).every(([key, value]) => {
    const resourceKey = key as keyof ResourceCards
    return available[resourceKey] >= (value || 0)
  })
}

export function getTotalResources(resources: ResourceCards): number {
  return Object.values(resources).reduce((sum, count) => sum + count, 0)
}

export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

// ============= Hex Coordinate Calculations =============

export function hexToString(hex: HexCoordinate): string {
  return `${hex.q},${hex.r},${hex.s}`
}

export function stringToHex(str: string): HexCoordinate {
  const [q, r, s] = str.split(',').map(Number)
  return { q, r, s }
}

export function getAdjacentHexes(hex: HexCoordinate): HexCoordinate[] {
  const gameHex = new GameHex(hex)
  const directions = [Direction.E, Direction.SE, Direction.SW, Direction.W, Direction.NW, Direction.NE]
  
  return directions.map(direction => {
    const neighbor = neighborOf(gameHex, direction)
    return { q: neighbor.q, r: neighbor.r, s: neighbor.s }
  })
}

export function hexDistance(a: HexCoordinate, b: HexCoordinate): number {
  const hexA = new GameHex(a)
  const hexB = new GameHex(b)
  return distance(GameHex.settings, hexA, hexB)
}

// TODO: Implement based on vertex ID scheme
export function getVerticesForHex(hex: HexCoordinate): VertexPosition[] {
  // Returns the 6 vertices around a hex
  // Each vertex is defined by its direction from the hex center
  const directions: ('N' | 'NE' | 'SE' | 'S' | 'SW' | 'NW')[] = ['N', 'NE', 'SE', 'S', 'SW', 'NW']
  
  return directions.map(direction => ({
    hexes: [hex], // This vertex belongs to this hex (and potentially others)
    direction
  }))
}

// TODO: Implement based on edge ID scheme  
export function getEdgesForHex(hex: HexCoordinate): EdgePosition[] {
  // Returns the 6 edges around a hex
  // Each edge connects two adjacent vertices
  const vertices = getVerticesForHex(hex)
  const edges: EdgePosition[] = []
  
  for (let i = 0; i < vertices.length; i++) {
    const currentVertex = vertices[i]
    const nextVertex = vertices[(i + 1) % vertices.length]
    edges.push([currentVertex, nextVertex])
  }
  
  return edges
}

// Generate vertex ID from position
export function vertexToString(position: VertexPosition): string {
  const hexStrings = position.hexes.map(hex => hexToString(hex)).sort()
  return `${hexStrings.join('|')}:${position.direction}`
}

// Generate edge ID from position
export function edgeToString(position: EdgePosition): string {
  const [vertex1, vertex2] = position
  const v1String = vertexToString(vertex1)
  const v2String = vertexToString(vertex2)
  // Sort to ensure consistent edge IDs regardless of direction
  return [v1String, v2String].sort().join('<->')
}

// Generate all vertices for a board
export function generateVerticesFromHexes(hexes: HexCoordinate[]): Map<string, Vertex> {
  const vertexMap = new Map<string, Vertex>()
  
  hexes.forEach(hex => {
    const hexVertices = getVerticesForHex(hex)
    hexVertices.forEach(vertexPos => {
      const vertexId = vertexToString(vertexPos)
      
      if (!vertexMap.has(vertexId)) {
        // Create new vertex
        vertexMap.set(vertexId, {
          id: vertexId,
          position: vertexPos,
          building: null,
          port: null
        })
      } else {
        // Add this hex to existing vertex
        const existingVertex = vertexMap.get(vertexId)!
        if (!existingVertex.position.hexes.some((h: HexCoordinate) => hexToString(h) === hexToString(hex))) {
          existingVertex.position.hexes.push(hex)
        }
      }
    })
  })
  
  return vertexMap
}

// Generate all edges for a board
export function generateEdgesFromHexes(hexes: HexCoordinate[]): Map<string, Edge> {
  const edgeMap = new Map<string, Edge>()
  
  hexes.forEach(hex => {
    const hexEdges = getEdgesForHex(hex)
    hexEdges.forEach(edgePos => {
      const edgeId = edgeToString(edgePos)
      
      if (!edgeMap.has(edgeId)) {
        edgeMap.set(edgeId, {
          id: edgeId,
          position: edgePos,
          connection: null
        })
      }
    })
  })
  
  return edgeMap
} 