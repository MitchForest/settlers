// Friend Event Store - Event sourcing types for friends domain
// Follows exact same patterns as GameEvent for consistency

export interface FriendEvent {
  id: string
  aggregateId: string // userId who initiated the action
  eventType: FriendEventType
  data: any
  sequenceNumber: number
  timestamp: Date
}

export type FriendEventType = 
  | 'friend_request_sent'
  | 'friend_request_accepted'
  | 'friend_request_rejected'
  | 'friend_request_cancelled'
  | 'friend_removed'
  | 'presence_updated'

// Event data interfaces for type safety

export interface FriendRequestSentData {
  requestId: string
  fromUserId: string
  toUserId: string
  fromUser: {
    id: string
    name: string
    email: string
    avatarEmoji: string | null
  }
  toUser: {
    id: string
    name: string
    email: string
    avatarEmoji: string | null
  }
  message?: string
  timestamp: string
}

export interface FriendRequestAcceptedData {
  requestId: string
  friendshipId: string
  fromUserId: string
  toUserId: string
  fromUser: {
    id: string
    name: string
    email: string
    avatarEmoji: string | null
  }
  toUser: {
    id: string
    name: string
    email: string
    avatarEmoji: string | null
  }
  timestamp: string
}

export interface FriendRequestRejectedData {
  requestId: string
  fromUserId: string
  toUserId: string
  rejectingUserId: string
  timestamp: string
}

export interface FriendRequestCancelledData {
  requestId: string
  fromUserId: string
  toUserId: string
  cancellingUserId: string
  timestamp: string
}

export interface FriendRemovedData {
  friendshipId: string
  removedUserId: string
  removedByUserId: string
  timestamp: string
}

export interface PresenceUpdatedData {
  userId: string
  status: 'online' | 'away' | 'busy' | 'offline'
  gameId?: string
  timestamp: string
} 