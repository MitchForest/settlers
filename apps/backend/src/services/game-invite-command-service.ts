import { eq, and, gte, lte, inArray } from 'drizzle-orm'
import { db } from '../db/index'
import { userProfiles, games } from '../db/schema'
import { eventStore } from '../db/event-store-repository'
import { GameInviteEvent, GameInviteEventType } from '@settlers/core/src/events/game-invite-event-store'
import { server as unifiedWebSocketServer } from '../websocket/unified-server'

export interface SendGameInviteCommand {
  fromUserId: string
  toUserId: string
  gameId: string
  message?: string
}

export interface AcceptGameInviteCommand {
  inviteId: string
  acceptingUserId: string
}

export interface DeclineGameInviteCommand {
  inviteId: string
  decliningUserId: string
}

export interface CancelGameInviteCommand {
  inviteId: string
  cancellingUserId: string
}

interface CommandResult {
  success: boolean
  events: GameInviteEvent[]
  error?: string
  data?: any
}

export class GameInviteCommandService {
  
  async sendGameInvite(command: SendGameInviteCommand): Promise<CommandResult> {
    try {
      // Validate users exist
      const [fromUser, toUser] = await Promise.all([
        this.getUserBasicInfo(command.fromUserId),
        this.getUserBasicInfo(command.toUserId)
      ])

      if (!fromUser || !toUser) {
        return {
          success: false,
          events: [],
          error: 'User not found'
        }
      }

      // Validate game exists
      const [game] = await db
        .select()
        .from(games)
        .where(eq(games.id, command.gameId))

      if (!game) {
        return {
          success: false,
          events: [],
          error: 'Game not found'
        }
      }

      // Create and store the event
      const inviteId = `ginv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const eventData = {
        inviteId,
        fromUserId: command.fromUserId,
        toUserId: command.toUserId,
        gameId: command.gameId,
        fromUser,
        toUser,
        gameInfo: {
          id: game.id,
          gameCode: game.gameCode,
          currentPhase: game.currentPhase
        },
        message: command.message,
        timestamp: new Date().toISOString()
      }

      const event = await eventStore.appendGameInviteEvent({
        aggregateId: command.fromUserId,
        eventType: 'game_invite_sent',
        data: eventData
      })

      // Send real-time notification via unified WebSocket server
      try {
        unifiedWebSocketServer.sendSocialNotification(command.toUserId, {
          type: 'game_invite_received',
          data: {
            inviteId,
            fromUserId: command.fromUserId,
            fromUser,
            gameId: command.gameId,
            gameInfo: eventData.gameInfo,
            message: command.message
          },
          timestamp: new Date().toISOString()
        })
      } catch (wsError) {
        console.error('Failed to send game invite WebSocket notification:', wsError)
        // Don't fail the command if WebSocket fails
      }

      return {
        success: true,
        events: [event],
        data: { inviteId, invite: eventData }
      }

    } catch (error) {
      console.error('Error sending game invite:', error)
      return {
        success: false,
        events: [],
        error: 'Failed to send game invite'
      }
    }
  }

  async acceptGameInvite(command: AcceptGameInviteCommand): Promise<CommandResult> {
    try {
      // Get invite from events
      const events = await eventStore.getGameInviteEvents(command.acceptingUserId)
      const invite = this.findInviteFromEvents(events, command.inviteId)

      if (!invite) {
        return {
          success: false,
          events: [],
          error: 'Game invite not found'
        }
      }

      const eventData = {
        inviteId: command.inviteId,
        acceptingUserId: command.acceptingUserId,
        gameId: invite.gameId,
        timestamp: new Date().toISOString()
      }

      // Store acceptance event
      const event = await eventStore.appendGameInviteEvent({
        aggregateId: command.acceptingUserId,
        eventType: 'game_invite_accepted',
        data: eventData
      })

      // Send notification to inviter
      try {
        unifiedWebSocketServer.sendSocialNotification(invite.fromUserId, {
          type: 'game_invite_responded',
          data: {
            inviteId: command.inviteId,
            response: 'accepted',
            respondingUserId: command.acceptingUserId
          },
          timestamp: new Date().toISOString()
        })
      } catch (wsError) {
        console.error('Failed to send game invite accepted notification:', wsError)
      }

      return {
        success: true,
        events: [event],
        data: { acceptance: eventData, gameId: invite.gameId }
      }

    } catch (error) {
      console.error('Error accepting game invite:', error)
      return {
        success: false,
        events: [],
        error: 'Failed to accept game invite'
      }
    }
  }

  async declineGameInvite(command: DeclineGameInviteCommand): Promise<CommandResult> {
    try {
      // Get invite from events
      const events = await eventStore.getGameInviteEvents(command.decliningUserId)
      const invite = this.findInviteFromEvents(events, command.inviteId)

      if (!invite) {
        return {
          success: false,
          events: [],
          error: 'Game invite not found'
        }
      }

      const eventData = {
        inviteId: command.inviteId,
        decliningUserId: command.decliningUserId,
        gameId: invite.gameId,
        timestamp: new Date().toISOString()
      }

      // Store decline event
      const event = await eventStore.appendGameInviteEvent({
        aggregateId: command.decliningUserId,
        eventType: 'game_invite_declined',
        data: eventData
      })

      // Send notification to inviter
      try {
        unifiedWebSocketServer.sendSocialNotification(invite.fromUserId, {
          type: 'game_invite_responded',
          data: {
            inviteId: command.inviteId,
            response: 'declined',
            respondingUserId: command.decliningUserId
          },
          timestamp: new Date().toISOString()
        })
      } catch (wsError) {
        console.error('Failed to send game invite declined notification:', wsError)
      }

      return {
        success: true,
        events: [event],
        data: { decline: eventData }
      }

    } catch (error) {
      console.error('Error declining game invite:', error)
      return {
        success: false,
        events: [],
        error: 'Failed to decline game invite'
      }
    }
  }

  async cancelGameInvite(command: CancelGameInviteCommand): Promise<CommandResult> {
    try {
      // Get invite from events
      const events = await eventStore.getGameInviteEvents(command.cancellingUserId)
      const invite = this.findInviteFromEvents(events, command.inviteId)

      if (!invite) {
        return {
          success: false,
          events: [],
          error: 'Game invite not found'
        }
      }

      const eventData = {
        inviteId: command.inviteId,
        cancellingUserId: command.cancellingUserId,
        gameId: invite.gameId,
        timestamp: new Date().toISOString()
      }

      // Store cancellation event
      const event = await eventStore.appendGameInviteEvent({
        aggregateId: command.cancellingUserId,
        eventType: 'game_invite_cancelled',
        data: eventData
      })

      // Send notification to invitee
      try {
        unifiedWebSocketServer.sendSocialNotification(invite.toUserId, {
          type: 'game_invite_cancelled',
          data: {
            inviteId: command.inviteId,
            cancellingUserId: command.cancellingUserId
          },
          timestamp: new Date().toISOString()
        })
      } catch (wsError) {
        console.error('Failed to send game invite cancelled notification:', wsError)
      }

      return {
        success: true,
        events: [event],
        data: { cancellation: eventData }
      }

    } catch (error) {
      console.error('Error cancelling game invite:', error)
      return {
        success: false,
        events: [],
        error: 'Failed to cancel game invite'
      }
    }
  }

  private findInviteFromEvents(events: GameInviteEvent[], inviteId: string): any {
    // Project events to find the invite
    for (const event of events) {
      if (event.eventType === 'game_invite_sent' && event.data.inviteId === inviteId) {
        return event.data
      }
    }
    return null
  }

  private async getUserBasicInfo(userId: string): Promise<any> {
    try {
      const [user] = await db
        .select({
          id: userProfiles.id,
          name: userProfiles.name,
          email: userProfiles.email,
          avatarEmoji: userProfiles.avatarEmoji,
        })
        .from(userProfiles)
        .where(eq(userProfiles.id, userId))
        .limit(1)

      return user || null
    } catch (error) {
      console.error('Error getting user basic info:', error)
      return null
    }
  }
}

export const gameInviteCommandService = new GameInviteCommandService() 