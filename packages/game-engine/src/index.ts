// Game Engine - Heavy game logic, only loaded when playing
export * from './board'
export * from './core'
export * from './types'
export * from './constants'

// Specific exports to avoid conflicts
export { processAction, createActionProcessor, ProcessorRegistry } from './processors'
export type { ActionProcessor, ProcessResult, ValidationResult } from './processors'

// Event exports - specific event types and interfaces
export type { GameEvent, EventType, EventStream } from './events/event-store'
export type { 
  FriendEvent, 
  FriendEventType,
  FriendRequestSentData,
  FriendRequestAcceptedData,
  FriendRequestRejectedData,
  FriendRequestCancelledData,
  FriendRemovedData,
  PresenceUpdatedData
} from './events/friend-event-store'
export type { 
  GameInviteEvent, 
  GameInviteEventType,
  GameInviteSentEventData,
  GameInviteAcceptedEventData,
  GameInviteDeclinedEventData,
  GameInviteExpiredEventData,
  GameInviteCancelledEventData
} from './events/game-invite-event-store'

// Specific exports to avoid conflicts with types
export * from './setup'
export * from './validation'
export { LobbyManager } from './lobby'
export * from './errors'
export type { Result } from './errors/domain-error'
export { ResultUtils } from './errors/domain-error'

// All types are exported from the types directory above 