// ===== UNIFIED ERROR HANDLING SYSTEM =====
// ZERO TECHNICAL DEBT - Complete error hierarchy with debugging context

import { randomUUID } from 'crypto'

/**
 * Base class for all domain errors with structured debugging context
 * 
 * Provides:
 * - Unique error codes for programmatic handling
 * - Domain segregation for organized error management
 * - Full debugging context with operation tracking
 * - Timestamp and operation ID for tracing
 */
export abstract class DomainError extends Error {
  abstract readonly code: string
  abstract readonly domain: string
  readonly timestamp: Date
  readonly context: Record<string, unknown>
  readonly operationId: string
  
  constructor(message: string, context: Record<string, unknown> = {}) {
    super(message)
    this.name = this.constructor.name
    this.timestamp = new Date()
    this.context = context
    this.operationId = randomUUID()
    
    // Ensure proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
  
  /**
   * Create a detailed error report for debugging
   */
  toDebugReport(): ErrorDebugReport {
    return {
      code: this.code,
      domain: this.domain,
      message: this.message,
      timestamp: this.timestamp.toISOString(),
      operationId: this.operationId,
      context: this.context,
      stack: this.stack
    }
  }
  
  /**
   * Create a safe error report for client responses (no stack trace)
   */
  toClientReport(): ErrorClientReport {
    return {
      code: this.code,
      domain: this.domain,
      message: this.message,
      timestamp: this.timestamp.toISOString(),
      operationId: this.operationId
    }
  }
}

/**
 * Result pattern for consistent error propagation
 * 
 * Replaces throw/catch with explicit error handling
 * Enables type-safe error handling throughout the system
 */
export type Result<T, E extends DomainError = DomainError> = 
  | { success: true; data: T }
  | { success: false; error: E }

/**
 * Utility functions for Result pattern
 */
export const Result = {
  success: <T>(data: T): Result<T, never> => ({ success: true, data }),
  failure: <E extends DomainError>(error: E): Result<never, E> => ({ success: false, error }),
  
  isSuccess: <T, E extends DomainError>(result: Result<T, E>): result is { success: true; data: T } => 
    result.success,
  
  isFailure: <T, E extends DomainError>(result: Result<T, E>): result is { success: false; error: E } => 
    !result.success,
  
  map: <T, U, E extends DomainError>(
    result: Result<T, E>, 
    fn: (data: T) => U
  ): Result<U, E> => {
    if (result.success) {
      return Result.success(fn(result.data))
    }
    return result
  },
  
  flatMap: <T, U, E extends DomainError>(
    result: Result<T, E>, 
    fn: (data: T) => Result<U, E>
  ): Result<U, E> => {
    if (result.success) {
      return fn(result.data)
    }
    return result
  }
}

/**
 * Error context builder for structured debugging
 */
export class ErrorContextBuilder {
  private context: Record<string, unknown> = {}
  
  addGameContext(gameId: string, playerId?: string): this {
    this.context.gameId = gameId
    if (playerId) this.context.playerId = playerId
    return this
  }
  
  addActionContext(actionType: string, payload: any): this {
    this.context.actionType = actionType
    this.context.payload = payload
    return this
  }
  
  addStateContext(stateName: string, stateData: any): this {
    this.context.stateName = stateName
    this.context.stateData = stateData
    return this
  }
  
  addValidationContext(validator: string, input: any): this {
    this.context.validator = validator
    this.context.input = input
    return this
  }
  
  addWebSocketContext(messageType: string, connectionId: string): this {
    this.context.messageType = messageType
    this.context.connectionId = connectionId
    return this
  }
  
  addQueryContext(queryName: string, parameters: any): this {
    this.context.queryName = queryName
    this.context.parameters = parameters
    return this
  }
  
  build(): Record<string, unknown> {
    return { ...this.context }
  }
  
  static forCommand(commandName: string, payload: any): Record<string, unknown> {
    return new ErrorContextBuilder()
      .addActionContext(commandName, payload)
      .build()
  }
  
  static forQuery(queryName: string, params: any): Record<string, unknown> {
    return new ErrorContextBuilder()
      .addQueryContext(queryName, params)
      .build()
  }
  
  static forWebSocket(messageType: string, connectionId: string): Record<string, unknown> {
    return new ErrorContextBuilder()
      .addWebSocketContext(messageType, connectionId)
      .build()
  }
}

/**
 * Error report interfaces
 */
export interface ErrorDebugReport {
  code: string
  domain: string
  message: string
  timestamp: string
  operationId: string
  context: Record<string, unknown>
  stack?: string
}

export interface ErrorClientReport {
  code: string
  domain: string
  message: string
  timestamp: string
  operationId: string
}