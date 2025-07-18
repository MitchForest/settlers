/**
 * Game code utilities for generating and validating unique game codes
 */

import { db } from '../db/index'
import { games } from '../db/schema'
import { eq } from 'drizzle-orm'

// Game code format: 6 uppercase letters/numbers
const GAME_CODE_LENGTH = 6
const GAME_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

/**
 * Generate a random game code
 */
export function generateGameCode(): string {
  let result = ''
  for (let i = 0; i < GAME_CODE_LENGTH; i++) {
    result += GAME_CODE_CHARS.charAt(Math.floor(Math.random() * GAME_CODE_CHARS.length))
  }
  return result
}

/**
 * Generate a unique game code (checks database for conflicts)
 */
export async function generateUniqueGameCode(maxAttempts: number = 10): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generateGameCode()
    
    // Check if code already exists
    const existing = await db
      .select({ id: games.id })
      .from(games)
      .where(eq(games.gameCode, code))
      .limit(1)
    
    if (existing.length === 0) {
      return code
    }
  }
  
  throw new Error(`Failed to generate unique game code after ${maxAttempts} attempts`)
}

/**
 * Validate game code format
 */
export function isValidGameCodeFormat(code: string): boolean {
  if (!code || typeof code !== 'string') {
    return false
  }
  
  // Check length
  if (code.length !== GAME_CODE_LENGTH) {
    return false
  }
  
  // Check characters
  return /^[A-Z0-9]+$/.test(code)
}

/**
 * Normalize game code (uppercase, trim)
 */
export function normalizeGameCode(code: string): string {
  return code.trim().toUpperCase()
}

/**
 * Find an active game by code
 */
export async function findActiveGameByCode(code: string): Promise<typeof games.$inferSelect | null> {
  const normalizedCode = normalizeGameCode(code)
  
  if (!isValidGameCodeFormat(normalizedCode)) {
    return null
  }
  
  const result = await db
    .select()
    .from(games)
    .where(eq(games.gameCode, normalizedCode))
    .limit(1)
  
  if (result.length === 0) {
    return null
  }
  
  const game = result[0]
  
  // Check if game is still active (not ended and active flag set)
  if (game.currentPhase === 'ended' || !game.isActive) {
    return null
  }
  
  return game
}

/**
 * Check if a game code is available
 */
export async function isGameCodeAvailable(code: string): Promise<boolean> {
  const normalizedCode = normalizeGameCode(code)
  
  if (!isValidGameCodeFormat(normalizedCode)) {
    return false
  }
  
  const existing = await db
    .select({ id: games.id })
    .from(games)
    .where(eq(games.gameCode, normalizedCode))
    .limit(1)
  
  return existing.length === 0
} 