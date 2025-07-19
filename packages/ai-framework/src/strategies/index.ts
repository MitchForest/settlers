// Strategy interfaces and implementations
export * from './action/simple-next-vp'
export * from './setup/simple-vertex'

// Base strategy interfaces
export interface ActionStrategy {
  selectBestAction(gameState: any, playerId: string): any | null
}

export interface SetupStrategy {
  selectFirstSettlement(gameState: any, playerId: string): string
  selectSecondSettlement(gameState: any, playerId: string): string
  selectFirstRoad(gameState: any, playerId: string, settlementVertexId: string): string | null
  selectSecondRoad(gameState: any, playerId: string, settlementVertexId: string): string | null
} 