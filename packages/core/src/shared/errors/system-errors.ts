// ===== SYSTEM DOMAIN ERROR CLASSES =====
// System-level errors for WebSocket, authentication, and infrastructure

import { DomainError, ErrorContextBuilder } from './domain-error'

/**
 * Base class for all system domain errors
 */
export abstract class SystemError extends DomainError {
  readonly domain = 'system'
}

/**
 * Authentication and Authorization Errors
 */
export class AuthenticationError extends SystemError {
  readonly code = 'AUTHENTICATION_ERROR'
  
  static invalidCredentials(userId?: string): AuthenticationError {
    return new AuthenticationError(
      'Invalid credentials provided',
      new ErrorContextBuilder()
        .addStateContext('auth_validation', { userId })
        .build()
    )
  }
  
  static sessionExpired(userId: string): AuthenticationError {
    return new AuthenticationError(
      `Session expired for user ${userId}`,
      new ErrorContextBuilder()
        .addStateContext('session_validation', { userId })
        .build()
    )
  }
  
  static insufficientPermissions(userId: string, requiredPermission: string): AuthenticationError {
    return new AuthenticationError(
      `User ${userId} lacks permission: ${requiredPermission}`,
      new ErrorContextBuilder()
        .addStateContext('permission_validation', { userId, requiredPermission })
        .build()
    )
  }
  
  static userNotFound(userId: string): AuthenticationError {
    return new AuthenticationError(
      `User ${userId} not found`,
      new ErrorContextBuilder()
        .addStateContext('user_lookup', { userId })
        .build()
    )
  }
}

/**
 * WebSocket Connection Errors
 */
export class WebSocketError extends SystemError {
  readonly code = 'WEBSOCKET_ERROR'
  
  static connectionFailed(connectionId: string, reason: string): WebSocketError {
    return new WebSocketError(
      `WebSocket connection failed: ${reason}`,
      new ErrorContextBuilder()
        .addWebSocketContext('connection_failed', connectionId)
        .addStateContext('connection_details', { reason })
        .build()
    )
  }
  
  static messageDeliveryFailed(connectionId: string, messageType: string, error: string): WebSocketError {
    return new WebSocketError(
      `Failed to deliver message ${messageType}: ${error}`,
      new ErrorContextBuilder()
        .addWebSocketContext(messageType, connectionId)
        .addStateContext('delivery_error', { error })
        .build()
    )
  }
  
  static invalidMessage(connectionId: string, messageType: string, payload: any): WebSocketError {
    return new WebSocketError(
      `Invalid WebSocket message: ${messageType}`,
      new ErrorContextBuilder()
        .addWebSocketContext(messageType, connectionId)
        .addStateContext('message_validation', { payload })
        .build()
    )
  }
  
  static connectionLimit(maxConnections: number): WebSocketError {
    return new WebSocketError(
      `Maximum WebSocket connections (${maxConnections}) exceeded`,
      new ErrorContextBuilder()
        .addStateContext('connection_limit', { maxConnections })
        .build()
    )
  }
  
  static heartbeatTimeout(connectionId: string, timeoutMs: number): WebSocketError {
    return new WebSocketError(
      `WebSocket heartbeat timeout after ${timeoutMs}ms`,
      new ErrorContextBuilder()
        .addWebSocketContext('heartbeat_timeout', connectionId)
        .addStateContext('timeout_details', { timeoutMs })
        .build()
    )
  }
}

/**
 * Data Validation Errors
 */
export class ValidationError extends SystemError {
  readonly code = 'VALIDATION_ERROR'
  
  static invalidInput(field: string, value: any, expected: string): ValidationError {
    return new ValidationError(
      `Invalid ${field}: expected ${expected}, got ${value}`,
      new ErrorContextBuilder()
        .addValidationContext('input_validation', { field, value, expected })
        .build()
    )
  }
  
  static missingRequiredField(field: string, input: any): ValidationError {
    return new ValidationError(
      `Missing required field: ${field}`,
      new ErrorContextBuilder()
        .addValidationContext('required_field', { field, input })
        .build()
    )
  }
  
  static invalidFormat(field: string, value: any, format: string): ValidationError {
    return new ValidationError(
      `Invalid format for ${field}: expected ${format}`,
      new ErrorContextBuilder()
        .addValidationContext('format_validation', { field, value, format })
        .build()
    )
  }
  
  static outOfRange(field: string, value: any, min: number, max: number): ValidationError {
    return new ValidationError(
      `${field} value ${value} is out of range (${min}-${max})`,
      new ErrorContextBuilder()
        .addValidationContext('range_validation', { field, value, min, max })
        .build()
    )
  }
}

/**
 * Rate Limiting Errors
 */
export class RateLimitError extends SystemError {
  readonly code = 'RATE_LIMIT_ERROR'
  
  static tooManyRequests(userId: string, endpoint: string, limit: number, windowMs: number): RateLimitError {
    return new RateLimitError(
      `Rate limit exceeded: ${limit} requests per ${windowMs}ms`,
      new ErrorContextBuilder()
        .addStateContext('rate_limit', { userId, endpoint, limit, windowMs })
        .build()
    )
  }
  
  static actionCooldown(userId: string, action: string, remainingMs: number): RateLimitError {
    return new RateLimitError(
      `Action ${action} is on cooldown for ${remainingMs}ms`,
      new ErrorContextBuilder()
        .addStateContext('cooldown', { userId, action, remainingMs })
        .build()
    )
  }
}

/**
 * Configuration Errors
 */
export class ConfigurationError extends SystemError {
  readonly code = 'CONFIGURATION_ERROR'
  
  static missingEnvironmentVariable(variableName: string): ConfigurationError {
    return new ConfigurationError(
      `Missing required environment variable: ${variableName}`,
      new ErrorContextBuilder()
        .addStateContext('env_validation', { variableName })
        .build()
    )
  }
  
  static invalidConfiguration(key: string, value: any, expected: string): ConfigurationError {
    return new ConfigurationError(
      `Invalid configuration ${key}: expected ${expected}, got ${value}`,
      new ErrorContextBuilder()
        .addStateContext('config_validation', { key, value, expected })
        .build()
    )
  }
}

/**
 * External Service Errors
 */
export class ExternalServiceError extends SystemError {
  readonly code = 'EXTERNAL_SERVICE_ERROR'
  
  static serviceUnavailable(serviceName: string, error: string): ExternalServiceError {
    return new ExternalServiceError(
      `External service ${serviceName} is unavailable: ${error}`,
      new ErrorContextBuilder()
        .addStateContext('service_availability', { serviceName, error })
        .build()
    )
  }
  
  static serviceTimeout(serviceName: string, timeoutMs: number): ExternalServiceError {
    return new ExternalServiceError(
      `External service ${serviceName} timed out after ${timeoutMs}ms`,
      new ErrorContextBuilder()
        .addStateContext('service_timeout', { serviceName, timeoutMs })
        .build()
    )
  }
  
  static apiRateLimit(serviceName: string, resetTime: Date): ExternalServiceError {
    return new ExternalServiceError(
      `External service ${serviceName} rate limit exceeded`,
      new ErrorContextBuilder()
        .addStateContext('api_rate_limit', { serviceName, resetTime })
        .build()
    )
  }
}

// All error classes are already exported via their class declarations