/**
 * UNIFIED GAMES ROUTES - ZERO TECHNICAL DEBT
 * 
 * Single API endpoint for ALL game operations.
 * Replaces scattered route handlers with unified, strongly-typed API.
 */

import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { unifiedCommandService, type UnifiedCommand } from '../services/unified-command-service'
import { unifiedGameManager } from '../core/unified-event-store'
import { getRouteForGameState } from '../core/unified-state-machine'
import { SupabaseJWTValidator } from '../../auth/jwt-validator'

const app = new Hono()

/**
 * AUTHENTICATION MIDDLEWARE
 */
app.use('*', async (c, next) => {
  const authHeader = c.req.header('Authorization')
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new HTTPException(401, { message: 'No authorization token provided' })
  }
  
  const token = authHeader.substring(7)
  const { valid, user, error } = await SupabaseJWTValidator.validateToken(token)
  
  if (!valid || !user) {
    throw new HTTPException(401, { message: `Authentication failed: ${error}` })
  }
  
  // Store user in context
  c.set('user', user)
  c.set('token', token)
  
  await next()
})

/**
 * CREATE GAME
 * POST /api/unified/games
 */
app.post('/', async (c) => {
  const user = c.get('user')
  const body = await c.req.json()
  
  const command: UnifiedCommand = {
    type: 'CREATE_GAME',
    gameCode: body.gameCode || `GAME${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
    hostUserId: user.id,
    settings: body.settings
  }
  
  const result = await unifiedCommandService.executeCommand(command, {
    userId: user.id,
    timestamp: new Date()
  })
  
  if (!result.success) {
    throw new HTTPException(400, { message: result.error || 'Failed to create game' })
  }
  
  // Get initial game state
  const gameState = await unifiedCommandService.getGameState(result.data.gameId)
  
  return c.json({
    success: true,
    data: {
      gameId: result.data.gameId,
      gameState,
      route: getRouteForGameState(result.data.gameId, gameState.state)
    }
  })
})

/**
 * GET GAME STATE
 * GET /api/unified/games/:gameId
 */
app.get('/:gameId', async (c) => {
  const gameId = c.req.param('gameId')
  const user = c.get('user')
  
  const gameState = await unifiedCommandService.getGameState(gameId)
  
  if (!gameState) {
    throw new HTTPException(404, { message: 'Game not found' })
  }
  
  // Check if user has access to this game
  const userInGame = gameState.players.some((p: any) => p.userId === user.id) ||
                     gameState.spectators.some((s: any) => s.userId === user.id)
  
  if (!userInGame && !gameState.settings.allowSpectators) {
    throw new HTTPException(403, { message: 'Access denied to this game' })
  }
  
  return c.json({
    success: true,
    data: {
      gameState,
      route: getRouteForGameState(gameId, gameState.state),
      permissions: {
        canJoin: await unifiedCommandService.canPlayerJoin(gameId),
        canStart: await unifiedCommandService.canGameStart(gameId),
        isHost: gameState.players.find((p: any) => p.userId === user.id)?.isHost || false
      }
    }
  })
})

/**
 * EXECUTE GAME COMMAND
 * POST /api/unified/games/:gameId/commands
 */
app.post('/:gameId/commands', async (c) => {
  const gameId = c.req.param('gameId')
  const user = c.get('user')
  const body = await c.req.json()
  
  // Validate command type
  if (!body.command || !body.command.type) {
    throw new HTTPException(400, { message: 'Command type is required' })
  }
  
  // Add gameId to command if not present
  const command: UnifiedCommand = {
    ...body.command,
    gameId
  }
  
  // Execute command
  const result = await unifiedCommandService.executeCommand(command, {
    userId: user.id,
    timestamp: new Date(),
    userAgent: c.req.header('User-Agent'),
    ipAddress: c.req.header('X-Forwarded-For') || c.req.header('X-Real-IP')
  })
  
  if (!result.success) {
    throw new HTTPException(400, { message: result.error || 'Command execution failed' })
  }
  
  // Get updated game state
  const gameState = await unifiedCommandService.getGameState(gameId)
  
  return c.json({
    success: true,
    data: {
      result: result.data,
      gameState,
      route: gameState ? getRouteForGameState(gameId, gameState.state) : null,
      events: result.events
    }
  })
})

/**
 * GET GAME STATUS
 * GET /api/unified/games/:gameId/status
 */
app.get('/:gameId/status', async (c) => {
  const gameId = c.req.param('gameId')
  
  const status = await unifiedCommandService.getGameStatus(gameId)
  
  if (!status) {
    throw new HTTPException(404, { message: 'Game not found' })
  }
  
  return c.json({
    success: true,
    data: {
      status,
      route: getRouteForGameState(gameId, status)
    }
  })
})

/**
 * GET GAME PLAYERS
 * GET /api/unified/games/:gameId/players
 */
app.get('/:gameId/players', async (c) => {
  const gameId = c.req.param('gameId')
  
  const players = await unifiedCommandService.getActivePlayers(gameId)
  
  return c.json({
    success: true,
    data: { players }
  })
})

/**
 * JOIN GAME
 * POST /api/unified/games/:gameId/join
 */
app.post('/:gameId/join', async (c) => {
  const gameId = c.req.param('gameId')
  const user = c.get('user')
  const body = await c.req.json()
  
  const command: UnifiedCommand = {
    type: 'JOIN_GAME',
    gameId,
    userId: user.id,
    playerName: body.playerName || user.email.split('@')[0]
  }
  
  const result = await unifiedCommandService.executeCommand(command, {
    userId: user.id,
    timestamp: new Date()
  })
  
  if (!result.success) {
    throw new HTTPException(400, { message: result.error || 'Failed to join game' })
  }
  
  const gameState = await unifiedCommandService.getGameState(gameId)
  
  return c.json({
    success: true,
    data: {
      playerId: result.data.playerId,
      isHost: result.data.isHost,
      gameState,
      route: getRouteForGameState(gameId, gameState.state)
    }
  })
})

/**
 * LEAVE GAME
 * POST /api/unified/games/:gameId/leave
 */
app.post('/:gameId/leave', async (c) => {
  const gameId = c.req.param('gameId')
  const user = c.get('user')
  const body = await c.req.json()
  
  // Find user's player ID
  const gameState = await unifiedCommandService.getGameState(gameId)
  if (!gameState) {
    throw new HTTPException(404, { message: 'Game not found' })
  }
  
  const player = gameState.players.find((p: any) => p.userId === user.id)
  if (!player) {
    throw new HTTPException(400, { message: 'Not in this game' })
  }
  
  const command: UnifiedCommand = {
    type: 'LEAVE_GAME',
    gameId,
    playerId: player.id,
    reason: body.reason || 'manual'
  }
  
  const result = await unifiedCommandService.executeCommand(command, {
    userId: user.id,
    timestamp: new Date()
  })
  
  if (!result.success) {
    throw new HTTPException(400, { message: result.error || 'Failed to leave game' })
  }
  
  return c.json({
    success: true,
    data: { message: 'Left game successfully' }
  })
})

/**
 * START GAME
 * POST /api/unified/games/:gameId/start
 */
app.post('/:gameId/start', async (c) => {
  const gameId = c.req.param('gameId')
  const user = c.get('user')
  
  const command: UnifiedCommand = {
    type: 'START_GAME',
    gameId,
    requestedBy: user.id
  }
  
  const result = await unifiedCommandService.executeCommand(command, {
    userId: user.id,
    timestamp: new Date()
  })
  
  if (!result.success) {
    throw new HTTPException(400, { message: result.error || 'Failed to start game' })
  }
  
  const gameState = await unifiedCommandService.getGameState(gameId)
  
  return c.json({
    success: true,
    data: {
      gameState,
      route: getRouteForGameState(gameId, gameState.state)
    }
  })
})

/**
 * ADD AI PLAYER
 * POST /api/unified/games/:gameId/ai
 */
app.post('/:gameId/ai', async (c) => {
  const gameId = c.req.param('gameId')
  const user = c.get('user')
  const body = await c.req.json()
  
  const command: UnifiedCommand = {
    type: 'ADD_AI_PLAYER',
    gameId,
    name: body.name || 'AI Bot',
    personality: body.personality || 'balanced',
    difficulty: body.difficulty || 'normal',
    requestedBy: user.id
  }
  
  const result = await unifiedCommandService.executeCommand(command, {
    userId: user.id,
    timestamp: new Date()
  })
  
  if (!result.success) {
    throw new HTTPException(400, { message: result.error || 'Failed to add AI player' })
  }
  
  const gameState = await unifiedCommandService.getGameState(gameId)
  
  return c.json({
    success: true,
    data: {
      playerId: result.data.playerId,
      gameState
    }
  })
})

/**
 * REMOVE AI PLAYER
 * DELETE /api/unified/games/:gameId/ai/:playerId
 */
app.delete('/:gameId/ai/:playerId', async (c) => {
  const gameId = c.req.param('gameId')
  const playerId = c.req.param('playerId')
  const user = c.get('user')
  
  const command: UnifiedCommand = {
    type: 'REMOVE_AI_PLAYER',
    gameId,
    playerId,
    requestedBy: user.id
  }
  
  const result = await unifiedCommandService.executeCommand(command, {
    userId: user.id,
    timestamp: new Date()
  })
  
  if (!result.success) {
    throw new HTTPException(400, { message: result.error || 'Failed to remove AI player' })
  }
  
  const gameState = await unifiedCommandService.getGameState(gameId)
  
  return c.json({
    success: true,
    data: { gameState }
  })
})

/**
 * PERFORM GAME ACTION
 * POST /api/unified/games/:gameId/actions
 */
app.post('/:gameId/actions', async (c) => {
  const gameId = c.req.param('gameId')
  const user = c.get('user')
  const body = await c.req.json()
  
  // Find user's player ID
  const gameState = await unifiedCommandService.getGameState(gameId)
  if (!gameState) {
    throw new HTTPException(404, { message: 'Game not found' })
  }
  
  const player = gameState.players.find((p: any) => p.userId === user.id)
  if (!player) {
    throw new HTTPException(400, { message: 'Not in this game' })
  }
  
  const command: UnifiedCommand = {
    type: 'PERFORM_ACTION',
    gameId,
    playerId: player.id,
    action: body.action,
    data: body.data
  }
  
  const result = await unifiedCommandService.executeCommand(command, {
    userId: user.id,
    playerId: player.id,
    timestamp: new Date()
  })
  
  if (!result.success) {
    throw new HTTPException(400, { message: result.error || 'Action failed' })
  }
  
  const updatedGameState = await unifiedCommandService.getGameState(gameId)
  
  return c.json({
    success: true,
    data: {
      result: result.data,
      gameState: updatedGameState
    }
  })
})

/**
 * END TURN
 * POST /api/unified/games/:gameId/end-turn
 */
app.post('/:gameId/end-turn', async (c) => {
  const gameId = c.req.param('gameId')
  const user = c.get('user')
  
  // Find user's player ID
  const gameState = await unifiedCommandService.getGameState(gameId)
  if (!gameState) {
    throw new HTTPException(404, { message: 'Game not found' })
  }
  
  const player = gameState.players.find((p: any) => p.userId === user.id)
  if (!player) {
    throw new HTTPException(400, { message: 'Not in this game' })
  }
  
  const command: UnifiedCommand = {
    type: 'END_TURN',
    gameId,
    playerId: player.id
  }
  
  const result = await unifiedCommandService.executeCommand(command, {
    userId: user.id,
    playerId: player.id,
    timestamp: new Date()
  })
  
  if (!result.success) {
    throw new HTTPException(400, { message: result.error || 'Failed to end turn' })
  }
  
  const updatedGameState = await unifiedCommandService.getGameState(gameId)
  
  return c.json({
    success: true,
    data: {
      gameState: updatedGameState
    }
  })
})

/**
 * ADMIN ENDPOINTS
 */

/**
 * PAUSE GAME (ADMIN)
 * POST /api/unified/games/:gameId/pause
 */
app.post('/:gameId/pause', async (c) => {
  const gameId = c.req.param('gameId')
  const user = c.get('user')
  const body = await c.req.json()
  
  const command: UnifiedCommand = {
    type: 'PAUSE_GAME',
    gameId,
    reason: body.reason || 'manual',
    pausedBy: user.id
  }
  
  const result = await unifiedCommandService.executeCommand(command, {
    userId: user.id,
    timestamp: new Date()
  })
  
  if (!result.success) {
    throw new HTTPException(400, { message: result.error || 'Failed to pause game' })
  }
  
  const gameState = await unifiedCommandService.getGameState(gameId)
  
  return c.json({
    success: true,
    data: { gameState }
  })
})

/**
 * RESUME GAME (ADMIN)
 * POST /api/unified/games/:gameId/resume
 */
app.post('/:gameId/resume', async (c) => {
  const gameId = c.req.param('gameId')
  const user = c.get('user')
  
  const command: UnifiedCommand = {
    type: 'RESUME_GAME',
    gameId,
    resumedBy: user.id
  }
  
  const result = await unifiedCommandService.executeCommand(command, {
    userId: user.id,
    timestamp: new Date()
  })
  
  if (!result.success) {
    throw new HTTPException(400, { message: result.error || 'Failed to resume game' })
  }
  
  const gameState = await unifiedCommandService.getGameState(gameId)
  
  return c.json({
    success: true,
    data: { gameState }
  })
})

/**
 * BULK OPERATIONS
 */

/**
 * GET USER'S GAMES
 * GET /api/unified/games/user/games
 */
app.get('/user/games', async (c) => {
  const user = c.get('user')
  
  const userGames = await unifiedGameManager.getGamesByUser(user.id)
  
  const games = await Promise.all(
    userGames.map(async (gameId) => {
      const gameState = await unifiedCommandService.getGameState(gameId)
      return {
        gameId,
        gameCode: gameState?.gameCode,
        status: gameState?.state,
        playerCount: gameState?.players.filter((p: any) => p.status === 'active').length || 0,
        isHost: gameState?.players.find((p: any) => p.userId === user.id)?.isHost || false,
        route: gameState ? getRouteForGameState(gameId, gameState.state) : null
      }
    })
  )
  
  return c.json({
    success: true,
    data: { games }
  })
})

/**
 * GET ACTIVE GAMES (ADMIN)
 * GET /api/unified/games/admin/active
 */
app.get('/admin/active', async (c) => {
  // TODO: Add admin authorization check
  
  const activeGames = await unifiedGameManager.getAllActiveGames()
  
  return c.json({
    success: true,
    data: { activeGames }
  })
})

/**
 * HEALTH CHECK
 * GET /api/unified/games/health
 */
app.get('/health', async (c) => {
  const health = unifiedGameManager.getHealthStatus()
  
  return c.json({
    success: true,
    data: health
  })
})

export default app