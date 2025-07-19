import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { optionalAuthMiddleware } from '../middleware/auth'
import { friendsCommandService } from '../services/friends-command-service'

const app = new Hono()

// Apply optional auth middleware
app.use('*', optionalAuthMiddleware)

// GET /api/presence/friends - Get friends presence
app.get('/friends', async (c) => {
  const user = c.get('user')
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401)
  }
  
  try {
    const result = await friendsCommandService.getFriendsState(user.id)

    if (result.success && result.state) {
      // Extract presence info for all friends
      const friendsPresence = Array.from(result.state.friends.values()).map(friend => ({
        userId: friend.id,
        name: friend.name,
        avatarEmoji: friend.avatarEmoji,
        presence: friend.presence
      }))
      
      return c.json({ success: true, friends: friendsPresence })
    } else {
      return c.json({ success: false, error: result.error || 'Failed to get presence' }, 400)
    }
  } catch (error) {
    console.error('Error getting friends presence:', error)
    return c.json({ error: 'Failed to get friends presence' }, 500)
  }
})

// POST /api/presence/update - Update user presence
app.post('/update',
  zValidator('json', z.object({
    status: z.enum(['online', 'away', 'busy', 'offline']),
    gameId: z.string().optional()
  })),
  async (c) => {
    const user = c.get('user')
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401)
    }

    try {
      const { status, gameId } = c.req.valid('json')

      // Update presence using friends command service
      const result = await friendsCommandService.updatePresence({
        userId: user.id,
        status,
        gameId
      })

      if (result.success) {
        return c.json({ success: true, data: result.data })
      } else {
        return c.json({ success: false, error: result.error }, 400)
      }
    } catch (error) {
      console.error('Error updating presence:', error)
      return c.json({ error: 'Failed to update presence' }, 500)
    }
  }
)

export { app as presenceRouter } 