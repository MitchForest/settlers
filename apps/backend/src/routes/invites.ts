import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { gameInviteCommandService } from '../services/game-invite-command-service'
import { optionalAuthMiddleware } from '../middleware/auth'

const app = new Hono()

// Apply optional auth middleware
app.use('*', optionalAuthMiddleware)

// GET /api/invites - Get user's game invites
app.get('/', async (c) => {
  const user = c.get('user')
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401)
  }
  
  try {
    const result = await gameInviteCommandService.getGameInvites(user.id)
    
    if (result.success) {
      return c.json({ success: true, invites: result.invites })
    } else {
      return c.json({ success: false, error: result.error }, 400)
    }
  } catch (error) {
    console.error('Error getting game invites:', error)
    return c.json({ error: 'Failed to get game invites' }, 500)
  }
})

// POST /api/invites/send - Send game invite
app.post('/send',
  zValidator('json', z.object({
    toUserId: z.string(),
    gameId: z.string(),
    message: z.string().optional()
  })),
  async (c) => {
    const user = c.get('user')
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401)
    }
    
    try {
      const { toUserId, gameId, message } = c.req.valid('json')
      
      const result = await gameInviteCommandService.sendGameInvite({
        fromUserId: user.id,
        toUserId,
        gameId,
        message
      })

      if (result.success) {
        return c.json({ success: true, data: result.data })
      } else {
        return c.json({ success: false, error: result.error }, 400)
      }
    } catch (error) {
      console.error('Error sending game invite:', error)
      return c.json({ success: false, error: 'Internal server error' }, 500)
    }
  }
)

// POST /api/invites/:inviteId/accept - Accept game invite
app.post('/:inviteId/accept', async (c) => {
  const user = c.get('user')
  const inviteId = c.req.param('inviteId')
  
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401)
  }
  
  try {
    const result = await gameInviteCommandService.acceptGameInvite({
      inviteId,
      acceptingUserId: user.id
    })

    if (result.success) {
      return c.json({ success: true, data: result.data })
    } else {
      return c.json({ success: false, error: result.error }, 400)
    }
  } catch (error) {
    console.error('Error accepting game invite:', error)
    return c.json({ success: false, error: 'Internal server error' }, 500)
  }
})

// POST /api/invites/:inviteId/decline - Decline game invite
app.post('/:inviteId/decline', async (c) => {
  const user = c.get('user')
  const inviteId = c.req.param('inviteId')
  
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401)
  }
  
  try {
    const result = await gameInviteCommandService.declineGameInvite({
      inviteId,
      decliningUserId: user.id
    })

    if (result.success) {
      return c.json({ success: true, data: result.data })
    } else {
      return c.json({ success: false, error: result.error }, 400)
    }
  } catch (error) {
    console.error('Error declining game invite:', error)
    return c.json({ success: false, error: 'Internal server error' }, 500)
  }
})

export { app as invitesRouter } 