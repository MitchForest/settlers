import { pgTable, uuid, text, timestamp, integer, jsonb, boolean, decimal, index, varchar } from 'drizzle-orm/pg-core'

// Games table - stores complete game state
export const games = pgTable('games', {
  id: uuid('id').defaultRandom().primaryKey(),
  
  // Game state
  state: jsonb('state').notNull().default('{}'), // Complete GameState object
  phase: text('phase').notNull().default('setup1'),
  turn: integer('turn').notNull().default(0),
  currentPlayerIndex: integer('current_player_index').notNull().default(0),
  
  // Game settings
  maxPlayers: integer('max_players').notNull().default(4),
  victoryPoints: integer('victory_points').notNull().default(10),
  
  // Status
  status: text('status').notNull().default('waiting'), // waiting, active, completed
  winner: uuid('winner'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  startedAt: timestamp('started_at'),
  endedAt: timestamp('ended_at'),
  lastActivityAt: timestamp('last_activity_at').defaultNow().notNull()
}, (table) => ({
  statusIdx: index('idx_games_status').on(table.status),
  phaseIdx: index('idx_games_phase').on(table.phase)
}))

// Players table - individual player data
export const players = pgTable('players', {
  id: uuid('id').defaultRandom().primaryKey(),
  gameId: uuid('game_id').notNull().references(() => games.id, { onDelete: 'cascade' }),
  
  // Player info
  userId: uuid('user_id'), // null for AI players
  name: text('name').notNull(),
  color: text('color').notNull(), // red, blue, green, yellow
  playerIndex: integer('player_index').notNull(), // 0-3, turn order
  
  // Resources (denormalized for queries)
  resource1: integer('resource1').notNull().default(0), // Lumber
  resource2: integer('resource2').notNull().default(0), // Wool
  resource3: integer('resource3').notNull().default(0), // Grain
  resource4: integer('resource4').notNull().default(0), // Brick
  resource5: integer('resource5').notNull().default(0), // Ore
  
  // Score
  publicScore: integer('public_score').notNull().default(0),
  hiddenScore: integer('hidden_score').notNull().default(0),
  
  // Achievements
  knightsPlayed: integer('knights_played').notNull().default(0),
  hasLongestPath: boolean('has_longest_path').notNull().default(false),
  hasLargestForce: boolean('has_largest_force').notNull().default(false),
  
  // Status
  isAI: boolean('is_ai').notNull().default(false),
  isConnected: boolean('is_connected').notNull().default(true),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastActionAt: timestamp('last_action_at')
}, (table) => ({
  gameIdx: index('idx_players_game_id').on(table.gameId),
  userIdx: index('idx_players_user_id').on(table.userId)
}))

// Game events - for history and recovery
export const gameEvents = pgTable('game_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  gameId: uuid('game_id').notNull().references(() => games.id, { onDelete: 'cascade' }),
  
  // Event data
  type: text('event_type').notNull(),
  playerId: uuid('player_id').references(() => players.id),
  data: jsonb('event_data').notNull().default('{}'),
  
  // Metadata
  turn: integer('turn').notNull(),
  phase: text('phase').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull()
}, (table) => ({
  gameIdx: index('idx_game_events_game_id').on(table.gameId),
  timestampIdx: index('idx_game_events_timestamp').on(table.timestamp)
}))

// Active trades - for real-time trading
export const trades = pgTable('trades', {
  id: uuid('id').defaultRandom().primaryKey(),
  gameId: uuid('game_id').notNull().references(() => games.id, { onDelete: 'cascade' }),
  
  // Trade participants
  fromPlayerId: uuid('from_player_id').notNull().references(() => players.id),
  toPlayerId: uuid('to_player_id'), // null for bank/port trades
  toType: text('to_type'), // 'player', 'bank', 'port'
  
  // Trade details
  offering: jsonb('offering').notNull().default('{}'), // ResourceCards
  requesting: jsonb('requesting').notNull().default('{}'), // ResourceCards
  
  // Status
  status: text('status').notNull().default('pending'), // pending, accepted, rejected, cancelled
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull()
}, (table) => ({
  gameIdx: index('idx_trades_game_id').on(table.gameId),
  statusIdx: index('idx_trades_status').on(table.status)
}))

// Users table - for authentication (simplified for now)
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  
  // User info
  email: text('email').notNull().unique(),
  username: text('username').notNull().unique(),
  avatarUrl: text('avatar_url'),
  
  // Stats
  gamesPlayed: integer('games_played').notNull().default(0),
  gamesWon: integer('games_won').notNull().default(0),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastSeenAt: timestamp('last_seen_at')
}, (table) => ({
  emailIdx: index('idx_users_email').on(table.email),
  usernameIdx: index('idx_users_username').on(table.username)
}))

// Sessions - for WebSocket connections
export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  gameId: uuid('game_id').references(() => games.id, { onDelete: 'cascade' }),
  playerId: uuid('player_id').references(() => players.id, { onDelete: 'cascade' }),
  
  // Connection info
  socketId: text('socket_id').notNull().unique(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  
  // Status
  isActive: boolean('is_active').notNull().default(true),
  
  // Timestamps
  connectedAt: timestamp('connected_at').defaultNow().notNull(),
  disconnectedAt: timestamp('disconnected_at'),
  lastPingAt: timestamp('last_ping_at').defaultNow().notNull()
}, (table) => ({
  userIdx: index('idx_sessions_user_id').on(table.userId),
  gameIdx: index('idx_sessions_game_id').on(table.gameId),
  socketIdx: index('idx_sessions_socket_id').on(table.socketId)
}))

// Type exports for use in application
export type Game = typeof games.$inferSelect
export type NewGame = typeof games.$inferInsert
export type Player = typeof players.$inferSelect
export type NewPlayer = typeof players.$inferInsert
export type GameEvent = typeof gameEvents.$inferSelect
export type NewGameEvent = typeof gameEvents.$inferInsert
export type Trade = typeof trades.$inferSelect
export type NewTrade = typeof trades.$inferInsert
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert 