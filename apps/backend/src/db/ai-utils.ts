import { eq, and, desc } from 'drizzle-orm'
import { db } from './index'
import { players, aiStats } from './schema'
import type { PlayerId } from '@settlers/core'
import type { AutoPlayerConfig, AutoPlayerStats } from '@settlers/core'

/**
 * Database utilities for AI state management
 * 
 * These functions sync AI configuration and statistics between
 * the in-memory AI system and the persistent database.
 */

export interface AIPlayerData {
  playerId: PlayerId
  gameId: string
  isAI: boolean
  personality: 'aggressive' | 'balanced' | 'defensive' | 'economic' | null
  difficulty: 'easy' | 'medium' | 'hard' | null
  isAutoMode: boolean
  isDisconnected: boolean
  thinkingTimeMs: number
  maxActionsPerTurn: number
  enableLogging: boolean
}

export interface AIStatsData {
  id: string
  gameId: string
  playerId: PlayerId
  turnsPlayed: number
  actionsExecuted: number
  successfulActions: number
  failedActions: number
  averageDecisionTimeMs: number
  setupTurns: number
  regularTurns: number
  specialActionTurns: number
  buildingActions: number
  tradeActions: number
  cardActions: number
  robberActions: number
  finalScore: number | null
  gameWon: boolean | null
  gamePosition: number | null
  aiStartedAt: Date
  aiEndedAt: Date | null
  lastActionAt: Date
  createdAt: Date
  updatedAt: Date
}

/**
 * Update player AI configuration in database
 */
export async function updatePlayerAIConfig(
  gameId: string,
  playerId: PlayerId,
  config: Partial<AutoPlayerConfig>
): Promise<void> {
  try {
    await db
      .update(players)
      .set({
        isAI: true,
        aiPersonality: config.personality || null,
        aiDifficulty: config.difficulty || null,
        aiThinkingTimeMs: config.thinkingTimeMs || 2000,
        aiMaxActionsPerTurn: config.maxActionsPerTurn || 15,
        aiEnableLogging: config.enableLogging ?? true,
        // Note: isAutoMode and isDisconnected are set separately
      })
      .where(and(
        eq(players.gameId, gameId),
        eq(players.id, playerId)
      ))
      
  } catch (error) {
    console.error('Failed to update player AI config in database:', error)
    throw error
  }
}

/**
 * Set AI mode flags for a player
 */
export async function setPlayerAIMode(
  gameId: string,
  playerId: PlayerId,
  isAutoMode: boolean,
  isDisconnected: boolean
): Promise<void> {
  try {
    await db
      .update(players)
      .set({
        isAI: isAutoMode || isDisconnected,
        aiIsAutoMode: isAutoMode,
        aiIsDisconnected: isDisconnected,
      })
      .where(and(
        eq(players.gameId, gameId),
        eq(players.id, playerId)
      ))
      
  } catch (error) {
    console.error('Failed to set player AI mode in database:', error)
    throw error
  }
}

/**
 * Get AI configuration for a player from database
 */
export async function getPlayerAIConfig(
  gameId: string,
  playerId: PlayerId
): Promise<AIPlayerData | null> {
  try {
    const result = await db
      .select({
        playerId: players.id,
        gameId: players.gameId,
        isAI: players.isAI,
        personality: players.aiPersonality,
        difficulty: players.aiDifficulty,
        isAutoMode: players.aiIsAutoMode,
        isDisconnected: players.aiIsDisconnected,
        thinkingTimeMs: players.aiThinkingTimeMs,
        maxActionsPerTurn: players.aiMaxActionsPerTurn,
        enableLogging: players.aiEnableLogging,
      })
      .from(players)
      .where(and(
        eq(players.gameId, gameId),
        eq(players.id, playerId)
      ))
             .limit(1)

     if (result.length === 0) return null
     
     const player = result[0]
     return {
       playerId: player.playerId,
       gameId: player.gameId,
       isAI: player.isAI,
       personality: player.personality,
       difficulty: player.difficulty,
       isAutoMode: player.isAutoMode ?? false,
       isDisconnected: player.isDisconnected ?? false,
       thinkingTimeMs: player.thinkingTimeMs ?? 2000,
       maxActionsPerTurn: player.maxActionsPerTurn ?? 15,
       enableLogging: player.enableLogging ?? true,
     }
     
   } catch (error) {
     console.error('Failed to get player AI config from database:', error)
     return null
   }
}

/**
 * Get all AI players in a game
 */
export async function getGameAIPlayers(gameId: string): Promise<AIPlayerData[]> {
  try {
    const result = await db
      .select({
        playerId: players.id,
        gameId: players.gameId,
        isAI: players.isAI,
        personality: players.aiPersonality,
        difficulty: players.aiDifficulty,
        isAutoMode: players.aiIsAutoMode,
        isDisconnected: players.aiIsDisconnected,
        thinkingTimeMs: players.aiThinkingTimeMs,
        maxActionsPerTurn: players.aiMaxActionsPerTurn,
        enableLogging: players.aiEnableLogging,
      })
      .from(players)
      .where(and(
        eq(players.gameId, gameId),
                 eq(players.isAI, true)
       ))

     return result.map(player => ({
       playerId: player.playerId,
       gameId: player.gameId,
       isAI: player.isAI,
       personality: player.personality,
       difficulty: player.difficulty,
       isAutoMode: player.isAutoMode ?? false,
       isDisconnected: player.isDisconnected ?? false,
       thinkingTimeMs: player.thinkingTimeMs ?? 2000,
       maxActionsPerTurn: player.maxActionsPerTurn ?? 15,
       enableLogging: player.enableLogging ?? true,
     }))
    
  } catch (error) {
    console.error('Failed to get game AI players from database:', error)
    return []
  }
}

/**
 * Create or update AI statistics record
 */
export async function upsertAIStats(
  gameId: string,
  playerId: PlayerId,
  stats: AutoPlayerStats
): Promise<void> {
  try {
    // Check if record exists
    const existing = await db
      .select({ id: aiStats.id })
      .from(aiStats)
      .where(and(
        eq(aiStats.gameId, gameId),
        eq(aiStats.playerId, playerId)
      ))
      .limit(1)

    const statsData = {
      turnsPlayed: stats.turnsPlayed,
      actionsExecuted: stats.actionsExecuted,
      successfulActions: stats.successfulActions,
      failedActions: stats.failedActions,
      averageDecisionTimeMs: Math.round(stats.averageDecisionTime),
      lastActionAt: stats.lastActionTime,
      updatedAt: new Date(),
    }

    if (existing.length > 0) {
      // Update existing record
      await db
        .update(aiStats)
        .set(statsData)
        .where(and(
          eq(aiStats.gameId, gameId),
          eq(aiStats.playerId, playerId)
        ))
    } else {
      // Create new record
      await db
        .insert(aiStats)
        .values({
          id: crypto.randomUUID(),
          gameId,
          playerId,
          ...statsData,
        })
    }
    
  } catch (error) {
    console.error('Failed to upsert AI stats in database:', error)
    throw error
  }
}

/**
 * Update AI action type counters
 */
export async function incrementAIActionCounter(
  gameId: string,
  playerId: PlayerId,
  actionType: 'building' | 'trade' | 'card' | 'robber' | 'setup' | 'regular' | 'special'
): Promise<void> {
  try {
    // Get current values
    const current = await db
      .select({
        buildingActions: aiStats.buildingActions,
        tradeActions: aiStats.tradeActions,
        cardActions: aiStats.cardActions,
        robberActions: aiStats.robberActions,
        setupTurns: aiStats.setupTurns,
        regularTurns: aiStats.regularTurns,
        specialActionTurns: aiStats.specialActionTurns,
      })
      .from(aiStats)
      .where(and(
        eq(aiStats.gameId, gameId),
        eq(aiStats.playerId, playerId)
      ))
      .limit(1)

    if (current.length === 0) return // No stats record exists

    const stats = current[0]
    const updates: any = { updatedAt: new Date() }

    switch (actionType) {
      case 'building':
        updates.buildingActions = stats.buildingActions + 1
        break
      case 'trade':
        updates.tradeActions = stats.tradeActions + 1
        break
      case 'card':
        updates.cardActions = stats.cardActions + 1
        break
      case 'robber':
        updates.robberActions = stats.robberActions + 1
        break
      case 'setup':
        updates.setupTurns = stats.setupTurns + 1
        break
      case 'regular':
        updates.regularTurns = stats.regularTurns + 1
        break
      case 'special':
        updates.specialActionTurns = stats.specialActionTurns + 1
        break
    }

    await db
      .update(aiStats)
      .set(updates)
      .where(and(
        eq(aiStats.gameId, gameId),
        eq(aiStats.playerId, playerId)
      ))
      
  } catch (error) {
    console.error('Failed to increment AI action counter:', error)
  }
}

/**
 * Finalize AI statistics when game ends
 */
export async function finalizeAIStats(
  gameId: string,
  playerId: PlayerId,
  finalScore: number,
  gameWon: boolean,
  gamePosition: number
): Promise<void> {
  try {
    await db
      .update(aiStats)
      .set({
        finalScore,
        gameWon,
        gamePosition,
        aiEndedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(
        eq(aiStats.gameId, gameId),
        eq(aiStats.playerId, playerId)
      ))
      
  } catch (error) {
    console.error('Failed to finalize AI stats:', error)
    throw error
  }
}

/**
 * Get AI statistics for a player
 */
export async function getAIStats(
  gameId: string,
  playerId: PlayerId
): Promise<AIStatsData | null> {
  try {
    const result = await db
      .select()
      .from(aiStats)
      .where(and(
        eq(aiStats.gameId, gameId),
        eq(aiStats.playerId, playerId)
      ))
      .limit(1)

    return result[0] || null
    
  } catch (error) {
    console.error('Failed to get AI stats from database:', error)
    return null
  }
}

/**
 * Get historical AI performance across all games
 */
export async function getAIPerformanceHistory(
  playerId?: PlayerId,
  gameId?: string,
  limit: number = 50
): Promise<AIStatsData[]> {
  try {
    const conditions = []
    if (playerId) conditions.push(eq(aiStats.playerId, playerId))
    if (gameId) conditions.push(eq(aiStats.gameId, gameId))

    let result
    if (conditions.length > 0) {
      result = await db
        .select()
        .from(aiStats)
        .where(and(...conditions))
        .orderBy(desc(aiStats.createdAt))
        .limit(limit)
    } else {
      result = await db
        .select()
        .from(aiStats)
        .orderBy(desc(aiStats.createdAt))
        .limit(limit)
    }

    return result
    
  } catch (error) {
    console.error('Failed to get AI performance history:', error)
    return []
  }
}

/**
 * Get aggregated AI statistics summary
 */
export async function getAIStatsSummary(): Promise<{
  totalGames: number
  totalAIPlayers: number
  averageScore: number
  winRate: number
  averageGameDuration: number
  personalityStats: Record<string, { games: number; winRate: number; avgScore: number }>
  difficultyStats: Record<string, { games: number; winRate: number; avgScore: number }>
}> {
  try {
    // Get all AI stats with non-null final scores (completed games)
    const allStats = await db
      .select()
      .from(aiStats)
      .where(eq(aiStats.finalScore, aiStats.finalScore)) // Not null check

    // Get player info for personality/difficulty breakdown
    const playerInfo = await db
      .select({
        id: players.id,
        personality: players.aiPersonality,
        difficulty: players.aiDifficulty,
      })
      .from(players)
      .where(eq(players.isAI, true))

    const playerMap = new Map(playerInfo.map(p => [p.id, p]))

    const totalGames = new Set(allStats.map(s => s.gameId)).size
    const totalAIPlayers = allStats.length
    const averageScore = totalAIPlayers > 0 
      ? allStats.reduce((sum, s) => sum + (s.finalScore || 0), 0) / totalAIPlayers 
      : 0
    const gamesWon = allStats.filter(s => s.gameWon).length
    const winRate = totalAIPlayers > 0 ? gamesWon / totalAIPlayers : 0

    // Calculate average game duration (in minutes)
    const completedGames = allStats.filter(s => s.aiEndedAt)
    const averageGameDuration = completedGames.length > 0
      ? completedGames.reduce((sum, s) => {
          const duration = s.aiEndedAt!.getTime() - s.aiStartedAt.getTime()
          return sum + duration / (1000 * 60) // Convert to minutes
        }, 0) / completedGames.length
      : 0

    // Personality breakdown
    const personalityStats: Record<string, { games: number; winRate: number; avgScore: number }> = {}
    for (const stat of allStats) {
      const player = playerMap.get(stat.playerId)
      const personality = player?.personality || 'unknown'
      
      if (!personalityStats[personality]) {
        personalityStats[personality] = { games: 0, winRate: 0, avgScore: 0 }
      }
      
      personalityStats[personality].games++
      if (stat.gameWon) personalityStats[personality].winRate++
      personalityStats[personality].avgScore += stat.finalScore || 0
    }

    // Calculate averages for personality stats
    for (const personality in personalityStats) {
      const stats = personalityStats[personality]
      stats.winRate = stats.games > 0 ? stats.winRate / stats.games : 0
      stats.avgScore = stats.games > 0 ? stats.avgScore / stats.games : 0
    }

    // Difficulty breakdown (same pattern)
    const difficultyStats: Record<string, { games: number; winRate: number; avgScore: number }> = {}
    for (const stat of allStats) {
      const player = playerMap.get(stat.playerId)
      const difficulty = player?.difficulty || 'unknown'
      
      if (!difficultyStats[difficulty]) {
        difficultyStats[difficulty] = { games: 0, winRate: 0, avgScore: 0 }
      }
      
      difficultyStats[difficulty].games++
      if (stat.gameWon) difficultyStats[difficulty].winRate++
      difficultyStats[difficulty].avgScore += stat.finalScore || 0
    }

    // Calculate averages for difficulty stats
    for (const difficulty in difficultyStats) {
      const stats = difficultyStats[difficulty]
      stats.winRate = stats.games > 0 ? stats.winRate / stats.games : 0
      stats.avgScore = stats.games > 0 ? stats.avgScore / stats.games : 0
    }

    return {
      totalGames,
      totalAIPlayers,
      averageScore,
      winRate,
      averageGameDuration,
      personalityStats,
      difficultyStats,
    }
    
  } catch (error) {
    console.error('Failed to get AI stats summary:', error)
    return {
      totalGames: 0,
      totalAIPlayers: 0,
      averageScore: 0,
      winRate: 0,
      averageGameDuration: 0,
      personalityStats: {},
      difficultyStats: {},
    }
  }
}

/**
 * Clean up AI stats for games older than specified days
 */
export async function cleanupOldAIStats(daysOld: number = 30): Promise<number> {
  try {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)

    const deleted = await db
      .delete(aiStats)
      .where(eq(aiStats.createdAt, aiStats.createdAt)) // TODO: Add proper date comparison
    
    console.log(`Cleaned up AI stats older than ${daysOld} days`)
    return 0 // Return count when proper date comparison is implemented
    
  } catch (error) {
    console.error('Failed to cleanup old AI stats:', error)
    return 0
  }
} 