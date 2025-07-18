import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { friendsCommandService } from '../services/friends-command-service'

const app = new Hono()

// Send friend request
app.post('/send-request', 
  zValidator('json', z.object({
    fromUserId: z.string(),
    toUserId: z.string(),
    message: z.string().optional()
  })),
  async (c) => {
    try {
      const { fromUserId, toUserId, message } = c.req.valid('json')
      
      const result = await friendsCommandService.sendFriendRequest({
        fromUserId,
        toUserId,
        message
      })

      if (result.success) {
        return c.json({ success: true, data: result.data })
      } else {
        return c.json({ success: false, error: result.error }, 400)
      }
    } catch (error) {
      console.error('Error sending friend request:', error)
      return c.json({ success: false, error: 'Internal server error' }, 500)
    }
  }
)

// Accept friend request
app.post('/accept-request',
  zValidator('json', z.object({
    requestId: z.string(),
    acceptingUserId: z.string()
  })),
  async (c) => {
    try {
      const { requestId, acceptingUserId } = c.req.valid('json')
      
      const result = await friendsCommandService.acceptFriendRequest({
        requestId,
        acceptingUserId
      })

      if (result.success) {
        return c.json({ success: true, data: result.data })
      } else {
        return c.json({ success: false, error: result.error }, 400)
      }
    } catch (error) {
      console.error('Error accepting friend request:', error)
      return c.json({ success: false, error: 'Internal server error' }, 500)
    }
  }
)

// Reject friend request
app.post('/reject-request',
  zValidator('json', z.object({
    requestId: z.string(),
    rejectingUserId: z.string()
  })),
  async (c) => {
    try {
      const { requestId, rejectingUserId } = c.req.valid('json')
      
      const result = await friendsCommandService.rejectFriendRequest({
        requestId,
        rejectingUserId
      })

      if (result.success) {
        return c.json({ success: true, data: result.data })
      } else {
        return c.json({ success: false, error: result.error }, 400)
      }
    } catch (error) {
      console.error('Error rejecting friend request:', error)
      return c.json({ success: false, error: 'Internal server error' }, 500)
    }
  }
)

// Remove friend
app.post('/remove',
  zValidator('json', z.object({
    friendshipId: z.string(),
    removingUserId: z.string()
  })),
  async (c) => {
    try {
      const { friendshipId, removingUserId } = c.req.valid('json')
      
      const result = await friendsCommandService.removeFriend({
        friendshipId,
        removingUserId
      })

      if (result.success) {
        return c.json({ success: true, data: result.data })
      } else {
        return c.json({ success: false, error: result.error }, 400)
      }
    } catch (error) {
      console.error('Error removing friend:', error)
      return c.json({ success: false, error: 'Internal server error' }, 500)
    }
  }
)

// Get friends state
app.get('/state/:userId', async (c) => {
  try {
    const userId = c.req.param('userId')
    
    const result = await friendsCommandService.getFriendsState(userId)

    if (result.success) {
      // Convert Maps to objects for JSON serialization
      const serializedState = {
        ...result.state!,
        friends: Array.from(result.state!.friends.values()),
        incomingRequests: Array.from(result.state!.incomingRequests.values()),
        outgoingRequests: Array.from(result.state!.outgoingRequests.values()),
        presence: Array.from(result.state!.presence.entries()).map(([userId, presence]) => ({
          userId,
          ...presence
        }))
      }

      return c.json({ success: true, data: serializedState })
    } else {
      return c.json({ success: false, error: result.error }, 400)
    }
  } catch (error) {
    console.error('Error getting friends state:', error)
    return c.json({ success: false, error: 'Internal server error' }, 500)
  }
})

// Search users
app.get('/search', 
  zValidator('query', z.object({
    currentUserId: z.string(),
    query: z.string(),
    limit: z.string().optional()
  })),
  async (c) => {
    try {
      const { currentUserId, query, limit } = c.req.valid('query')
      
      const results = await friendsCommandService.searchUsers(
        currentUserId, 
        query, 
        limit ? parseInt(limit) : 20
      )

      return c.json({ success: true, data: results })
    } catch (error) {
      console.error('Error searching users:', error)
      return c.json({ success: false, error: 'Internal server error' }, 500)
    }
  }
)

export { app as friendsRouter } 