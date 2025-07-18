// ===== GAME DOMAIN ERROR CLASSES =====
// Complete game domain error hierarchy with specific error codes

import { DomainError, ErrorContextBuilder } from './domain-error'

/**
 * Base class for all game domain errors
 */
export abstract class GameError extends DomainError {
  readonly domain = 'game'
}

/**
 * Game State Errors
 */
export class GameStateError extends GameError {
  readonly code = 'GAME_STATE_ERROR'
  
  static invalidPhase(currentPhase: string, expectedPhase: string, gameId: string): GameStateError {
    return new GameStateError(
      `Game is in ${currentPhase} phase, expected ${expectedPhase}`,
      new ErrorContextBuilder()
        .addGameContext(gameId)
        .addStateContext('phase_validation', { currentPhase, expectedPhase })
        .build()
    )
  }
  
  static gameNotFound(gameId: string): GameStateError {
    return new GameStateError(
      `Game with ID ${gameId} not found`,
      new ErrorContextBuilder()
        .addGameContext(gameId)
        .addStateContext('game_lookup', { gameId })
        .build()
    )
  }
  
  static gameAlreadyStarted(gameId: string): GameStateError {
    return new GameStateError(
      `Game ${gameId} has already started`,
      new ErrorContextBuilder()
        .addGameContext(gameId)
        .addStateContext('game_start_check', { gameId })
        .build()
    )
  }
  
  static gameNotStarted(gameId: string): GameStateError {
    return new GameStateError(
      `Game ${gameId} has not started yet`,
      new ErrorContextBuilder()
        .addGameContext(gameId)
        .addStateContext('game_start_check', { gameId })
        .build()
    )
  }
  
  static gameAlreadyEnded(gameId: string): GameStateError {
    return new GameStateError(
      `Game ${gameId} has already ended`,
      new ErrorContextBuilder()
        .addGameContext(gameId)
        .addStateContext('game_end_check', { gameId })
        .build()
    )
  }
}

/**
 * Player Action Errors
 */
export class InvalidActionError extends GameError {
  readonly code = 'INVALID_ACTION'
  
  static notPlayerTurn(gameId: string, playerId: string, currentPlayer: string): InvalidActionError {
    return new InvalidActionError(
      `It's not ${playerId}'s turn (current: ${currentPlayer})`,
      new ErrorContextBuilder()
        .addGameContext(gameId, playerId)
        .addActionContext('turn_validation', { playerId, currentPlayer })
        .build()
    )
  }
  
  static invalidActionForPhase(gameId: string, playerId: string, action: string, phase: string): InvalidActionError {
    return new InvalidActionError(
      `Action ${action} is not valid in ${phase} phase`,
      new ErrorContextBuilder()
        .addGameContext(gameId, playerId)
        .addActionContext('phase_action_validation', { action, phase })
        .build()
    )
  }
  
  static insufficientResources(gameId: string, playerId: string, required: Record<string, number>, available: Record<string, number>): InvalidActionError {
    return new InvalidActionError(
      `Insufficient resources for action`,
      new ErrorContextBuilder()
        .addGameContext(gameId, playerId)
        .addActionContext('resource_validation', { required, available })
        .build()
    )
  }
  
  static invalidPlacement(gameId: string, playerId: string, position: any, reason: string): InvalidActionError {
    return new InvalidActionError(
      `Invalid placement at position: ${reason}`,
      new ErrorContextBuilder()
        .addGameContext(gameId, playerId)
        .addActionContext('placement_validation', { position, reason })
        .build()
    )
  }
}

/**
 * Game Rules Errors
 */
export class GameRulesError extends GameError {
  readonly code = 'GAME_RULES_VIOLATION'
  
  static invalidDiceRoll(gameId: string, playerId: string, diceValue: number): GameRulesError {
    return new GameRulesError(
      `Invalid dice roll: ${diceValue}`,
      new ErrorContextBuilder()
        .addGameContext(gameId, playerId)
        .addActionContext('dice_validation', { diceValue })
        .build()
    )
  }
  
  static invalidTradeProposal(gameId: string, playerId: string, tradeDetails: any): GameRulesError {
    return new GameRulesError(
      `Invalid trade proposal`,
      new ErrorContextBuilder()
        .addGameContext(gameId, playerId)
        .addActionContext('trade_validation', { tradeDetails })
        .build()
    )
  }
  
  static maxPlayersReached(gameId: string, maxPlayers: number): GameRulesError {
    return new GameRulesError(
      `Maximum players (${maxPlayers}) reached`,
      new ErrorContextBuilder()
        .addGameContext(gameId)
        .addStateContext('player_limit', { maxPlayers })
        .build()
    )
  }
  
  static invalidPlayerAction(gameId: string, playerId: string, action: string): GameRulesError {
    return new GameRulesError(
      `Player ${playerId} cannot perform action: ${action}`,
      new ErrorContextBuilder()
        .addGameContext(gameId, playerId)
        .addActionContext('player_action_validation', { action })
        .build()
    )
  }
}

/**
 * Game Configuration Errors
 */
export class GameConfigError extends GameError {
  readonly code = 'GAME_CONFIG_ERROR'
  
  static invalidGameConfig(configKey: string, value: any): GameConfigError {
    return new GameConfigError(
      `Invalid game configuration: ${configKey} = ${value}`,
      new ErrorContextBuilder()
        .addStateContext('config_validation', { configKey, value })
        .build()
    )
  }
  
  static incompatibleGameVersion(gameId: string, clientVersion: string, serverVersion: string): GameConfigError {
    return new GameConfigError(
      `Incompatible game version: client ${clientVersion}, server ${serverVersion}`,
      new ErrorContextBuilder()
        .addGameContext(gameId)
        .addStateContext('version_validation', { clientVersion, serverVersion })
        .build()
    )
  }
}

/**
 * AI Player Errors
 */
export class AIPlayerError extends GameError {
  readonly code = 'AI_PLAYER_ERROR'
  
  static aiDecisionTimeout(gameId: string, playerId: string, actionType: string, timeout: number): AIPlayerError {
    return new AIPlayerError(
      `AI decision timeout after ${timeout}ms for action: ${actionType}`,
      new ErrorContextBuilder()
        .addGameContext(gameId, playerId)
        .addActionContext('ai_timeout', { actionType, timeout })
        .build()
    )
  }
  
  static aiDecisionError(gameId: string, playerId: string, actionType: string, error: string): AIPlayerError {
    return new AIPlayerError(
      `AI decision error for action ${actionType}: ${error}`,
      new ErrorContextBuilder()
        .addGameContext(gameId, playerId)
        .addActionContext('ai_error', { actionType, error })
        .build()
    )
  }
  
  static invalidAIConfiguration(configKey: string, value: any): AIPlayerError {
    return new AIPlayerError(
      `Invalid AI configuration: ${configKey} = ${value}`,
      new ErrorContextBuilder()
        .addStateContext('ai_config_validation', { configKey, value })
        .build()
    )
  }
}

// All error classes are already exported via their class declarations