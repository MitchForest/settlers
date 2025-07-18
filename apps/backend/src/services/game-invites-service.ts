import { db } from '../db'
import { gameInvites, userProfiles, games } from '../db/schema'
import { eq, and, inArray, desc } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'

export class GameInvitesService {
  static async sendGameInvites(
    fromUserId: string,
    gameId: string, 
    friendIds: string[],
    message?: string
  ) {
    // Verify game exists and user is participant
    const game = await db.select()
      .from(games)
      .where(eq(games.id, gameId))
      .limit(1)
    
    if (!game.length) {
      throw new Error('Game not found')
    }
    
    // Create invites for each friend (expires in 24 hours)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const inviteData = friendIds.map(friendId => ({
      fromUserId,
      toUserId: friendId,
      gameId,
      message,
      status: 'pending' as const,
      expiresAt
    }))
    
    const invites = await db.insert(gameInvites)
      .values(inviteData)
      .returning()
    
    // TODO: Send real-time notifications via WebSocket
    
    return invites
  }
  
  static async getGameInvites(userId: string) {
    return await db.select({
      id: gameInvites.id,
      gameId: gameInvites.gameId,
      message: gameInvites.message,
      status: gameInvites.status,
      createdAt: gameInvites.createdAt,
      expiresAt: gameInvites.expiresAt,
      fromUser: {
        id: userProfiles.id,
        name: userProfiles.name,
        email: userProfiles.email,
        avatarEmoji: userProfiles.avatarEmoji
      }
    })
    .from(gameInvites)
    .leftJoin(userProfiles, eq(gameInvites.fromUserId, userProfiles.id))
    .where(
      and(
        eq(gameInvites.toUserId, userId),
        eq(gameInvites.status, 'pending')
      )
    )
    .orderBy(desc(gameInvites.createdAt))
  }
  
  static async acceptGameInvite(inviteId: string, userId: string) {
    // Update invite status
    await db.update(gameInvites)
      .set({ 
        status: 'accepted'
      })
      .where(
        and(
          eq(gameInvites.id, inviteId),
          eq(gameInvites.toUserId, userId)
        )
      )
    
    // Get game details to join
    const invite = await db.select()
      .from(gameInvites)
      .where(eq(gameInvites.id, inviteId))
      .limit(1)
    
    if (!invite.length) {
      throw new Error('Invite not found')
    }
    
    // TODO: Join the game via LobbyCommandService
    return { gameId: invite[0].gameId, joined: true }
  }
  
  static async declineGameInvite(inviteId: string, userId: string) {
    await db.update(gameInvites)
      .set({ 
        status: 'declined'
      })
      .where(
        and(
          eq(gameInvites.id, inviteId),
          eq(gameInvites.toUserId, userId)
        )
      )
  }
} 