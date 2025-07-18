// ===== HTTP STATUS MAPPER =====
// Maps domain errors to appropriate HTTP status codes

import { DomainError } from './domain-error'

/**
 * Maps domain errors to appropriate HTTP status codes
 */
export class HTTPStatusMapper {
  private static statusMap: Map<string, number> = new Map([
    // Game domain errors
    ['GAME_STATE_ERROR', 400],
    ['INVALID_ACTION', 400],
    ['GAME_RULES_VIOLATION', 400],
    ['GAME_CONFIG_ERROR', 400],
    ['AI_PLAYER_ERROR', 500],
    
    // System domain errors
    ['AUTHENTICATION_ERROR', 401],
    ['WEBSOCKET_ERROR', 500],
    ['VALIDATION_ERROR', 400],
    ['RATE_LIMIT_ERROR', 429],
    ['CONFIGURATION_ERROR', 500],
    ['EXTERNAL_SERVICE_ERROR', 502],
    
    // Social domain errors
    ['FRIEND_ERROR', 400],
    ['GAME_INVITE_ERROR', 400],
    ['LOBBY_ERROR', 400],
    ['PRESENCE_ERROR', 400],
  ])
  
  private static domainDefaultMap: Map<string, number> = new Map([
    ['game', 400],
    ['system', 500],
    ['social', 400],
  ])
  
  /**
   * Get HTTP status code for a domain error
   */
  static getStatusCode(error: DomainError): number {
    // First try to get status by specific error code
    const statusByCode = this.statusMap.get(error.code)
    if (statusByCode) {
      return statusByCode
    }
    
    // Fallback to domain default
    const statusByDomain = this.domainDefaultMap.get(error.domain)
    if (statusByDomain) {
      return statusByDomain
    }
    
    // Ultimate fallback
    return 500
  }
  
  /**
   * Register a custom status code for an error code
   */
  static registerStatusCode(errorCode: string, statusCode: number): void {
    this.statusMap.set(errorCode, statusCode)
  }
  
  /**
   * Register a default status code for a domain
   */
  static registerDomainDefault(domain: string, statusCode: number): void {
    this.domainDefaultMap.set(domain, statusCode)
  }
  
  /**
   * Get all registered status mappings
   */
  static getAllMappings(): { byCode: Map<string, number>; byDomain: Map<string, number> } {
    return {
      byCode: new Map(this.statusMap),
      byDomain: new Map(this.domainDefaultMap)
    }
  }
  
  /**
   * Create a standardized HTTP error response
   */
  static createErrorResponse(error: DomainError, includeStack = false): HTTPErrorResponse {
    const statusCode = this.getStatusCode(error)
    
    return {
      success: false,
      error: {
        code: error.code,
        domain: error.domain,
        message: error.message,
        timestamp: error.timestamp.toISOString(),
        operationId: error.operationId,
        ...(includeStack && { stack: error.stack })
      },
      statusCode,
      metadata: {
        version: '1.0',
        requestId: error.operationId
      }
    }
  }
  
  /**
   * Create a success response
   */
  static createSuccessResponse<T>(
    data: T,
    statusCode = 200,
    metadata?: Record<string, unknown>
  ): HTTPSuccessResponse<T> {
    return {
      success: true,
      data,
      statusCode,
      metadata: {
        version: '1.0',
        timestamp: new Date().toISOString(),
        ...metadata
      }
    }
  }
}

/**
 * Standard HTTP response interfaces
 */
export interface HTTPErrorResponse {
  success: false
  error: {
    code: string
    domain: string
    message: string
    timestamp: string
    operationId: string
    stack?: string
  }
  statusCode: number
  metadata: {
    version: string
    requestId: string
  }
}

export interface HTTPSuccessResponse<T> {
  success: true
  data: T
  statusCode: number
  metadata: {
    version: string
    timestamp: string
    [key: string]: unknown
  }
}

export type HTTPResponse<T> = HTTPSuccessResponse<T> | HTTPErrorResponse

/**
 * Convenience functions
 */
export function mapErrorToHTTP(error: DomainError, includeStack = false): HTTPErrorResponse {
  return HTTPStatusMapper.createErrorResponse(error, includeStack)
}

export function createHTTPSuccess<T>(
  data: T,
  statusCode = 200,
  metadata?: Record<string, unknown>
): HTTPSuccessResponse<T> {
  return HTTPStatusMapper.createSuccessResponse(data, statusCode, metadata)
}

export function getHTTPStatus(error: DomainError): number {
  return HTTPStatusMapper.getStatusCode(error)
}