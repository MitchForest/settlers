import { db, games } from '../db'
import { eq } from 'drizzle-orm'

/**
 * Characters allowed in game codes
 * Excludes ambiguous characters: 0, O, 1, I, L
 */
const GAME_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/**
 * Generates a random 6-character alphanumeric game code
 * Excludes visually similar characters to reduce confusion
 */
export function generateGameCode(): string {
  let result = ''
  for (let i = 0; i < 6; i++) {
    result += GAME_CODE_CHARS.charAt(Math.floor(Math.random() * GAME_CODE_CHARS.length))
  }
  return result
}

/**
 * Validates game code format
 * @param code - The code to validate
 * @returns true if code format is valid
 */
export function isValidGameCodeFormat(code: string): boolean {
  if (!code || code.length !== 6) return false
  
  // Check if all characters are in our allowed set
  return code.split('').every(char => GAME_CODE_CHARS.includes(char))
}

/**
 * Checks if a game code is unique in the database
 * @param code - The code to check
 * @returns true if the code is not in use
 */
export async function isGameCodeUnique(code: string): Promise<boolean> {
  try {
    const existing = await db
      .select({ id: games.id })
      .from(games)
      .where(eq(games.gameCode, code))
      .limit(1)
    
    return existing.length === 0
  } catch (error) {
    console.error('Error checking game code uniqueness:', error)
    throw new Error('Failed to validate game code uniqueness')
  }
}

/**
 * Generates a unique game code by checking against existing codes
 * @param maxAttempts - Maximum number of generation attempts (default: 10)
 * @returns A unique game code
 * @throws Error if unable to generate unique code within max attempts
 */
export async function generateUniqueGameCode(maxAttempts: number = 10): Promise<string> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const code = generateGameCode()
    
    if (await isGameCodeUnique(code)) {
      return code
    }
    
    console.warn(`Game code collision on attempt ${attempt}: ${code}`)
  }
  
  throw new Error(`Failed to generate unique game code after ${maxAttempts} attempts`)
}

/**
 * Finds a game by its code
 * @param code - The game code to search for
 * @returns The game record or null if not found
 */
export async function findGameByCode(code: string) {
  if (!isValidGameCodeFormat(code)) {
    return null
  }
  
  try {
    const result = await db
      .select()
      .from(games)
      .where(eq(games.gameCode, code))
      .limit(1)
    
    return result[0] || null
  } catch (error) {
    console.error('Error finding game by code:', error)
    throw new Error('Failed to lookup game by code')
  }
}

/**
 * Finds active games (lobby or playing status) by code
 * @param code - The game code to search for
 * @returns The game record or null if not found or not active
 */
export async function findActiveGameByCode(code: string) {
  if (!isValidGameCodeFormat(code)) {
    return null
  }
  
  try {
    const result = await db
      .select()
      .from(games)
      .where(eq(games.gameCode, code))
      .limit(1)
    
    const game = result[0]
    if (!game) return null
    
    // Only return if game is in lobby or playing state
    if (game.status === 'lobby' || game.status === 'playing') {
      return game
    }
    
    return null
  } catch (error) {
    console.error('Error finding active game by code:', error)
    throw new Error('Failed to lookup active game by code')
  }
}

/**
 * Normalizes a game code to uppercase and removes spaces
 * @param code - The raw code input
 * @returns Normalized code string
 */
export function normalizeGameCode(code: string): string {
  return code.replace(/\s/g, '').toUpperCase()
} 