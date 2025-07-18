// ===== ERROR SYSTEM TESTS =====
// Comprehensive tests for the unified error handling system

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  DomainError,
  Result,
  ErrorContextBuilder,
  GameStateError,
  InvalidActionError,
  AuthenticationError,
  WebSocketError,
  FriendError,
  GameInviteError,
  ErrorLogger,
  ErrorHandler,
  HTTPStatusMapper
} from '../index'

describe('Unified Error System', () => {
  describe('DomainError', () => {
    it('should create a domain error with proper structure', () => {
      const error = GameStateError.gameNotFound('test-game-123')
      
      expect(error.code).toBe('GAME_STATE_ERROR')
      expect(error.domain).toBe('game')
      expect(error.message).toBe('Game with ID test-game-123 not found')
      expect(error.timestamp).toBeInstanceOf(Date)
      expect(error.operationId).toBeDefined()
      expect(error.context).toEqual({
        gameId: 'test-game-123',
        stateName: 'game_lookup',
        stateData: { gameId: 'test-game-123' }
      })
    })
    
    it('should create debug report with stack trace', () => {
      const error = GameStateError.gameNotFound('test-game-123')
      const debugReport = error.toDebugReport()
      
      expect(debugReport.code).toBe('GAME_STATE_ERROR')
      expect(debugReport.domain).toBe('game')
      expect(debugReport.message).toBe('Game with ID test-game-123 not found')
      expect(debugReport.timestamp).toBeDefined()
      expect(debugReport.operationId).toBeDefined()
      expect(debugReport.context).toBeDefined()
      expect(debugReport.stack).toBeDefined()
    })
    
    it('should create client report without stack trace', () => {
      const error = GameStateError.gameNotFound('test-game-123')
      const clientReport = error.toClientReport()
      
      expect(clientReport.code).toBe('GAME_STATE_ERROR')
      expect(clientReport.domain).toBe('game')
      expect(clientReport.stack).toBeUndefined()
    })
  })
  
  describe('Result Pattern', () => {
    it('should create success result', () => {
      const result = Result.success('test-data')
      
      expect(result.success).toBe(true)
      expect(result.data).toBe('test-data')
    })
    
    it('should create failure result', () => {
      const error = GameStateError.gameNotFound('test-game-123')
      const result = Result.failure(error)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe(error)
    })
    
    it('should map successful result', () => {
      const result = Result.success(5)
      const mapped = Result.map(result, (x) => x * 2)
      
      expect(mapped.success).toBe(true)
      expect(mapped.data).toBe(10)
    })
    
    it('should not map failed result', () => {
      const error = GameStateError.gameNotFound('test-game-123')
      const result = Result.failure(error)
      const mapped = Result.map(result, (x) => x * 2)
      
      expect(mapped.success).toBe(false)
      expect(mapped.error).toBe(error)
    })
    
    it('should flatMap successful result', () => {
      const result = Result.success(5)
      const mapped = Result.flatMap(result, (x) => Result.success(x * 2))
      
      expect(mapped.success).toBe(true)
      expect(mapped.data).toBe(10)
    })
    
    it('should flatMap to failure', () => {
      const result = Result.success(5)
      const error = GameStateError.gameNotFound('test-game-123')
      const mapped = Result.flatMap(result, () => Result.failure(error))
      
      expect(mapped.success).toBe(false)
      expect(mapped.error).toBe(error)
    })
  })
  
  describe('ErrorContextBuilder', () => {
    it('should build game context', () => {
      const context = new ErrorContextBuilder()
        .addGameContext('game-123', 'player-456')
        .addActionContext('build_settlement', { position: { x: 1, y: 2 } })
        .build()
      
      expect(context).toEqual({
        gameId: 'game-123',
        playerId: 'player-456',
        actionType: 'build_settlement',
        payload: { position: { x: 1, y: 2 } }
      })
    })
    
    it('should build WebSocket context', () => {
      const context = new ErrorContextBuilder()
        .addWebSocketContext('game_message', 'conn-123')
        .build()
      
      expect(context).toEqual({
        messageType: 'game_message',
        connectionId: 'conn-123'
      })
    })
    
    it('should build validation context', () => {
      const context = new ErrorContextBuilder()
        .addValidationContext('dice_roll', { value: 13 })
        .build()
      
      expect(context).toEqual({
        validator: 'dice_roll',
        input: { value: 13 }
      })
    })
    
    it('should provide static helper methods', () => {
      const commandContext = ErrorContextBuilder.forCommand('roll_dice', { value: 7 })
      expect(commandContext).toEqual({
        actionType: 'roll_dice',
        payload: { value: 7 }
      })
      
      const queryContext = ErrorContextBuilder.forQuery('get_game_state', { gameId: 'game-123' })
      expect(queryContext).toEqual({
        queryName: 'get_game_state',
        parameters: { gameId: 'game-123' }
      })
      
      const websocketContext = ErrorContextBuilder.forWebSocket('game_message', 'conn-123')
      expect(websocketContext).toEqual({
        messageType: 'game_message',
        connectionId: 'conn-123'
      })
    })
  })
  
  describe('Game Domain Errors', () => {
    it('should create game state errors with proper context', () => {
      const error = GameStateError.invalidPhase('setup', 'main_game', 'game-123')
      
      expect(error.code).toBe('GAME_STATE_ERROR')
      expect(error.domain).toBe('game')
      expect(error.message).toBe('Game is in setup phase, expected main_game')
      expect(error.context.gameId).toBe('game-123')
      expect(error.context.stateName).toBe('phase_validation')
    })
    
    it('should create invalid action errors', () => {
      const error = InvalidActionError.notPlayerTurn('game-123', 'player-456', 'player-789')
      
      expect(error.code).toBe('INVALID_ACTION')
      expect(error.domain).toBe('game')
      expect(error.message).toBe("It's not player-456's turn (current: player-789)")
      expect(error.context.gameId).toBe('game-123')
      expect(error.context.playerId).toBe('player-456')
    })
    
    it('should create insufficient resources error', () => {
      const required = { wood: 2, brick: 1 }
      const available = { wood: 1, brick: 0 }
      const error = InvalidActionError.insufficientResources('game-123', 'player-456', required, available)
      
      expect(error.code).toBe('INVALID_ACTION')
      expect(error.context.actionType).toBe('resource_validation')
      expect(error.context.payload).toEqual({ required, available })
    })
  })
  
  describe('System Domain Errors', () => {
    it('should create authentication errors', () => {
      const error = AuthenticationError.sessionExpired('user-123')
      
      expect(error.code).toBe('AUTHENTICATION_ERROR')
      expect(error.domain).toBe('system')
      expect(error.message).toBe('Session expired for user user-123')
    })
    
    it('should create WebSocket errors', () => {
      const error = WebSocketError.connectionFailed('conn-123', 'network timeout')
      
      expect(error.code).toBe('WEBSOCKET_ERROR')
      expect(error.domain).toBe('system')
      expect(error.message).toBe('WebSocket connection failed: network timeout')
      expect(error.context.connectionId).toBe('conn-123')
    })
  })
  
  describe('Social Domain Errors', () => {
    it('should create friend errors', () => {
      const error = FriendError.friendRequestAlreadyExists('user-123', 'user-456')
      
      expect(error.code).toBe('FRIEND_ERROR')
      expect(error.domain).toBe('social')
      expect(error.message).toBe('Friend request already exists between user-123 and user-456')
    })
    
    it('should create game invite errors', () => {
      const error = GameInviteError.gameAlreadyStarted('game-123')
      
      expect(error.code).toBe('GAME_INVITE_ERROR')
      expect(error.domain).toBe('social')
      expect(error.message).toBe('Cannot accept invite - game game-123 has already started')
    })
  })
  
  describe('HTTPStatusMapper', () => {
    it('should map game errors to 400', () => {
      const error = GameStateError.gameNotFound('game-123')
      const statusCode = HTTPStatusMapper.getStatusCode(error)
      
      expect(statusCode).toBe(400)
    })
    
    it('should map authentication errors to 401', () => {
      const error = AuthenticationError.sessionExpired('user-123')
      const statusCode = HTTPStatusMapper.getStatusCode(error)
      
      expect(statusCode).toBe(401)
    })
    
    it('should map WebSocket errors to 500', () => {
      const error = WebSocketError.connectionFailed('conn-123', 'network error')
      const statusCode = HTTPStatusMapper.getStatusCode(error)
      
      expect(statusCode).toBe(500)
    })
    
    it('should create error response', () => {
      const error = GameStateError.gameNotFound('game-123')
      const response = HTTPStatusMapper.createErrorResponse(error)
      
      expect(response.success).toBe(false)
      expect(response.error.code).toBe('GAME_STATE_ERROR')
      expect(response.error.domain).toBe('game')
      expect(response.statusCode).toBe(400)
      expect(response.metadata.version).toBe('1.0')
      expect(response.metadata.requestId).toBe(error.operationId)
    })
    
    it('should create success response', () => {
      const data = { gameId: 'game-123', status: 'active' }
      const response = HTTPStatusMapper.createSuccessResponse(data, 200, { source: 'test' })
      
      expect(response.success).toBe(true)
      expect(response.data).toBe(data)
      expect(response.statusCode).toBe(200)
      expect(response.metadata.version).toBe('1.0')
      expect(response.metadata.source).toBe('test')
    })
  })
  
  describe('ErrorLogger', () => {
    it('should create logger instance', () => {
      const logger = ErrorLogger.getInstance()
      expect(logger).toBeDefined()
      expect(typeof logger.logError).toBe('function')
      expect(typeof logger.createChildLogger).toBe('function')
    })
    
    it('should create child logger with additional context', () => {
      const logger = ErrorLogger.getInstance()
      const childLogger = logger.createChildLogger({ service: 'game-service' })
      
      expect(childLogger).toBeDefined()
      expect(typeof childLogger.logError).toBe('function')
      expect(typeof childLogger.logWarning).toBe('function')
      expect(typeof childLogger.logInfo).toBe('function')
      expect(typeof childLogger.logDebug).toBe('function')
    })
  })
  
  describe('ErrorHandler', () => {
    it('should handle domain errors with Result pattern', () => {
      const handler = ErrorHandler.getInstance()
      const error = GameStateError.gameNotFound('game-123')
      
      const result = handler.handle(error)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe(error)
    })
    
    it('should handle unknown errors', () => {
      const handler = ErrorHandler.getInstance()
      const unknownError = new Error('Unknown error')
      
      const result = handler.handleUnknownError(unknownError)
      
      expect(result.success).toBe(false)
      expect(result.error.domain).toBe('system')
      expect(result.error.message).toBe('Unknown error')
    })
    
    it('should execute safe async functions', async () => {
      const handler = ErrorHandler.getInstance()
      
      const successResult = await handler.safeAsync(async () => 'success')
      expect(successResult.success).toBe(true)
      expect(successResult.data).toBe('success')
      
      const errorResult = await handler.safeAsync(async () => {
        throw new Error('async error')
      })
      expect(errorResult.success).toBe(false)
    })
    
    it('should execute safe sync functions', () => {
      const handler = ErrorHandler.getInstance()
      
      const successResult = handler.safeSync(() => 'success')
      expect(successResult.success).toBe(true)
      expect(successResult.data).toBe('success')
      
      const errorResult = handler.safeSync(() => {
        throw new Error('sync error')
      })
      expect(errorResult.success).toBe(false)
    })
  })
})