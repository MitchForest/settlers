import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { friendsCommandService } from '../services/friends-command-service'
import { optionalAuthMiddleware } from '../middleware/auth'

const app = new Hono()

// Apply optional auth middleware to all friend routes
app.use('*', optionalAuthMiddleware)

// **QUERY ENDPOINTS - Project current state from events**

// GET /api/friends - Get current user's friends list
app.get('/', async (c) => {
  const user = c.get('user')
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401)
  }
  
  try {
    const result = await friendsCommandService.getFriendsState(user.id)

    if (result.success && result.state) {
      // Return just the friends array for frontend compatibility
      const friends = Array.from(result.state.friends.values())
      return c.json({ success: true, friends })
    } else {
      return c.json({ success: false, error: result.error || 'Failed to get friends' }, 400)
    }
  } catch (error) {
    console.error('Error getting friends:', error)
    return c.json({ error: 'Failed to get friends' }, 500)
  }
})

// GET /api/friends/requests - Get current user's friend requests
app.get('/requests', async (c) => {
  const user = c.get('user')
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401)
  }
  
  try {
    const result = await friendsCommandService.getFriendsState(user.id)

    if (result.success && result.state) {
      // Return both incoming and outgoing requests
      const incomingRequests = Array.from(result.state.incomingRequests.values())
      const outgoingRequests = Array.from(result.state.outgoingRequests.values())
      
      return c.json({ 
        success: true, 
        incomingRequests,
        outgoingRequests,
        // For backwards compatibility, also include a combined array
        requests: [...incomingRequests, ...outgoingRequests]
      })
    } else {
      return c.json({ success: false, error: result.error || 'Failed to get requests' }, 400)
    }
  } catch (error) {
    console.error('Error getting friend requests:', error)
    return c.json({ error: 'Failed to get friend requests' }, 500)
  }
})

// GET /api/friends/search - Search users (updated to GET method)
app.get('/search', 
  zValidator('query', z.object({
    query: z.string(),
    limit: z.string().optional()
  })),
  async (c) => {
    const user = c.get('user')
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401)
    }
    
    try {
      const { query, limit } = c.req.valid('query')
      
      const results = await friendsCommandService.searchUsers(
        user.id, 
        query, 
        limit ? parseInt(limit) : 20
      )

      return c.json({ success: true, users: results })
    } catch (error) {
      console.error('Error searching users:', error)
      return c.json({ success: false, error: 'Internal server error' }, 500)
    }
  }
)

// **COMMAND ENDPOINTS**

// POST /api/friends/send-request - Send friend request
app.post('/send-request', 
  zValidator('json', z.object({
    toUserId: z.string(),
    message: z.string().optional()
  })),
  async (c) => {
    const user = c.get('user')
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401)
    }
    
    try {
      const { toUserId, message } = c.req.valid('json')
      
      const result = await friendsCommandService.sendFriendRequest({
        fromUserId: user.id,
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

// POST /api/friends/accept-request - Accept friend request
app.post('/accept-request',
  zValidator('json', z.object({
    requestId: z.string()
  })),
  async (c) => {
    const user = c.get('user')
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401)
    }
    
    try {
      const { requestId } = c.req.valid('json')
      
      const result = await friendsCommandService.acceptFriendRequest({
        requestId,
        acceptingUserId: user.id
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

// POST /api/friends/reject-request - Reject friend request
app.post('/reject-request',
  zValidator('json', z.object({
    requestId: z.string()
  })),
  async (c) => {
    const user = c.get('user')
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401)
    }
    
    try {
      const { requestId } = c.req.valid('json')
      
      const result = await friendsCommandService.rejectFriendRequest({
        requestId,
        rejectingUserId: user.id
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

// POST /api/friends/remove - Remove friend
app.post('/remove',
  zValidator('json', z.object({
    friendshipId: z.string()
  })),
  async (c) => {
    const user = c.get('user')
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401)
    }
    
    try {
      const { friendshipId } = c.req.valid('json')
      
      const result = await friendsCommandService.removeFriend({
        friendshipId,
        removingUserId: user.id
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



export { app as friendsRouter } 