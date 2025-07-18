import { v4 as uuidv4 } from 'uuid'
import { db } from '../db/index'
import { userProfiles, games, players } from '../db/schema'
import { eq, inArray } from 'drizzle-orm'
import { eventStore } from '../db/event-store-repository'

/**
 * Test data generation utilities
 */

// In-memory tracking for test cleanup
const createdUserProfiles = new Set<string>()
const createdGames = new Set<string>()

export interface TestUser {
  id: string
  email: string
  displayName: string
  avatarEmoji: string
}

export interface TestGame {
  id: string
  gameCode: string
  hostUserId: string
  hostPlayerId: string
}

/**
 * Generate a test UUID
 */
export function generateTestUUID(): string {
  return uuidv4()
}

/**
 * Create a test user profile in the database
 */
export async function createTestUser(overrides: Partial<TestUser> = {}): Promise<TestUser> {
  const user: TestUser = {
    id: generateTestUUID(),
    email: `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}@example.com`,
    displayName: 'Test User',
    avatarEmoji: '👤',
    ...overrides
  }

  // Insert user profile into database
  await db.insert(userProfiles).values({
    id: user.id,
    email: user.email,
    name: user.displayName,
    avatarEmoji: user.avatarEmoji,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  })

  // Track for cleanup
  createdUserProfiles.add(user.id)
  
  return user
}

/**
 * Create multiple test users
 */
export async function createTestUsers(count: number): Promise<TestUser[]> {
  const users: TestUser[] = []
  for (let i = 0; i < count; i++) {
    const user = await createTestUser({
      displayName: `Test User ${i + 1}`,
      avatarEmoji: ['👤', '🤖', '👨', '👩', '🧑'][i % 5]
    })
    users.push(user)
  }
  return users
}

/**
 * Create a test game with proper event sourcing
 */
export async function createTestGame(overrides: Partial<{
  hostUser: TestUser
  gameCode: string
  gameId: string
}> = {}): Promise<TestGame> {
  // Create host user if not provided
  const hostUser = overrides.hostUser || await createTestUser({
    displayName: 'Game Host',
    avatarEmoji: '👑'
  })

  const gameId = overrides.gameId || `test_game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const gameCode = overrides.gameCode || generateGameCode()

  // Create game using event store (ensures proper event sourcing)
  const result = await eventStore.createGame({
    id: gameId,
    gameCode,
    hostUserId: hostUser.id,
    hostPlayerName: hostUser.displayName,
    hostAvatarEmoji: hostUser.avatarEmoji
  })

  // Track for cleanup
  createdGames.add(gameId)

  return {
    id: gameId,
    gameCode,
    hostUserId: hostUser.id,
    hostPlayerId: result.hostPlayer.id
  }
}

/**
 * Generate a random game code (6 uppercase letters/numbers)
 */
export function generateGameCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * Create a lobby with multiple players for testing
 */
export async function createTestLobby(playerCount: number = 2): Promise<{
  game: TestGame
  users: TestUser[]
  playerIds: string[]
}> {
  // Create host user and game
  const hostUser = await createTestUser({
    displayName: 'Lobby Host',
    avatarEmoji: '👑'
  })
  
  const game = await createTestGame({ hostUser })
  const users = [hostUser]
  const playerIds = [game.hostPlayerId]

  // Add additional players if requested
  for (let i = 1; i < playerCount; i++) {
    const user = await createTestUser({
      displayName: `Player ${i + 1}`,
      avatarEmoji: ['🤖', '👨', '👩', '🧑', '👶'][i % 5]
    })
    users.push(user)
    
    // TODO: Add player joining logic here when command service is available
    // For now, we just track the users
  }

  return { game, users, playerIds }
}

/**
 * Wait for a specified number of milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Clean up all test data created during the test run
 */
export async function cleanupTestData(): Promise<void> {
  try {
    // Clean up all games and their related data (cascading deletes will handle players, events, etc.)
    if (createdGames.size > 0) {
      const gameIds = Array.from(createdGames)
      await db.delete(games).where(
        gameIds.length === 1 
          ? eq(games.id, gameIds[0])
          : inArray(games.id, gameIds)
      )
    }

    // Clean up user profiles
    if (createdUserProfiles.size > 0) {
      const userIds = Array.from(createdUserProfiles)
      await db.delete(userProfiles).where(
        userIds.length === 1
          ? eq(userProfiles.id, userIds[0])
          : inArray(userProfiles.id, userIds)
      )
    }

    // Clear tracking sets
    createdUserProfiles.clear()
    createdGames.clear()
  } catch (error) {
    console.warn('Error during test cleanup:', error)
  }
}

/**
 * Setup test environment with clean database state
 */
export async function setupTestEnvironment(): Promise<void> {
  // Could add database migrations or other setup here if needed
  await cleanupTestData()
}

/**
 * Generate realistic test data for game scenarios
 */
export const TEST_SCENARIOS = {
  SMALL_LOBBY: { playerCount: 2, aiCount: 1 },
  FULL_LOBBY: { playerCount: 3, aiCount: 1 },
  AI_HEAVY: { playerCount: 1, aiCount: 3 },
  SINGLE_PLAYER: { playerCount: 1, aiCount: 0 }
}

/**
 * Create a test scenario with predefined configuration
 */
export async function createTestScenario(scenario: keyof typeof TEST_SCENARIOS): Promise<{
  game: TestGame
  users: TestUser[]
  playerIds: string[]
}> {
  const config = TEST_SCENARIOS[scenario]
  return await createTestLobby(config.playerCount)
}

/**
 * Assertion helpers for common test patterns
 */
export const TestAssertions = {
  isValidUUID: (value: string): boolean => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    return uuidRegex.test(value)
  },
  
  isValidGameCode: (value: string): boolean => {
    return /^[A-Z0-9]{6}$/.test(value)
  },
  
  isValidTimestamp: (value: any): boolean => {
    return value instanceof Date && !isNaN(value.getTime())
  }
} 