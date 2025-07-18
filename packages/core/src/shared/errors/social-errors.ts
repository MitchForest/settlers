// ===== SOCIAL DOMAIN ERROR CLASSES =====
// Errors for friends, invites, and social interactions

import { DomainError, ErrorContextBuilder } from './domain-error'

/**
 * Base class for all social domain errors
 */
export abstract class SocialError extends DomainError {
  readonly domain = 'social'
}

/**
 * Friend Management Errors
 */
export class FriendError extends SocialError {
  readonly code = 'FRIEND_ERROR'
  
  static friendRequestAlreadyExists(fromUserId: string, toUserId: string): FriendError {
    return new FriendError(
      `Friend request already exists between ${fromUserId} and ${toUserId}`,
      new ErrorContextBuilder()
        .addStateContext('friend_request_validation', { fromUserId, toUserId })
        .build()
    )
  }
  
  static friendshipAlreadyExists(userId1: string, userId2: string): FriendError {
    return new FriendError(
      `Friendship already exists between ${userId1} and ${userId2}`,
      new ErrorContextBuilder()
        .addStateContext('friendship_validation', { userId1, userId2 })
        .build()
    )
  }
  
  static cannotSendFriendRequestToSelf(userId: string): FriendError {
    return new FriendError(
      `Cannot send friend request to yourself`,
      new ErrorContextBuilder()
        .addStateContext('self_friend_validation', { userId })
        .build()
    )
  }
  
  static friendRequestNotFound(fromUserId: string, toUserId: string): FriendError {
    return new FriendError(
      `Friend request not found between ${fromUserId} and ${toUserId}`,
      new ErrorContextBuilder()
        .addStateContext('friend_request_lookup', { fromUserId, toUserId })
        .build()
    )
  }
  
  static friendshipNotFound(userId1: string, userId2: string): FriendError {
    return new FriendError(
      `Friendship not found between ${userId1} and ${userId2}`,
      new ErrorContextBuilder()
        .addStateContext('friendship_lookup', { userId1, userId2 })
        .build()
    )
  }
  
  static cannotAcceptOwnFriendRequest(userId: string): FriendError {
    return new FriendError(
      `Cannot accept your own friend request`,
      new ErrorContextBuilder()
        .addStateContext('friend_request_acceptance', { userId })
        .build()
    )
  }
  
  static userNotFound(userId: string): FriendError {
    return new FriendError(
      `User ${userId} not found`,
      new ErrorContextBuilder()
        .addStateContext('user_lookup', { userId })
        .build()
    )
  }
}

/**
 * Game Invitation Errors
 */
export class GameInviteError extends SocialError {
  readonly code = 'GAME_INVITE_ERROR'
  
  static inviteAlreadyExists(gameId: string, fromUserId: string, toUserId: string): GameInviteError {
    return new GameInviteError(
      `Game invite already exists for game ${gameId} from ${fromUserId} to ${toUserId}`,
      new ErrorContextBuilder()
        .addGameContext(gameId)
        .addStateContext('invite_validation', { fromUserId, toUserId })
        .build()
    )
  }
  
  static cannotInviteSelf(gameId: string, userId: string): GameInviteError {
    return new GameInviteError(
      `Cannot invite yourself to game ${gameId}`,
      new ErrorContextBuilder()
        .addGameContext(gameId)
        .addStateContext('self_invite_validation', { userId })
        .build()
    )
  }
  
  static gameNotFound(gameId: string): GameInviteError {
    return new GameInviteError(
      `Game ${gameId} not found`,
      new ErrorContextBuilder()
        .addGameContext(gameId)
        .addStateContext('game_lookup', { gameId })
        .build()
    )
  }
  
  static inviteNotFound(gameId: string, fromUserId: string, toUserId: string): GameInviteError {
    return new GameInviteError(
      `Game invite not found for game ${gameId} from ${fromUserId} to ${toUserId}`,
      new ErrorContextBuilder()
        .addGameContext(gameId)
        .addStateContext('invite_lookup', { fromUserId, toUserId })
        .build()
    )
  }
  
  static inviteExpired(gameId: string, inviteId: string, expiresAt: Date): GameInviteError {
    return new GameInviteError(
      `Game invite ${inviteId} expired at ${expiresAt.toISOString()}`,
      new ErrorContextBuilder()
        .addGameContext(gameId)
        .addStateContext('invite_expiration', { inviteId, expiresAt })
        .build()
    )
  }
  
  static gameAlreadyStarted(gameId: string): GameInviteError {
    return new GameInviteError(
      `Cannot accept invite - game ${gameId} has already started`,
      new ErrorContextBuilder()
        .addGameContext(gameId)
        .addStateContext('game_state_validation', { gameId })
        .build()
    )
  }
  
  static gameFull(gameId: string, maxPlayers: number): GameInviteError {
    return new GameInviteError(
      `Cannot accept invite - game ${gameId} is full (${maxPlayers} players)`,
      new ErrorContextBuilder()
        .addGameContext(gameId)
        .addStateContext('game_capacity_validation', { gameId, maxPlayers })
        .build()
    )
  }
  
  static cannotAcceptOwnInvite(gameId: string, userId: string): GameInviteError {
    return new GameInviteError(
      `Cannot accept your own invite to game ${gameId}`,
      new ErrorContextBuilder()
        .addGameContext(gameId)
        .addStateContext('invite_acceptance', { userId })
        .build()
    )
  }
}

/**
 * Lobby Management Errors
 */
export class LobbyError extends SocialError {
  readonly code = 'LOBBY_ERROR'
  
  static lobbyNotFound(lobbyId: string): LobbyError {
    return new LobbyError(
      `Lobby ${lobbyId} not found`,
      new ErrorContextBuilder()
        .addStateContext('lobby_lookup', { lobbyId })
        .build()
    )
  }
  
  static lobbyFull(lobbyId: string, maxPlayers: number): LobbyError {
    return new LobbyError(
      `Lobby ${lobbyId} is full (${maxPlayers} players)`,
      new ErrorContextBuilder()
        .addStateContext('lobby_capacity', { lobbyId, maxPlayers })
        .build()
    )
  }
  
  static playerNotInLobby(lobbyId: string, playerId: string): LobbyError {
    return new LobbyError(
      `Player ${playerId} is not in lobby ${lobbyId}`,
      new ErrorContextBuilder()
        .addStateContext('lobby_membership', { lobbyId, playerId })
        .build()
    )
  }
  
  static playerAlreadyInLobby(lobbyId: string, playerId: string): LobbyError {
    return new LobbyError(
      `Player ${playerId} is already in lobby ${lobbyId}`,
      new ErrorContextBuilder()
        .addStateContext('lobby_membership', { lobbyId, playerId })
        .build()
    )
  }
  
  static onlyHostCanStartGame(lobbyId: string, playerId: string, hostId: string): LobbyError {
    return new LobbyError(
      `Only host ${hostId} can start game in lobby ${lobbyId}`,
      new ErrorContextBuilder()
        .addStateContext('lobby_permissions', { lobbyId, playerId, hostId })
        .build()
    )
  }
  
  static insufficientPlayersToStart(lobbyId: string, playerCount: number, minPlayers: number): LobbyError {
    return new LobbyError(
      `Need at least ${minPlayers} players to start game (current: ${playerCount})`,
      new ErrorContextBuilder()
        .addStateContext('lobby_player_count', { lobbyId, playerCount, minPlayers })
        .build()
    )
  }
}

/**
 * Presence and Status Errors
 */
export class PresenceError extends SocialError {
  readonly code = 'PRESENCE_ERROR'
  
  static invalidPresenceStatus(userId: string, status: string, validStatuses: string[]): PresenceError {
    return new PresenceError(
      `Invalid presence status ${status} for user ${userId}`,
      new ErrorContextBuilder()
        .addStateContext('presence_validation', { userId, status, validStatuses })
        .build()
    )
  }
  
  static presenceUpdateFailed(userId: string, status: string, error: string): PresenceError {
    return new PresenceError(
      `Failed to update presence for user ${userId}: ${error}`,
      new ErrorContextBuilder()
        .addStateContext('presence_update', { userId, status, error })
        .build()
    )
  }
  
  static presenceNotFound(userId: string): PresenceError {
    return new PresenceError(
      `Presence not found for user ${userId}`,
      new ErrorContextBuilder()
        .addStateContext('presence_lookup', { userId })
        .build()
    )
  }
}

// All error classes are already exported via their class declarations