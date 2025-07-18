// ===== UNIFIED ERROR SYSTEM EXPORTS =====
// Central export point for all error handling utilities

// Core error system
export {
  DomainError,
  Result,
  ErrorContextBuilder,
  type ErrorDebugReport,
  type ErrorClientReport
} from './domain-error'

// Game domain errors
export {
  GameError,
  GameStateError,
  InvalidActionError,
  GameRulesError,
  GameConfigError,
  AIPlayerError
} from './game-errors'

// System domain errors
export {
  SystemError,
  GenericSystemError,
  AuthenticationError,
  WebSocketError,
  ValidationError,
  RateLimitError,
  ConfigurationError,
  ExternalServiceError
} from './system-errors'

// Social domain errors
export {
  SocialError,
  FriendError,
  GameInviteError,
  LobbyError,
  PresenceError
} from './social-errors'

// Error utilities
export { ErrorLogger } from './error-logger'
export { ErrorHandler } from './error-handler'
export { HTTPStatusMapper } from './http-status-mapper'