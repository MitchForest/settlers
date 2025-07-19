// ===== ERROR HANDLER UTILITY =====
// Centralized error handling with recovery strategies

import { DomainError, Result, ResultUtils } from './domain-error'
import { ErrorLogger } from './error-logger'
import { ValidationError, GenericSystemError } from './system-errors'

/**
 * Centralized error handler with recovery strategies
 */
export class ErrorHandler {
  private static instance: ErrorHandler
  private logger: ErrorLogger
  private errorSubscribers: Set<ErrorSubscriber> = new Set()
  private recoveryStrategies: Map<string, RecoveryStrategy> = new Map()
  
  private constructor() {
    this.logger = ErrorLogger.getInstance()
    this.setupDefaultRecoveryStrategies()
  }
  
  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler()
    }
    return ErrorHandler.instance
  }
  
  /**
   * Handle a domain error with logging and recovery
   */
  handle<T>(error: DomainError, fallbackValue?: T): Result<T, DomainError> {
    // Log the error
    this.logger.logError(error)
    
    // Notify subscribers
    this.notifySubscribers(error)
    
    // Attempt recovery
    const recoveryResult = this.attemptRecovery(error)
    if (recoveryResult.success) {
      return recoveryResult as Result<T, DomainError>
    }
    
    // Return fallback value if provided
    if (fallbackValue !== undefined) {
      return ResultUtils.success(fallbackValue)
    }
    
    // Return the error
    return ResultUtils.failure(error)
  }
  
  /**
   * Handle an unknown error by converting to DomainError
   */
  handleUnknownError<T>(error: unknown, context?: Record<string, unknown>, fallbackValue?: T): Result<T, DomainError> {
    const domainError = this.convertToDomainError(error, context)
    return this.handle(domainError, fallbackValue)
  }
  
  /**
   * Safe async function execution with error handling
   */
  async safeAsync<T>(
    fn: () => Promise<T>,
    context?: Record<string, unknown>,
    fallbackValue?: T
  ): Promise<Result<T, DomainError>> {
    try {
      const result = await fn()
      return ResultUtils.success(result)
    } catch (error) {
      return this.handleUnknownError(error, context, fallbackValue)
    }
  }
  
  /**
   * Safe synchronous function execution with error handling
   */
  safeSync<T>(
    fn: () => T,
    context?: Record<string, unknown>,
    fallbackValue?: T
  ): Result<T, DomainError> {
    try {
      const result = fn()
      return ResultUtils.success(result)
    } catch (error) {
      return this.handleUnknownError(error, context, fallbackValue)
    }
  }
  
  /**
   * Subscribe to error notifications
   */
  subscribe(subscriber: ErrorSubscriber): void {
    this.errorSubscribers.add(subscriber)
  }
  
  /**
   * Unsubscribe from error notifications
   */
  unsubscribe(subscriber: ErrorSubscriber): void {
    this.errorSubscribers.delete(subscriber)
  }
  
  /**
   * Register a recovery strategy for specific error types
   */
  registerRecoveryStrategy(errorCode: string, strategy: RecoveryStrategy): void {
    this.recoveryStrategies.set(errorCode, strategy)
  }
  
  /**
   * Convert unknown error to DomainError
   */
  private convertToDomainError(error: unknown, context?: Record<string, unknown>): DomainError {
    if (error instanceof DomainError) {
      return error
    }
    
    if (error instanceof Error) {
      return new GenericSystemError(error.message, {
        originalError: error.name,
        stack: error.stack,
        ...context
      })
    }
    
    return new GenericSystemError(
      `Unknown error: ${String(error)}`,
      {
        originalError: error,
        ...context
      }
    )
  }
  
  /**
   * Attempt to recover from an error
   */
  private attemptRecovery(error: DomainError): Result<unknown, DomainError> {
    const strategy = this.recoveryStrategies.get(error.code)
    if (!strategy) {
      return ResultUtils.failure(error)
    }
    
    try {
      const result = strategy.recover(error)
      this.logger.logInfo(`Recovery attempted for error ${error.code}`, {
        operationId: error.operationId,
        recoverySuccess: result.success
      })
      return result
    } catch (recoveryError) {
      this.logger.logWarning(`Recovery failed for error ${error.code}`, {
        operationId: error.operationId,
        recoveryError: String(recoveryError)
      })
      return ResultUtils.failure(error)
    }
  }
  
  /**
   * Notify all subscribers of an error
   */
  private notifySubscribers(error: DomainError): void {
    this.errorSubscribers.forEach(subscriber => {
      try {
        subscriber.onError(error)
      } catch (subscriptionError) {
        this.logger.logWarning('Error subscriber failed', {
          operationId: error.operationId,
          subscriptionError: String(subscriptionError)
        })
      }
    })
  }
  
  /**
   * Set up default recovery strategies
   */
  private setupDefaultRecoveryStrategies(): void {
    // Validation error recovery - return validation error details
    this.registerRecoveryStrategy('VALIDATION_ERROR', {
      recover: (error: DomainError) => {
        if (error instanceof ValidationError) {
          return ResultUtils.success({
            validationErrors: error.context,
            canRetry: true
          })
        }
        return ResultUtils.failure(error)
      }
    })
    
    // WebSocket connection recovery - attempt reconnection
    this.registerRecoveryStrategy('WEBSOCKET_ERROR', {
      recover: (_error: DomainError) => {
        return ResultUtils.success({
          shouldReconnect: true,
          reconnectDelay: 5000
        })
      }
    })
  }
}

/**
 * Error subscriber interface
 */
export interface ErrorSubscriber {
  onError(_error: DomainError): void
}

/**
 * Recovery strategy interface
 */
export interface RecoveryStrategy {
  recover(_error: DomainError): Result<unknown, DomainError>
}

/**
 * Convenience functions for global error handling
 */
export const errorHandler = ErrorHandler.getInstance()

export function handleError<T>(error: DomainError, fallbackValue?: T): Result<T, DomainError> {
  return errorHandler.handle(error, fallbackValue)
}

export function handleUnknownError<T>(
  error: unknown,
  context?: Record<string, unknown>,
  fallbackValue?: T
): Result<T, DomainError> {
  return errorHandler.handleUnknownError(error, context, fallbackValue)
}

export async function safeAsync<T>(
  fn: () => Promise<T>,
  context?: Record<string, unknown>,
  fallbackValue?: T
): Promise<Result<T, DomainError>> {
  return errorHandler.safeAsync(fn, context, fallbackValue)
}

export function safeSync<T>(
  fn: () => T,
  context?: Record<string, unknown>,
  fallbackValue?: T
): Result<T, DomainError> {
  return errorHandler.safeSync(fn, context, fallbackValue)
}