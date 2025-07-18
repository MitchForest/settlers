import { db } from '../db'
import { friendRequests, friendships, userProfiles, userPresence } from '../db/schema'
import { eq, and, or, sql, desc, asc, ilike, inArray } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'

export interface FriendRequest {
  id: string
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
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled'
  message: string | null
  createdAt: string
  updatedAt: string
  respondedAt: string | null
}

export interface Friendship {
  id: string
  friendUser: {
    id: string
    name: string
    email: string
    avatarEmoji: string | null
    presence?: {
      status: 'online' | 'away' | 'busy' | 'offline'
      lastSeenAt: string
      currentGameId: string | null
    }
  }
  createdAt: string
  lastInteractionAt: string
}

export interface UserSearchResult {
  id: string
  name: string
  email: string
  avatarEmoji: string | null
  friendshipStatus: 'none' | 'pending_sent' | 'pending_received' | 'friends'
}

export class FriendsService {
  
  /**
   * Search for users by name or email
   */
  async searchUsers(currentUserId: string, query: string, limit: number = 20): Promise<UserSearchResult[]> {
    const searchQuery = `%${query.toLowerCase()}%`
    
    // Get users matching search query
    const users = await db
      .select({
        id: userProfiles.id,
        name: userProfiles.name,
        email: userProfiles.email,
        avatarEmoji: userProfiles.avatarEmoji,
      })
      .from(userProfiles)
      .where(
        and(
          or(
            ilike(userProfiles.name, searchQuery),
            ilike(userProfiles.email, searchQuery)
          ),
          // Exclude current user
          sql`${userProfiles.id} != ${currentUserId}`
        )
      )
      .limit(limit)
      .orderBy(asc(userProfiles.name))

    if (users.length === 0) {
      return []
    }

    const userIds = users.map(u => u.id)

    // Get existing relationships for these users
    const [sentRequests, receivedRequests, existingFriendships] = await Promise.all([
      // Friend requests sent by current user
      db.select({ toUserId: friendRequests.toUserId })
        .from(friendRequests)
        .where(
          and(
            eq(friendRequests.fromUserId, currentUserId),
            inArray(friendRequests.toUserId, userIds),
            eq(friendRequests.status, 'pending')
          )
        ),
      
      // Friend requests received by current user
      db.select({ fromUserId: friendRequests.fromUserId })
        .from(friendRequests)
        .where(
          and(
            eq(friendRequests.toUserId, currentUserId),
            inArray(friendRequests.fromUserId, userIds),
            eq(friendRequests.status, 'pending')
          )
        ),
      
      // Existing friendships
      db.select({ 
        user1Id: friendships.user1Id, 
        user2Id: friendships.user2Id 
      })
        .from(friendships)
        .where(
          or(
            and(
              eq(friendships.user1Id, currentUserId),
              inArray(friendships.user2Id, userIds)
            ),
            and(
              eq(friendships.user2Id, currentUserId),
              inArray(friendships.user1Id, userIds)
            )
          )
        )
    ])

    // Create lookup sets for efficient checking
    const sentRequestIds = new Set(sentRequests.map(r => r.toUserId))
    const receivedRequestIds = new Set(receivedRequests.map(r => r.fromUserId))
    const friendIds = new Set(
      existingFriendships.flatMap(f => 
        f.user1Id === currentUserId ? [f.user2Id] : [f.user1Id]
      )
    )

    // Map users with relationship status
    return users.map(user => {
      let friendshipStatus: UserSearchResult['friendshipStatus'] = 'none'
      
      if (friendIds.has(user.id)) {
        friendshipStatus = 'friends'
      } else if (sentRequestIds.has(user.id)) {
        friendshipStatus = 'pending_sent'
      } else if (receivedRequestIds.has(user.id)) {
        friendshipStatus = 'pending_received'
      }

      return {
        ...user,
        friendshipStatus
      }
    })
  }

  /**
   * Send a friend request
   */
  async sendFriendRequest(
    fromUserId: string, 
    toUserId: string, 
    message?: string
  ): Promise<{ success: boolean; requestId?: string; error?: string }> {
    try {
      // Validate users exist
      const [fromUser, toUser] = await Promise.all([
        db.select().from(userProfiles).where(eq(userProfiles.id, fromUserId)).limit(1),
        db.select().from(userProfiles).where(eq(userProfiles.id, toUserId)).limit(1)
      ])

      if (!fromUser.length || !toUser.length) {
        return { success: false, error: 'User not found' }
      }

      if (fromUserId === toUserId) {
        return { success: false, error: 'Cannot send friend request to yourself' }
      }

      // Check for existing request or friendship
      const [existingRequest, existingFriendship] = await Promise.all([
        db.select()
          .from(friendRequests)
          .where(
            or(
              and(
                eq(friendRequests.fromUserId, fromUserId),
                eq(friendRequests.toUserId, toUserId)
              ),
              and(
                eq(friendRequests.fromUserId, toUserId),
                eq(friendRequests.toUserId, fromUserId)
              )
            )
          )
          .limit(1),
        
        this.getFriendship(fromUserId, toUserId)
      ])

      if (existingFriendship) {
        return { success: false, error: 'Already friends' }
      }

      if (existingRequest.length > 0) {
        const request = existingRequest[0]
        if (request.status === 'pending') {
          return { success: false, error: 'Friend request already exists' }
        }
      }

      // Create friend request
      const requestId = uuidv4()
      await db.insert(friendRequests).values({
        id: requestId,
        fromUserId,
        toUserId,
        message: message || null,
        status: 'pending'
      })

      return { success: true, requestId }

    } catch (error) {
      console.error('Error sending friend request:', error)
      return { success: false, error: 'Failed to send friend request' }
    }
  }

  /**
   * Respond to a friend request (accept/reject)
   */
  async respondToFriendRequest(
    requestId: string,
    userId: string,
    response: 'accepted' | 'rejected'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      return await db.transaction(async (tx) => {
        // Get the friend request
        const request = await tx
          .select()
          .from(friendRequests)
          .where(
            and(
              eq(friendRequests.id, requestId),
              eq(friendRequests.toUserId, userId),
              eq(friendRequests.status, 'pending')
            )
          )
          .limit(1)

        if (!request.length) {
          return { success: false, error: 'Friend request not found' }
        }

        const friendRequest = request[0]

        // Update request status
        await tx
          .update(friendRequests)
          .set({
            status: response,
            respondedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          })
          .where(eq(friendRequests.id, requestId))

        // If accepted, create friendship
        if (response === 'accepted') {
          const user1Id = friendRequest.fromUserId < friendRequest.toUserId 
            ? friendRequest.fromUserId 
            : friendRequest.toUserId
          const user2Id = friendRequest.fromUserId < friendRequest.toUserId 
            ? friendRequest.toUserId 
            : friendRequest.fromUserId

          await tx.insert(friendships).values({
            id: uuidv4(),
            user1Id,
            user2Id,
            createdAt: new Date().toISOString(),
            lastInteractionAt: new Date().toISOString()
          })
        }

        return { success: true }
      })
    } catch (error) {
      console.error('Error responding to friend request:', error)
      return { success: false, error: 'Failed to respond to friend request' }
    }
  }

  /**
   * Get pending friend requests for a user
   */
  async getPendingRequests(userId: string): Promise<{
    sent: FriendRequest[]
    received: FriendRequest[]
  }> {
    const [sent, received] = await Promise.all([
      // Requests sent by user
      db
        .select({
          id: friendRequests.id,
          fromUserId: friendRequests.fromUserId,
          toUserId: friendRequests.toUserId,
          status: friendRequests.status,
          message: friendRequests.message,
          createdAt: friendRequests.createdAt,
          updatedAt: friendRequests.updatedAt,
          respondedAt: friendRequests.respondedAt,
          toUser: {
            id: userProfiles.id,
            name: userProfiles.name,
            email: userProfiles.email,
            avatarEmoji: userProfiles.avatarEmoji
          }
        })
        .from(friendRequests)
        .innerJoin(userProfiles, eq(friendRequests.toUserId, userProfiles.id))
        .where(
          and(
            eq(friendRequests.fromUserId, userId),
            eq(friendRequests.status, 'pending')
          )
        )
        .orderBy(desc(friendRequests.createdAt)),

      // Requests received by user
      db
        .select({
          id: friendRequests.id,
          fromUserId: friendRequests.fromUserId,
          toUserId: friendRequests.toUserId,
          status: friendRequests.status,
          message: friendRequests.message,
          createdAt: friendRequests.createdAt,
          updatedAt: friendRequests.updatedAt,
          respondedAt: friendRequests.respondedAt,
          fromUser: {
            id: userProfiles.id,
            name: userProfiles.name,
            email: userProfiles.email,
            avatarEmoji: userProfiles.avatarEmoji
          }
        })
        .from(friendRequests)
        .innerJoin(userProfiles, eq(friendRequests.fromUserId, userProfiles.id))
        .where(
          and(
            eq(friendRequests.toUserId, userId),
            eq(friendRequests.status, 'pending')
          )
        )
        .orderBy(desc(friendRequests.createdAt))
    ])

    return {
      sent: sent.map(r => ({
        ...r,
        fromUser: {
          id: userId,
          name: '',
          email: '',
          avatarEmoji: null
        }, // Will be filled by caller if needed
        toUser: r.toUser
      })),
      received: received.map(r => ({
        ...r,
        fromUser: r.fromUser,
        toUser: {
          id: userId,
          name: '',
          email: '',
          avatarEmoji: null
        } // Will be filled by caller if needed
      }))
    }
  }

  /**
   * Get user's friends list with presence
   */
  async getFriendsList(userId: string): Promise<Friendship[]> {
    const friends = await db
      .select({
        friendshipId: friendships.id,
        friendshipCreatedAt: friendships.createdAt,
        friendshipLastInteraction: friendships.lastInteractionAt,
        user1Id: friendships.user1Id,
        user2Id: friendships.user2Id,
        friend: {
          id: userProfiles.id,
          name: userProfiles.name,
          email: userProfiles.email,
          avatarEmoji: userProfiles.avatarEmoji
        },
        presence: {
          status: userPresence.status,
          lastSeenAt: userPresence.lastSeenAt,
          currentGameId: userPresence.currentGameId
        }
      })
      .from(friendships)
      .innerJoin(
        userProfiles,
        or(
          and(eq(friendships.user1Id, userId), eq(userProfiles.id, friendships.user2Id)),
          and(eq(friendships.user2Id, userId), eq(userProfiles.id, friendships.user1Id))
        )
      )
      .leftJoin(userPresence, eq(userPresence.userId, userProfiles.id))
      .where(
        or(
          eq(friendships.user1Id, userId),
          eq(friendships.user2Id, userId)
        )
      )
      .orderBy(desc(friendships.lastInteractionAt))

    return friends.map(f => ({
      id: f.friendshipId,
      friendUser: {
        ...f.friend,
        presence: f.presence || undefined
      },
      createdAt: f.friendshipCreatedAt,
      lastInteractionAt: f.friendshipLastInteraction
    }))
  }

  /**
   * Remove a friendship (unfriend)
   */
  async removeFriend(userId: string, friendId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await db
        .delete(friendships)
        .where(
          or(
            and(
              eq(friendships.user1Id, userId < friendId ? userId : friendId),
              eq(friendships.user2Id, userId < friendId ? friendId : userId)
            )
          )
        )

      return { success: true }
    } catch (error) {
      console.error('Error removing friend:', error)
      return { success: false, error: 'Failed to remove friend' }
    }
  }

  /**
   * Get friendship between two users
   */
  private async getFriendship(user1Id: string, user2Id: string) {
    const orderedUser1 = user1Id < user2Id ? user1Id : user2Id
    const orderedUser2 = user1Id < user2Id ? user2Id : user1Id

    const friendship = await db
      .select()
      .from(friendships)
      .where(
        and(
          eq(friendships.user1Id, orderedUser1),
          eq(friendships.user2Id, orderedUser2)
        )
      )
      .limit(1)

    return friendship.length > 0 ? friendship[0] : null
  }

  /**
   * Update friendship interaction time
   */
  async updateLastInteraction(user1Id: string, user2Id: string): Promise<void> {
    const orderedUser1 = user1Id < user2Id ? user1Id : user2Id
    const orderedUser2 = user1Id < user2Id ? user2Id : user1Id

    await db
      .update(friendships)
      .set({ lastInteractionAt: new Date().toISOString() })
      .where(
        and(
          eq(friendships.user1Id, orderedUser1),
          eq(friendships.user2Id, orderedUser2)
        )
      )
  }
}

export const friendsService = new FriendsService() 