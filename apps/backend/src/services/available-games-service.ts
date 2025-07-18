import { db } from '../db'
import { games } from '../db/schema'
import { eq, and } from 'drizzle-orm'
import { FriendsService } from './friends-service'
import { lobbyCommandService } from './lobby-command-service'

export interface GameInfo {
  id: string
  gameCode: string
  hostUserId?: string
  hostPlayerName: string
  hostAvatarEmoji: string
  playerCount: number
  maxPlayers: number
  isPublic: boolean
  createdAt: string
  hostFriend?: {
    id: string
    name: string
    avatarEmoji: string
    friendshipId: string
  }
}

export interface AvailableGamesResponse {
  friendsGames: GameInfo[]
  publicGames: GameInfo[]
  total: number
}

export class AvailableGamesService {
  /**
   * Get available games for a user, prioritizing friends' games
   */
  static async getAvailableGames(
    userId?: string,
    limit: number = 20
  ): Promise<AvailableGamesResponse> {
    try {
      // Get all active games in lobby phase
      const activeGames = await db
        .select({
          id: games.id,
          gameCode: games.gameCode,
          createdAt: games.createdAt,
          currentPhase: games.currentPhase,
          isActive: games.isActive
        })
        .from(games)
        .where(
          and(
            eq(games.currentPhase, 'lobby'), // Only games in lobby phase
            eq(games.isActive, true) // Only active games
          )
        )
        .orderBy(games.createdAt)
        .limit(limit * 2) // Get more than needed to filter

      if (activeGames.length === 0) {
        return {
          friendsGames: [],
          publicGames: [],
          total: 0
        }
      }

      // If user is provided, get their friends to identify friends' games
      let friendsIds: string[] = []
      let friendsMap: Map<string, any> = new Map()

      if (userId) {
        try {
          const friends = await FriendsService.getFriends(userId)
          friendsIds = friends.map(f => f.friendUser.id)
          
          // Create a map for quick friend lookup
          friends.forEach(friend => {
            friendsMap.set(friend.friendUser.id, {
              id: friend.friendUser.id,
              name: friend.friendUser.name,
              avatarEmoji: friend.friendUser.avatarEmoji,
              friendshipId: friend.id
            })
          })
        } catch (error) {
          console.error('Error fetching friends for available games:', error)
          // Continue without friends data
        }
      }

      // Get lobby states for all games and categorize
      const friendsGames: GameInfo[] = []
      const publicGames: GameInfo[] = []
      
      for (const game of activeGames) {
        try {
          const lobbyStateResult = await lobbyCommandService.getLobbyState(game.id)
          
          if (!lobbyStateResult.success || !lobbyStateResult.state) {
            continue // Skip games we can't get state for
          }

          const lobbyState = lobbyStateResult.state
          
          // Skip games that are full
          const playerCount = lobbyState.players.size
          if (playerCount >= lobbyState.settings.maxPlayers) {
            continue
          }

          // Find the host player
          const hostPlayer = Array.from(lobbyState.players.values()).find(p => p.isHost)
          if (!hostPlayer) {
            continue // Skip games without a host
          }

          // Skip games hosted by the user themselves
          if (userId && hostPlayer.userId === userId) {
            continue
          }

          const gameInfo: GameInfo = {
            id: game.id,
            gameCode: game.gameCode,
            hostUserId: hostPlayer.userId,
            hostPlayerName: hostPlayer.name,
            hostAvatarEmoji: hostPlayer.avatarEmoji || '🎮',
            playerCount: playerCount,
            maxPlayers: lobbyState.settings.maxPlayers,
            isPublic: true, // For now, assume all lobby games are public. This could be extended with settings.
            createdAt: game.createdAt
          }

          // Check if this game is hosted by a friend
          if (hostPlayer.userId && friendsIds.includes(hostPlayer.userId)) {
            gameInfo.hostFriend = friendsMap.get(hostPlayer.userId)
            friendsGames.push(gameInfo)
          } else {
            publicGames.push(gameInfo)
          }

        } catch (error) {
          console.error(`Error getting lobby state for game ${game.id}:`, error)
          continue // Skip this game
        }
      }

      // Limit results
      const limitedFriendsGames = friendsGames.slice(0, Math.min(10, limit))
      const remainingLimit = limit - limitedFriendsGames.length
      const limitedPublicGames = publicGames.slice(0, Math.max(0, remainingLimit))

      return {
        friendsGames: limitedFriendsGames,
        publicGames: limitedPublicGames,
        total: limitedFriendsGames.length + limitedPublicGames.length
      }

    } catch (error) {
      console.error('Error fetching available games:', error)
      return {
        friendsGames: [],
        publicGames: [],
        total: 0
      }
    }
  }

  /**
   * Search for a game by game code
   */
  static async findGameByCode(gameCode: string): Promise<GameInfo | null> {
    try {
      const game = await db
        .select({
          id: games.id,
          gameCode: games.gameCode,
          createdAt: games.createdAt,
          currentPhase: games.currentPhase,
          isActive: games.isActive
        })
        .from(games)
        .where(eq(games.gameCode, gameCode.toUpperCase()))
        .limit(1)

      if (!game.length) {
        return null
      }

      const gameData = game[0]

      // Check if game is in lobby phase and active
      if (gameData.currentPhase !== 'lobby' || !gameData.isActive) {
        return null
      }

      // Get lobby state to get detailed info
      const lobbyStateResult = await lobbyCommandService.getLobbyState(gameData.id)
      
      if (!lobbyStateResult.success || !lobbyStateResult.state) {
        return null
      }

      const lobbyState = lobbyStateResult.state
      
      // Find the host player
      const hostPlayer = Array.from(lobbyState.players.values()).find(p => p.isHost)
      if (!hostPlayer) {
        return null
      }

      // Check if game is full
      const playerCount = lobbyState.players.size
      if (playerCount >= lobbyState.settings.maxPlayers) {
        return null
      }
      
      return {
        id: gameData.id,
        gameCode: gameData.gameCode,
        hostUserId: hostPlayer.userId,
        hostPlayerName: hostPlayer.name,
        hostAvatarEmoji: hostPlayer.avatarEmoji || '🎮',
        playerCount: playerCount,
        maxPlayers: lobbyState.settings.maxPlayers,
        isPublic: true, // For now, assume all lobby games are public
        createdAt: gameData.createdAt
      }

    } catch (error) {
      console.error('Error finding game by code:', error)
      return null
    }
  }
} 