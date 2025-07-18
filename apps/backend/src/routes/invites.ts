import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { GameInvitesService } from '../services/game-invites-service'
import { optionalAuthMiddleware } from '../middleware/auth'

const invitesRouter = new Hono()
invitesRouter.use('*', optionalAuthMiddleware)

// GET /api/invites - Get user's game invites
invitesRouter.get('/', async (c) => {
  const user = c.get('user')
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401)
  }
  
  try {
    const invites = await GameInvitesService.getGameInvites(user.id)
    return c.json({ invites })
  } catch (error) {
    console.error('Error getting game invites:', error)
    return c.json({ error: 'Failed to get game invites' }, 500)
  }
})

// POST /api/invites - Send game invite to friend
invitesRouter.post('/',
  zValidator('json', z.object({
    gameId: z.string(),
    friendIds: z.array(z.string().uuid()),
    message: z.string().max(200).optional()
  })),
  async (c) => {
    const user = c.get('user')
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401)
    }
    
    try {
      const { gameId, friendIds, message } = c.req.valid('json')
      const invites = await GameInvitesService.sendGameInvites(
        user.id, 
        gameId, 
        friendIds, 
        message
      )
      return c.json({ invites })
    } catch (error) {
      console.error('Error sending game invites:', error)
      return c.json({ error: 'Failed to send game invites' }, 500)
    }
  }
)

// POST /api/invites/:inviteId/accept - Accept game invite
invitesRouter.post('/:inviteId/accept', async (c) => {
  const user = c.get('user')
  const inviteId = c.req.param('inviteId')
  
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401)
  }
  
  try {
    const result = await GameInvitesService.acceptGameInvite(inviteId, user.id)
    return c.json(result)
  } catch (error) {
    console.error('Error accepting game invite:', error)
    return c.json({ error: 'Failed to accept game invite' }, 500)
  }
})

// POST /api/invites/:inviteId/decline - Decline game invite
invitesRouter.post('/:inviteId/decline', async (c) => {
  const user = c.get('user')
  const inviteId = c.req.param('inviteId')
  
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401)
  }
  
  try {
    await GameInvitesService.declineGameInvite(inviteId, user.id)
    return c.json({ success: true })
  } catch (error) {
    console.error('Error declining game invite:', error)
    return c.json({ error: 'Failed to decline game invite' }, 500)
  }
})

export { invitesRouter } 