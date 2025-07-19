// ============= Coordinate System =============

export interface HexCoordinate {
  q: number  // Column
  r: number  // Row
  s: number  // Computed: -(q + r)
}

export interface VertexPosition {
  hexes: HexCoordinate[]  // Connected hexes (2-3 hexes)
  direction: 'N' | 'NE' | 'SE' | 'S' | 'SW' | 'NW'  // Direction from first hex
}

export interface EdgePosition {
  hexes: HexCoordinate[]  // Connected hexes (exactly 2)
  direction: 'NE' | 'E' | 'SE' | 'SW' | 'W' | 'NW'  // Direction from first hex
}

// ============= Board Element Types =============

export interface Hex {
  id: string
  position: HexCoordinate
  terrain: string | null
  numberToken: number | null
  hasRobber: boolean
}

export interface Port {
  id: string
  position: EdgePosition
  type: 'generic' | string  // 'generic' or ResourceType
  ratio: number
}

// These will reference types from player-types
export interface Vertex {
  id: string
  position: VertexPosition
  building: { type: string; owner: string } | null
  port: Port | null
}

export interface Edge {
  id: string
  position: EdgePosition
  connection: { type: string; owner: string } | null
}

export interface Board {
  hexes: Map<string, Hex>
  vertices: Map<string, Vertex>
  edges: Map<string, Edge>
  ports: Port[]
  robberPosition: HexCoordinate | null
} 