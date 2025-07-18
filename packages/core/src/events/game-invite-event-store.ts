// Game invite event store - Event sourcing for game invitations
// Follows same patterns as friend-event-store.ts for consistency

export type GameInviteEventType = 
  | 'game_invite_sent'
  | 'game_invite_accepted'
  | 'game_invite_declined'
  | 'game_invite_expired'
  | 'game_invite_cancelled'

// Base interface for all game invite events
export interface GameInviteEvent {
  id: string
  aggregateId: string // userId who received the invite (target user)
  eventType: GameInviteEventType
  data: Record<string, any>
  sequenceNumber: number
  timestamp: string
}

// Specific event data interfaces
export interface GameInviteSentEventData {
  inviteId: string
  gameId: string
  fromUserId: string
  fromUserName: string
  fromUserAvatar?: string
  gameCode?: string
  message?: string
  expiresAt: string
}

export interface GameInviteAcceptedEventData {
  inviteId: string
  gameId: string
  fromUserId: string
  joinedAt: string
}

export interface GameInviteDeclinedEventData {
  inviteId: string
  gameId: string
  fromUserId: string
  declinedAt: string
}

export interface GameInviteExpiredEventData {
  inviteId: string
  gameId: string
  fromUserId: string
  expiredAt: string
}

export interface GameInviteCancelledEventData {
  inviteId: string
  gameId: string
  fromUserId: string
  cancelledAt: string
}

// Union type for all event data
export type GameInviteEventData = 
  | GameInviteSentEventData
  | GameInviteAcceptedEventData
  | GameInviteDeclinedEventData
  | GameInviteExpiredEventData
  | GameInviteCancelledEventData

// State interfaces
export interface GameInvite {
  id: string
  gameId: string
  fromUserId: string
  fromUserName: string
  fromUserAvatar?: string
  gameCode?: string
  message?: string
  status: 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled'
  sentAt: string
  expiresAt: string
  respondedAt?: string
}

export interface GameInviteState {
  userId: string
  invites: GameInvite[]
  sentInvites: string[] // Track invites sent by this user to avoid duplicates
  lastUpdated: string
}

// Game invite projector - reconstructs current state from events
export class GameInviteProjector {
  static projectState(events: GameInviteEvent[]): GameInviteState {
    const state: GameInviteState = {
      userId: events.length > 0 ? events[0].aggregateId : '',
      invites: [],
      sentInvites: [],
      lastUpdated: new Date().toISOString()
    }

    const inviteMap = new Map<string, GameInvite>()

    for (const event of events) {
      const { eventType, data, timestamp } = event

      switch (eventType) {
        case 'game_invite_sent': {
          const eventData = data as GameInviteSentEventData
          const invite: GameInvite = {
            id: eventData.inviteId,
            gameId: eventData.gameId,
            fromUserId: eventData.fromUserId,
            fromUserName: eventData.fromUserName,
            fromUserAvatar: eventData.fromUserAvatar,
            gameCode: eventData.gameCode,
            message: eventData.message,
            status: 'pending',
            sentAt: timestamp,
            expiresAt: eventData.expiresAt
          }
          inviteMap.set(eventData.inviteId, invite)
          break
        }

        case 'game_invite_accepted': {
          const eventData = data as GameInviteAcceptedEventData
          const invite = inviteMap.get(eventData.inviteId)
          if (invite) {
            invite.status = 'accepted'
            invite.respondedAt = eventData.joinedAt
          }
          break
        }

        case 'game_invite_declined': {
          const eventData = data as GameInviteDeclinedEventData
          const invite = inviteMap.get(eventData.inviteId)
          if (invite) {
            invite.status = 'declined'
            invite.respondedAt = eventData.declinedAt
          }
          break
        }

        case 'game_invite_expired': {
          const eventData = data as GameInviteExpiredEventData
          const invite = inviteMap.get(eventData.inviteId)
          if (invite) {
            invite.status = 'expired'
            invite.respondedAt = eventData.expiredAt
          }
          break
        }

        case 'game_invite_cancelled': {
          const eventData = data as GameInviteCancelledEventData
          const invite = inviteMap.get(eventData.inviteId)
          if (invite) {
            invite.status = 'cancelled'
            invite.respondedAt = eventData.cancelledAt
          }
          break
        }
      }

      state.lastUpdated = timestamp
    }

    // Only include active invites (pending ones, plus recent responded ones)
    const now = new Date()
    const cutoffTime = new Date(now.getTime() - 24 * 60 * 60 * 1000) // 24 hours ago

    state.invites = Array.from(inviteMap.values()).filter(invite => {
      // Always include pending invites
      if (invite.status === 'pending') {
        // Check if not expired
        return new Date(invite.expiresAt) > now
      }
      
      // Include responded invites if they're recent
      if (invite.respondedAt) {
        return new Date(invite.respondedAt) > cutoffTime
      }
      
      return false
    })

    return state
  }
} 