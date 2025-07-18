// ===== STANDARDIZED API RESPONSE FORMATTER =====
// Consistent response patterns with proper error handling

import { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { DomainError } from '@settlers/core/src/shared/errors'

/**
 * Standardized API response envelope
 */
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
  metadata?: {
    timestamp: string
    requestId: string
    version: string
  }
}

/**
 * Success response helper
 */
export function successResponse<T>(
  c: Context,
  data: T,
  statusCode: number = 200
): Response {
  const response: ApiResponse<T> = {
    success: true,
    data,
    metadata: {
      timestamp: new Date().toISOString(),
      requestId: c.req.header('x-request-id') || generateRequestId(),
      version: 'v1'
    }
  }
  
  return c.json(response, statusCode as any)
}

/**
 * Error response helper
 */
export function errorResponse(
  c: Context,
  error: Error | DomainError | string,
  statusCode: number = 500
): Response {
  let errorCode: string
  let errorMessage: string
  let details: Record<string, unknown> | undefined = undefined
  
  if (error instanceof DomainError) {
    errorCode = error.code
    errorMessage = error.message
    details = error.context
    statusCode = mapDomainErrorToHttpStatus(error)
  } else if (error instanceof Error) {
    errorCode = error.name || 'UNKNOWN_ERROR'
    errorMessage = error.message
  } else {
    errorCode = 'GENERIC_ERROR'
    errorMessage = String(error)
  }
  
  const response: ApiResponse = {
    success: false,
    error: {
      code: errorCode,
      message: errorMessage,
      details
    },
    metadata: {
      timestamp: new Date().toISOString(),
      requestId: c.req.header('x-request-id') || generateRequestId(),
      version: 'v1'
    }
  }
  
  return c.json(response, statusCode as any)
}

/**
 * Map domain errors to HTTP status codes
 */
function mapDomainErrorToHttpStatus(error: DomainError): number {
  switch (error.code) {
    case 'INVALID_ACTION':
    case 'GAME_RULES_ERROR':
    case 'VALIDATION_ERROR':
      return 400
    case 'GAME_NOT_FOUND':
    case 'PLAYER_NOT_FOUND':
      return 404
    case 'AUTHENTICATION_ERROR':
      return 401
    case 'RATE_LIMIT_ERROR':
      return 429
    case 'EXTERNAL_SERVICE_ERROR':
      return 503
    default:
      return 500
  }
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Middleware to add standardized error handling
 */
export const errorHandlerMiddleware = async (
  c: Context,
  next: () => Promise<void>
) => {
  try {
    await next()
  } catch (error) {
    console.error('API Error:', error)
    
    if (error instanceof HTTPException) {
      return errorResponse(c, error.message, error.status)
    }
    
    return errorResponse(c, error as Error, 500)
  }
}

/**
 * Middleware to add request ID to all responses
 */
export const requestIdMiddleware = async (
  c: Context,
  next: () => Promise<void>
) => {
  const requestId = c.req.header('x-request-id') || generateRequestId()
  c.set('requestId', requestId)
  c.res.headers.set('x-request-id', requestId)
  await next()
}