import type { GameState, GameAction, GamePhase, PlayerId } from '@settlers/game-engine'

// ============= BASE MESSAGE INTERFACES =============

interface BaseGameMessage {
  type: string
  data: {
    gameId: string
    timestamp?: string
    [key: string]: any
  }
}

// ============= TURN MANAGEMENT MESSAGES =============

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

// ============= GAME STATE MESSAGES =============

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

// ============= GAME CONTROL MESSAGES =============

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

// ============= PLAYER ACTION MESSAGES (OUTGOING) =============

export interface PlayerActionMessage extends BaseGameMessage {
  type: 'gameAction' | 'endTurn'
  data: {
    gameId: string
    playerId: PlayerId
    action?: GameAction
    finalAction?: GameAction
    timestamp: string
  }
}

// ============= SPECTATOR MESSAGES =============

export interface SpectatorMessage extends BaseGameMessage {
  type: 'joinAsSpectator' | 'leaveAsSpectator'
  data: {
    gameId: string
    userId: string
    userName?: string
    timestamp: string
  }
}

// ============= GAME SYNCHRONIZATION MESSAGES =============

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

// ============= UNION TYPES =============

// All incoming game messages from server
export type IncomingGameMessage = 
  | GameTurnMessage 
  | GameStateMessage 
  | GameControlMessage
  | GameSyncMessage

// All outgoing game messages to server
export type OutgoingGameMessage = 
  | PlayerActionMessage
  | SpectatorMessage
  | GameSyncMessage

// Complete union of all game messages
export type GameMessage = IncomingGameMessage | OutgoingGameMessage

// ============= SERIALIZED GAME STATE =============

// Serialized game state for transmission (handles Map -> Object conversion)
export interface SerializedGameState {
  id: string
  phase: GamePhase
  turn: number
  currentPlayer: PlayerId
  players: Array<[PlayerId, any]>  // Map entries as array
  board: SerializedBoard
  dice: any
  developmentDeck: any[]
  discardPile: any[]
  winner: PlayerId | null
  activeTrades: any[]
  startedAt: string
  updatedAt: string
}

// Serialized board for transmission
export interface SerializedBoard {
  hexes: Array<[string, any]>      // Map entries as array
  vertices: Array<[string, any]>   // Map entries as array
  edges: Array<[string, any]>      // Map entries as array
  [key: string]: any
}

// ============= MESSAGE VALIDATION =============

export function isGameMessage(message: any): message is GameMessage {
  return (
    message &&
    typeof message === 'object' &&
    typeof message.type === 'string' &&
    message.data &&
    typeof message.data.gameId === 'string'
  )
}

export function isIncomingGameMessage(message: any): message is IncomingGameMessage {
  return (
    isGameMessage(message) &&
    ['turnStarted', 'turnEnded', 'turnTimeout', 'gameStateUpdate', 'actionResult', 
     'gamePaused', 'gameResumed', 'gameEnded', 'gameSync'].includes(message.type)
  )
}

export function isOutgoingGameMessage(message: any): message is OutgoingGameMessage {
  return (
    isGameMessage(message) &&
    ['gameAction', 'endTurn', 'joinAsSpectator', 'leaveAsSpectator', 'requestGameSync'].includes(message.type)
  )
}

export function isTurnMessage(message: any): message is GameTurnMessage {
  return (
    isGameMessage(message) &&
    ['turnStarted', 'turnEnded', 'turnTimeout'].includes(message.type)
  )
}

export function isGameStateMessage(message: any): message is GameStateMessage {
  return (
    isGameMessage(message) &&
    ['gameStateUpdate', 'actionResult'].includes(message.type)
  )
}

export function isGameControlMessage(message: any): message is GameControlMessage {
  return (
    isGameMessage(message) &&
    ['gamePaused', 'gameResumed', 'gameEnded'].includes(message.type)
  )
}

// ============= MESSAGE FACTORY FUNCTIONS =============

export function createGameActionMessage(
  gameId: string,
  playerId: PlayerId,
  action: GameAction
): PlayerActionMessage {
  return {
    type: 'gameAction',
    data: {
      gameId,
      playerId,
      action,
      timestamp: new Date().toISOString()
    }
  }
}

export function createEndTurnMessage(
  gameId: string,
  playerId: PlayerId,
  finalAction?: GameAction
): PlayerActionMessage {
  return {
    type: 'endTurn',
    data: {
      gameId,
      playerId,
      finalAction,
      timestamp: new Date().toISOString()
    }
  }
}

export function createGameSyncRequestMessage(
  gameId: string,
  playerId?: PlayerId
): GameSyncMessage {
  return {
    type: 'requestGameSync',
    data: {
      gameId,
      requestedBy: playerId,
      timestamp: new Date().toISOString()
    }
  }
}

export function createJoinSpectatorMessage(
  gameId: string,
  userId: string,
  userName?: string
): SpectatorMessage {
  return {
    type: 'joinAsSpectator',
    data: {
      gameId,
      userId,
      userName,
      timestamp: new Date().toISOString()
    }
  }
}

export function createLeaveSpectatorMessage(
  gameId: string,
  userId: string
): SpectatorMessage {
  return {
    type: 'leaveAsSpectator',
    data: {
      gameId,
      userId,
      timestamp: new Date().toISOString()
    }
  }
}

// ============= GAME STATE CONVERSION UTILITIES =============

/**
 * Convert serialized game state back to game engine format
 */
export function deserializeGameState(serialized: SerializedGameState): Partial<GameState> {
  return {
    id: serialized.id,
    phase: serialized.phase,
    turn: serialized.turn,
    currentPlayer: serialized.currentPlayer,
    players: new Map(serialized.players),
    board: deserializeBoard(serialized.board),
    dice: serialized.dice,
    developmentDeck: serialized.developmentDeck,
    discardPile: serialized.discardPile,
    winner: serialized.winner,
    activeTrades: serialized.activeTrades,
    startedAt: new Date(serialized.startedAt),
    updatedAt: new Date(serialized.updatedAt)
  }
}

/**
 * Convert serialized board back to game engine format
 */
export function deserializeBoard(serialized: SerializedBoard): any {
  return {
    ...serialized,
    hexes: new Map(serialized.hexes),
    vertices: new Map(serialized.vertices),
    edges: new Map(serialized.edges)
  }
}

/**
 * Serialize game state for transmission
 */
export function serializeGameState(gameState: GameState): SerializedGameState {
  return {
    id: gameState.id,
    phase: gameState.phase,
    turn: gameState.turn,
    currentPlayer: gameState.currentPlayer,
    players: Array.from(gameState.players.entries()),
    board: serializeBoard(gameState.board),
    dice: gameState.dice,
    developmentDeck: gameState.developmentDeck,
    discardPile: gameState.discardPile,
    winner: gameState.winner,
    activeTrades: gameState.activeTrades,
    startedAt: gameState.startedAt.toISOString(),
    updatedAt: gameState.updatedAt.toISOString()
  }
}

/**
 * Serialize board for transmission
 */
export function serializeBoard(board: any): SerializedBoard {
  return {
    ...board,
    hexes: Array.from(board.hexes.entries()),
    vertices: Array.from(board.vertices.entries()),
    edges: Array.from(board.edges.entries())
  }
}

// ============= TYPE GUARDS FOR SPECIFIC MESSAGE DATA =============

export function isTurnStartedData(message: GameTurnMessage): message is GameTurnMessage & { type: 'turnStarted' } {
  return message.type === 'turnStarted'
}

export function isTurnEndedData(message: GameTurnMessage): message is GameTurnMessage & { type: 'turnEnded' } {
  return message.type === 'turnEnded'
}

export function isTurnTimeoutData(message: GameTurnMessage): message is GameTurnMessage & { type: 'turnTimeout' } {
  return message.type === 'turnTimeout'
}

export function isGameStateUpdateData(message: GameStateMessage): message is GameStateMessage & { type: 'gameStateUpdate' } {
  return message.type === 'gameStateUpdate'
}

export function isActionResultData(message: GameStateMessage): message is GameStateMessage & { type: 'actionResult' } {
  return message.type === 'actionResult'
}

// ============= ERROR HANDLING TYPES =============

export interface GameMessageError {
  type: 'validation' | 'connection' | 'timeout' | 'sync' | 'unknown'
  message: string
  originalMessage?: any
  timestamp: string
}

export function createGameMessageError(
  type: GameMessageError['type'],
  message: string,
  originalMessage?: any
): GameMessageError {
  return {
    type,
    message,
    originalMessage,
    timestamp: new Date().toISOString()
  }
} 