import { db } from '../db'
import { userPresence, friendships, userProfiles } from '../db/schema'
import { eq, and, or, desc, sql } from 'drizzle-orm'
import { friendsWebSocketManager } from '../websocket/friends-websocket'

export class PresenceService {
  static async updatePresence(
    userId: string,
    status: 'online' | 'away' | 'busy' | 'offline',
    gameId?: string,
    lastSeen?: string
  ) {
    const now = new Date().toISOString()
    
    // Upsert presence record
    const presence = await db.insert(userPresence)
      .values({
        userId,
        status,
        currentGameId: gameId,
        lastSeenAt: lastSeen || now,
        updatedAt: now
      })
      .onConflictDoUpdate({
        target: userPresence.userId,
        set: {
          status,
          currentGameId: gameId,
          lastSeenAt: lastSeen || now,
          updatedAt: now
        }
      })
      .returning()
    
    // Broadcast presence update via WebSocket to friends
    friendsWebSocketManager.broadcastPresenceUpdate(userId, status, gameId).catch(error => {
      console.error('Failed to broadcast presence update:', error)
    })
    
    return presence[0]
  }
  
  static async getFriendsPresence(userId: string) {
    // Get all friends and their presence status
    return await db.select({
      friendId: userProfiles.id,
      name: userProfiles.name,
      avatarEmoji: userProfiles.avatarEmoji,
      presence: {
        status: userPresence.status,
        gameId: userPresence.currentGameId,
        lastSeen: userPresence.lastSeenAt
      }
    })
    .from(friendships)
    .innerJoin(
      userProfiles,
      or(
        eq(friendships.user1Id, userProfiles.id),
        eq(friendships.user2Id, userProfiles.id)
      )
    )
    .leftJoin(userPresence, eq(userProfiles.id, userPresence.userId))
    .where(
      and(
        or(
          eq(friendships.user1Id, userId),
          eq(friendships.user2Id, userId)
        ),
        sql`${userProfiles.id} != ${userId}` // Exclude self
      )
    )
  }
} 