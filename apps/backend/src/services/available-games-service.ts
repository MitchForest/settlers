import { eventStore } from '../db/event-store-repository'
import { friendsCommandService } from './friends-command-service'
import { lobbyCommandService } from './lobby-command-service'

// **TYPES FOR SOCIAL GAME DISCOVERY**

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
  phase: 'lobby' | 'initial_placement' | 'main_game' | 'ended'
  hostFriend?: UserBasicInfo  // Present if host is friend
}

export interface UserBasicInfo {
  id: string
  name: string
  email: string
  avatarEmoji: string | null
}

export interface AvailableGamesResponse {
  friendsGames: GameInfo[]    // Games hosted by friends (priority)
  publicGames: GameInfo[]     // All other public games
  total: number
}

export interface AvailableGamesFilters {
  phase?: 'lobby' | 'initial_placement' | 'main_game'
  minPlayers?: number
  maxPlayers?: number
  search?: string
  limit?: number
  offset?: number
}

// **AVAILABLE GAMES SERVICE** - Social Game Discovery
export class AvailableGamesService {
  
  /**
   * Get available games with friends priority
   */
  static async getAvailableGames(
    currentUserId?: string, 
    filters: AvailableGamesFilters = {}
  ): Promise<AvailableGamesResponse> {
    try {
      const {
        phase,
        minPlayers = 0,
        maxPlayers = 8,
        search,
        limit = 20,
        offset = 0
      } = filters

      // Get all active games from event store
      const allGames = await this.getAllActiveGames()
      
      // Filter games based on criteria
      let filteredGames = allGames.filter(game => {
        // Only show lobby and initial_placement games (joinable)
        if (phase && game.phase !== phase) return false
        if (game.phase === 'main_game' || game.phase === 'ended') return false
        
        // Filter by player count
        if (game.playerCount < minPlayers || game.playerCount > maxPlayers) return false
        
        // Filter by search term
        if (search) {
          const searchLower = search.toLowerCase()
          return (
            game.gameCode.toLowerCase().includes(searchLower) ||
            game.hostPlayerName.toLowerCase().includes(searchLower)
          )
        }
        
        return true
      })

      let friendsGames: GameInfo[] = []
      let publicGames: GameInfo[] = []

      // Add friend data if user is authenticated
      if (currentUserId) {
        try {
                     const friendsResult = await friendsCommandService.getFriendsState(currentUserId)
          const friendIds = friendsResult.success && friendsResult.state
            ? new Set(Array.from(friendsResult.state.friends.keys()))
            : new Set<string>()

          // Separate games into friend-hosted and public
          filteredGames.forEach(game => {
            if (game.hostUserId && friendIds.has(game.hostUserId)) {
              // This is a friend's game - add friend info
              const friend = friendsResult.state!.friends.get(game.hostUserId)
              game.hostFriend = friend ? {
                id: friend.userId,
                name: friend.name,
                email: friend.email,
                avatarEmoji: friend.avatarEmoji
              } : undefined
              
              friendsGames.push(game)
            } else {
              publicGames.push(game)
            }
          })

          // Sort friends games by creation time (newest first)
          friendsGames.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        } catch (error) {
          console.error('Error getting friends state for available games:', error)
          // Continue without friend data if fetching fails
        }
      } else {
        // No user context - all games are public
        publicGames = filteredGames
      }

      // Sort public games by creation time (newest first)
      publicGames.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

      // Apply pagination to combined results
      const allSortedGames = [...friendsGames, ...publicGames]
      const paginatedGames = allSortedGames.slice(offset, offset + limit)
      
      // Split paginated results back into categories
      const paginatedFriendsGames = paginatedGames.filter(game => game.hostFriend)
      const paginatedPublicGames = paginatedGames.filter(game => !game.hostFriend)

      return {
        friendsGames: paginatedFriendsGames,
        publicGames: paginatedPublicGames,
        total: allSortedGames.length
      }

    } catch (error) {
      console.error('Error getting available games:', error)
      return {
        friendsGames: [],
        publicGames: [],
        total: 0
      }
    }
  }

  /**
   * Get a specific game by code for joining
   */
  static async getGameByCode(gameCode: string): Promise<{ success: boolean; game?: GameInfo; error?: string }> {
    try {
      // Validate game code format
      if (!gameCode || gameCode.length !== 6) {
        return {
          success: false,
          error: 'Invalid game code format. Must be 6 characters.'
        }
      }

      // Get game from event store
      const gameData = await eventStore.getGameByCode(gameCode.toUpperCase())
      if (!gameData) {
        return {
          success: false,
          error: 'Game not found'
        }
      }

      // Get lobby state to check if game is joinable
      const lobbyResult = await lobbyCommandService.getLobbyState(gameData.id)
      if (!lobbyResult.success || !lobbyResult.state) {
        return {
          success: false,
          error: 'Unable to get game state'
        }
      }

      // Check if game is joinable
      if (lobbyResult.state.phase !== 'lobby') {
        return {
          success: false,
          error: 'Game has already started and cannot be joined'
        }
      }

      if (lobbyResult.state.players.size >= lobbyResult.state.settings.maxPlayers) {
        return {
          success: false,
          error: 'Game is full'
        }
      }

             // Find the host player
       const hostPlayer = Array.from(lobbyResult.state.players.values()).find(p => p.isHost) ||
                         Array.from(lobbyResult.state.players.values())[0]

       // Convert to GameInfo format
       const game: GameInfo = {
         id: gameData.id,
         gameCode: gameData.gameCode,
         hostUserId: hostPlayer?.userId,
         hostPlayerName: hostPlayer?.name || 'Unknown',
         hostAvatarEmoji: hostPlayer?.avatarEmoji || '🎮',
         playerCount: lobbyResult.state.players.size,
         maxPlayers: lobbyResult.state.settings.maxPlayers,
         isPublic: true, // Assume public if found by code
         createdAt: gameData.createdAt,
         phase: lobbyResult.state.phase
       }

      return {
        success: true,
        game
      }

    } catch (error) {
      console.error('Error getting game by code:', error)
      return {
        success: false,
        error: 'Failed to find game'
      }
    }
  }

  /**
   * Get all active games from the event store
   * This is a helper method that reconstructs game states
   */
  private static async getAllActiveGames(): Promise<GameInfo[]> {
    try {
      // Get all active games from the database
      const activeGames = await eventStore.getAllActiveGames()
      
      const gameInfos: GameInfo[] = []

      // For each game, get its lobby state to extract current information
      for (const gameData of activeGames) {
        try {
          const lobbyResult = await lobbyCommandService.getLobbyState(gameData.id)
          
          if (lobbyResult.success && lobbyResult.state) {
            const lobby = lobbyResult.state
            
            // Find the host player (first player or isHost = true)
            const hostPlayer = Array.from(lobby.players.values()).find(p => p.isHost) ||
                              Array.from(lobby.players.values())[0]

            if (hostPlayer) {
              const gameInfo: GameInfo = {
                id: gameData.id,
                gameCode: gameData.gameCode,
                hostUserId: hostPlayer.userId,
                hostPlayerName: hostPlayer.name,
                hostAvatarEmoji: hostPlayer.avatarEmoji || '🎮',
                playerCount: lobby.players.size,
                maxPlayers: lobby.settings.maxPlayers,
                isPublic: true, // TODO: Add privacy settings to game
                createdAt: lobby.createdAt.toISOString(),
                phase: lobby.phase
              }
              
              gameInfos.push(gameInfo)
            }
          }
        } catch (error) {
          console.error(`Error getting lobby state for game ${gameData.id}:`, error)
          // Skip this game but continue with others
        }
      }

      return gameInfos
    } catch (error) {
      console.error('Error getting all active games:', error)
      return []
    }
  }

  /**
   * Get games where user is a participant (for "My Games" functionality)
   */
  static async getUserGames(userId: string): Promise<GameInfo[]> {
    try {
      // Get all active games and filter by user participation
      const allGames = await this.getAllActiveGames()
      
      const userGames: GameInfo[] = []
      
      for (const game of allGames) {
        try {
          const lobbyResult = await lobbyCommandService.getLobbyState(game.id)
          
          if (lobbyResult.success && lobbyResult.state) {
            // Check if user is a player in this game
            const userPlayer = Array.from(lobbyResult.state.players.values())
              .find(player => player.userId === userId)
            
            if (userPlayer) {
              userGames.push(game)
            }
          }
        } catch (error) {
          console.error(`Error checking user participation for game ${game.id}:`, error)
        }
      }

      return userGames.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    } catch (error) {
      console.error('Error getting user games:', error)
      return []
    }
  }
} 