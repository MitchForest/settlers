import type { PlayerId, Player, DevelopmentCard } from './player-types'
import type { GamePhase } from './core-types'
import type { Board } from './geometry-types'

// ============= Game State Types =============

export interface DiceRoll {
  dice1: number
  dice2: number
  total: number
}

export interface Trade {
  id: string
  initiator: PlayerId
  target: PlayerId | null
  offering: Record<string, number>
  requesting: Record<string, number>
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled'
}

export interface GameState {
  id: string
  phase: GamePhase
  turn: number
  currentPlayer: PlayerId
  players: Map<PlayerId, Player>
  board: Board
  dice: DiceRoll | null
  developmentDeck: DevelopmentCard[]
  discardPile: DevelopmentCard[]
  winner: PlayerId | null
  activeTrades: Trade[]
  pendingRoadBuilding?: {
    playerId: PlayerId
    roadsRemaining: number
  }
  startedAt: Date
  updatedAt: Date
} 