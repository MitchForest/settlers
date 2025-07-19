// ===== ERROR LOGGING UTILITY =====
// Structured error logging with context preservation

import { DomainError } from './domain-error'

/**
 * Structured error logger with context preservation
 */
export class ErrorLogger {
  private static instance: ErrorLogger
  private logLevel: LogLevel = 'info'
  private loggers: Map<LogLevel, LogFunction> = new Map()
  
  private constructor() {
    // Default console loggers
    this.loggers.set('error', console.error.bind(console))
    this.loggers.set('warn', console.warn.bind(console))
    this.loggers.set('info', console.info.bind(console))
    this.loggers.set('debug', console.debug.bind(console))
  }
  
  static getInstance(): ErrorLogger {
    if (!ErrorLogger.instance) {
      ErrorLogger.instance = new ErrorLogger()
    }
    return ErrorLogger.instance
  }
  
  /**
   * Configure custom loggers (for external logging services)
   */
  configure(config: {
    logLevel?: LogLevel
    loggers?: Partial<Record<LogLevel, LogFunction>>
  }): void {
    if (config.logLevel) {
      this.logLevel = config.logLevel
    }
    
    if (config.loggers) {
      Object.entries(config.loggers).forEach(([level, logger]) => {
        if (logger) {
          this.loggers.set(level as LogLevel, logger)
        }
      })
    }
  }
  
  /**
   * Log a domain error with full context
   */
  logError(error: DomainError, additionalContext?: Record<string, unknown>): void {
    const logger = this.loggers.get('error')
    if (!logger) return
    
    const logEntry: ErrorLogEntry = {
      level: 'error',
      timestamp: new Date().toISOString(),
      error: error.toDebugReport(),
      additionalContext: additionalContext || {},
      service: this.getServiceName(),
      environment: this.getEnvironment()
    }
    
    logger(JSON.stringify(logEntry, null, 2))
  }
  
  /**
   * Log a warning with context
   */
  logWarning(message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog('warn')) return
    
    const logger = this.loggers.get('warn')
    if (!logger) return
    
    const logEntry: WarningLogEntry = {
      level: 'warn',
      timestamp: new Date().toISOString(),
      message,
      context: context || {},
      service: this.getServiceName(),
      environment: this.getEnvironment()
    }
    
    logger(JSON.stringify(logEntry, null, 2))
  }
  
  /**
   * Log an info message with context
   */
  logInfo(message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog('info')) return
    
    const logger = this.loggers.get('info')
    if (!logger) return
    
    const logEntry: InfoLogEntry = {
      level: 'info',
      timestamp: new Date().toISOString(),
      message,
      context: context || {},
      service: this.getServiceName(),
      environment: this.getEnvironment()
    }
    
    logger(JSON.stringify(logEntry, null, 2))
  }
  
  /**
   * Log a debug message with context
   */
  logDebug(message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog('debug')) return
    
    const logger = this.loggers.get('debug')
    if (!logger) return
    
    const logEntry: DebugLogEntry = {
      level: 'debug',
      timestamp: new Date().toISOString(),
      message,
      context: context || {},
      service: this.getServiceName(),
      environment: this.getEnvironment()
    }
    
    logger(JSON.stringify(logEntry, null, 2))
  }
  
  /**
   * Create a child logger with additional context
   */
  createChildLogger(additionalContext: Record<string, unknown>): ChildErrorLogger {
    return new ChildErrorLogger(this, additionalContext)
  }
  
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['error', 'warn', 'info', 'debug']
    const currentLevelIndex = levels.indexOf(this.logLevel)
    const targetLevelIndex = levels.indexOf(level)
    
    return targetLevelIndex <= currentLevelIndex
  }
  
  private getServiceName(): string {
    return process.env.SERVICE_NAME || 'settlers-game'
  }
  
  private getEnvironment(): string {
    return process.env.NODE_ENV || 'development'
  }
}

/**
 * Child logger that adds context to all log entries
 */
export class ChildErrorLogger {
  constructor(
    private parent: ErrorLogger,
    private additionalContext: Record<string, unknown>
  ) {}
  
  logError(error: DomainError, context?: Record<string, unknown>): void {
    this.parent.logError(error, { ...this.additionalContext, ...context })
  }
  
  logWarning(message: string, context?: Record<string, unknown>): void {
    this.parent.logWarning(message, { ...this.additionalContext, ...context })
  }
  
  logInfo(message: string, context?: Record<string, unknown>): void {
    this.parent.logInfo(message, { ...this.additionalContext, ...context })
  }
  
  logDebug(message: string, context?: Record<string, unknown>): void {
    this.parent.logDebug(message, { ...this.additionalContext, ...context })
  }
}

/**
 * Convenience functions for global error logging
 */
export const logger = ErrorLogger.getInstance()

export function logError(error: DomainError, context?: Record<string, unknown>): void {
  logger.logError(error, context)
}

export function logWarning(message: string, context?: Record<string, unknown>): void {
  logger.logWarning(message, context)
}

export function logInfo(message: string, context?: Record<string, unknown>): void {
  logger.logInfo(message, context)
}

export function logDebug(message: string, context?: Record<string, unknown>): void {
  logger.logDebug(message, context)
}

/**
 * Types
 */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug'
export type LogFunction = (message: string) => void

export interface BaseLogEntry {
  level: LogLevel
  timestamp: string
  service: string
  environment: string
}

export interface ErrorLogEntry extends BaseLogEntry {
  level: 'error'
  error: {
    code: string
    domain: string
    message: string
    timestamp: string
    operationId: string
    context: Record<string, unknown>
    stack?: string
  }
  additionalContext: Record<string, unknown>
}

export interface WarningLogEntry extends BaseLogEntry {
  level: 'warn'
  message: string
  context: Record<string, unknown>
}

export interface InfoLogEntry extends BaseLogEntry {
  level: 'info'
  message: string
  context: Record<string, unknown>
}

export interface DebugLogEntry extends BaseLogEntry {
  level: 'debug'
  message: string
  context: Record<string, unknown>
}