import { GameState, GameAction, GamePhase, PlayerId } from '@settlers/game-engine'

// Base game message interface
interface BaseGameMessage {
  type: string
  data: {
    gameId: string
    timestamp?: string
    [key: string]: any
  }
}

// Turn management messages
export interface GameTurnMessage extends BaseGameMessage {
  type: 'turnStarted' | 'turnEnded' | 'turnTimeout'
  data: {
    gameId: string
    currentPlayer: PlayerId
    previousPlayer?: PlayerId
    timeRemaining: number
    phase: GamePhase
    availableActions?: string[]
    timestamp: string
  }
}

// Game state messages
export interface GameStateMessage extends BaseGameMessage {
  type: 'gameStateUpdate' | 'actionResult'
  data: {
    gameId: string
    gameState?: SerializedGameState
    lastAction?: GameAction
    actionResult?: {
      success: boolean
      error?: string
      message?: string
    }
    sequence: number
    timestamp: string
  }
}

// Game control messages
export interface GameControlMessage extends BaseGameMessage {
  type: 'gamePaused' | 'gameResumed' | 'gameEnded'
  data: {
    gameId: string
    reason?: string
    winner?: PlayerId
    finalState?: SerializedGameState
    timestamp: string
  }
}

// Player action messages (incoming from clients)
export interface PlayerActionMessage extends BaseGameMessage {
  type: 'gameAction' | 'endTurn'
  data: {
    gameId: string
    playerId: PlayerId
    action?: GameAction
    timestamp: string
  }
}

// Spectator messages
export interface SpectatorMessage extends BaseGameMessage {
  type: 'joinAsSpectator' | 'leaveAsSpectator'
  data: {
    gameId: string
    userId: string
    userName?: string
    timestamp: string
  }
}

// Game synchronization messages
export interface GameSyncMessage extends BaseGameMessage {
  type: 'requestGameSync' | 'gameSync'
  data: {
    gameId: string
    requestedBy?: PlayerId
    fullGameState?: SerializedGameState
    sequence?: number
    timestamp: string
  }
}

// Union type for all game messages
export type GameMessage = 
  | GameTurnMessage 
  | GameStateMessage 
  | GameControlMessage 
  | PlayerActionMessage
  | SpectatorMessage
  | GameSyncMessage

// Serialized game state for transmission (handles Map -> Object conversion)
export interface SerializedGameState {
  id: string
  phase: GamePhase
  turn: number
  currentPlayer: PlayerId
  players: Array<[PlayerId, any]>  // Will be properly typed later
  board: any
  dice: any
  developmentDeck: any[]
  discardPile: any[]
  winner: PlayerId | null
  activeTrades: any[]
  startedAt: string
  updatedAt: string
}

// Message validation helpers
export function isGameMessage(message: any): message is GameMessage {
  return (
    message &&
    typeof message === 'object' &&
    typeof message.type === 'string' &&
    message.data &&
    typeof message.data.gameId === 'string'
  )
}

export function isPlayerActionMessage(message: any): message is PlayerActionMessage {
  return (
    isGameMessage(message) &&
    (message.type === 'gameAction' || message.type === 'endTurn') &&
    typeof message.data.playerId === 'string'
  )
}

export function isTurnMessage(message: any): message is GameTurnMessage {
  return (
    isGameMessage(message) &&
    ['turnStarted', 'turnEnded', 'turnTimeout'].includes(message.type)
  )
}

// Message factory functions
export function createTurnStartedMessage(
  gameId: string,
  currentPlayer: PlayerId,
  timeRemaining: number,
  phase: GamePhase,
  availableActions?: string[]
): GameTurnMessage {
  return {
    type: 'turnStarted',
    data: {
      gameId,
      currentPlayer,
      timeRemaining,
      phase,
      availableActions,
      timestamp: new Date().toISOString()
    }
  }
}

export function createTurnEndedMessage(
  gameId: string,
  previousPlayer: PlayerId,
  currentPlayer: PlayerId
): GameTurnMessage {
  return {
    type: 'turnEnded',
    data: {
      gameId,
      currentPlayer,
      previousPlayer,
      timeRemaining: 0,
      phase: 'actions', // Will be updated with actual phase
      timestamp: new Date().toISOString()
    }
  }
}

export function createGameStateUpdateMessage(
  gameId: string,
  gameState: SerializedGameState,
  sequence: number
): GameStateMessage {
  return {
    type: 'gameStateUpdate',
    data: {
      gameId,
      gameState,
      sequence,
      timestamp: new Date().toISOString()
    }
  }
}

export function createActionResultMessage(
  gameId: string,
  action: GameAction,
  result: { success: boolean; error?: string; message?: string }
): GameStateMessage {
  return {
    type: 'actionResult',
    data: {
      gameId,
      lastAction: action,
      actionResult: result,
      sequence: 0, // Will be set by caller
      timestamp: new Date().toISOString()
    }
  }
}

export function createGamePausedMessage(gameId: string, reason: string): GameControlMessage {
  return {
    type: 'gamePaused',
    data: {
      gameId,
      reason,
      timestamp: new Date().toISOString()
    }
  }
}

export function createGameResumedMessage(gameId: string): GameControlMessage {
  return {
    type: 'gameResumed',
    data: {
      gameId,
      timestamp: new Date().toISOString()
    }
  }
}

export function createGameEndedMessage(
  gameId: string,
  winner: PlayerId | null,
  finalState?: SerializedGameState
): GameControlMessage {
  return {
    type: 'gameEnded',
    data: {
      gameId,
      winner: winner || undefined,
      finalState,
      timestamp: new Date().toISOString()
    }
  }
} 