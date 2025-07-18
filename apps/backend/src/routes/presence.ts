import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { PresenceService } from '../services/presence-service'
import { optionalAuthMiddleware } from '../middleware/auth'

const presenceRouter = new Hono()
presenceRouter.use('*', optionalAuthMiddleware)

// POST /api/presence/update - Update user presence
presenceRouter.post('/update',
  zValidator('json', z.object({
    status: z.enum(['online', 'away', 'busy', 'offline']),
    gameId: z.string().optional(),
    lastSeen: z.string().datetime().optional()
  })),
  async (c) => {
    const user = c.get('user')
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401)
    }
    
    try {
      const { status, gameId, lastSeen } = c.req.valid('json')
      const presence = await PresenceService.updatePresence(
        user.id, 
        status, 
        gameId, 
        lastSeen
      )
      return c.json({ presence })
    } catch (error) {
      console.error('Error updating presence:', error)
      return c.json({ error: 'Failed to update presence' }, 500)
    }
  }
)

// GET /api/presence/friends - Get friends' presence status
presenceRouter.get('/friends', async (c) => {
  const user = c.get('user')
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401)
  }
  
  try {
    const friendsPresence = await PresenceService.getFriendsPresence(user.id)
    return c.json({ friendsPresence })
  } catch (error) {
    console.error('Error getting friends presence:', error)
    return c.json({ error: 'Failed to get friends presence' }, 500)
  }
})

export { presenceRouter } 