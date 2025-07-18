import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { optionalAuthMiddleware } from '../middleware/auth'
import { friendsCommandService } from '../services/friends-command-service'

const app = new Hono()

// Apply optional auth middleware
app.use('*', optionalAuthMiddleware)

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