import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { FriendsService } from '../services/friends-service'
import { optionalAuthMiddleware } from '../middleware/auth'

const friendsRouter = new Hono()

// Apply optional auth - friends features require authentication
friendsRouter.use('*', optionalAuthMiddleware)

// GET /api/friends - Get user's friends list
friendsRouter.get('/', async (c) => {
  const user = c.get('user')
  if (!user) {
    return c.json({ error: 'Authentication required for friends' }, 401)
  }
  
  try {
    const friends = await FriendsService.getFriends(user.id)
    return c.json({ friends })
  } catch (error) {
    console.error('Error getting friends:', error)
    return c.json({ error: 'Failed to get friends' }, 500)
  }
})

// GET /api/friends/requests - Get pending friend requests
friendsRouter.get('/requests', async (c) => {
  const user = c.get('user')
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401)
  }
  
  try {
    const requests = await FriendsService.getFriendRequests(user.id)
    return c.json({ requests })
  } catch (error) {
    console.error('Error getting friend requests:', error)
    return c.json({ error: 'Failed to get friend requests' }, 500)
  }
})

// POST /api/friends/search - Search for users by email/name
friendsRouter.post('/search', 
  zValidator('json', z.object({
    query: z.string().min(1).max(100),
    limit: z.number().min(1).max(20).default(10)
  })),
  async (c) => {
    const user = c.get('user')
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401)
    }
    
    try {
      const { query, limit } = c.req.valid('json')
      const results = await FriendsService.searchUsers(user.id, query, limit)
      return c.json({ users: results })
    } catch (error) {
      console.error('Error searching users:', error)
      return c.json({ error: 'Failed to search users' }, 500)
    }
  }
)

// POST /api/friends/request - Send friend request
friendsRouter.post('/request',
  zValidator('json', z.object({
    toUserId: z.string().uuid(),
    message: z.string().max(200).optional()
  })),
  async (c) => {
    const user = c.get('user')
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401)
    }
    
    try {
      const { toUserId, message } = c.req.valid('json')
      const request = await FriendsService.sendFriendRequest(user.id, toUserId, message)
      return c.json({ request })
    } catch (error) {
      console.error('Error sending friend request:', error)
      return c.json({ error: 'Failed to send friend request' }, 500)
    }
  }
)

// POST /api/friends/request/:requestId/accept - Accept friend request
friendsRouter.post('/request/:requestId/accept', async (c) => {
  const user = c.get('user')
  const requestId = c.req.param('requestId')
  
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401)
  }
  
  try {
    const friendship = await FriendsService.acceptFriendRequest(requestId, user.id)
    return c.json({ friendship })
  } catch (error) {
    console.error('Error accepting friend request:', error)
    return c.json({ error: 'Failed to accept friend request' }, 500)
  }
})

// POST /api/friends/request/:requestId/reject - Reject friend request
friendsRouter.post('/request/:requestId/reject', async (c) => {
  const user = c.get('user')
  const requestId = c.req.param('requestId')
  
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401)
  }
  
  try {
    await FriendsService.rejectFriendRequest(requestId, user.id)
    return c.json({ success: true })
  } catch (error) {
    console.error('Error rejecting friend request:', error)
    return c.json({ error: 'Failed to reject friend request' }, 500)
  }
})

// DELETE /api/friends/:friendshipId - Remove friend
friendsRouter.delete('/:friendshipId', async (c) => {
  const user = c.get('user')
  const friendshipId = c.req.param('friendshipId')
  
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401)
  }
  
  try {
    await FriendsService.removeFriend(friendshipId, user.id)
    return c.json({ success: true })
  } catch (error) {
    console.error('Error removing friend:', error)
    return c.json({ error: 'Failed to remove friend' }, 500)
  }
})

export { friendsRouter } 