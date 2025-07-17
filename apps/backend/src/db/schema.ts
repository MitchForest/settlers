import { pgTable, text, integer, timestamp, json, boolean, pgEnum, primaryKey, unique, uuid, varchar } from 'drizzle-orm/pg-core'

// Settlers terrain types enum
export const terrainTypeEnum = pgEnum('terrain_type', [
  'forest',    // Produces wood
  'hills',     // Produces brick
  'mountains', // Produces ore
  'fields',    // Produces wheat
  'pasture',   // Produces sheep
  'desert'     // Non-producing terrain with robber
])

// Settlers resource types enum
export const resourceTypeEnum = pgEnum('resource_type', [
  'wood',
  'brick',
  'ore',
  'wheat',
  'sheep'
])

// Settlers building types enum
export const buildingTypeEnum = pgEnum('building_type', [
  'settlement',
  'city'
])



// Game phase enum
export const gamePhaseEnum = pgEnum('game_phase', [
  'setup1',      // First settlement + road
  'setup2',      // Second settlement + road (reverse order)
  'roll',        // Roll dice
  'actions',     // Trade, build, play cards
  'discard',     // Discard half when 7 rolled
  'moveRobber',  // Move robber
  'steal',       // Steal resource
  'ended'        // Game over
])

// Development card types
export const developmentCardTypeEnum = pgEnum('development_card_type', [
  'knight',
  'victory',
  'roadBuilding',
  'yearOfPlenty',
  'monopoly'
])

// Trade status enum
export const tradeStatusEnum = pgEnum('trade_status', [
  'pending',
  'accepted', 
  'rejected',
  'cancelled',
  'expired'
])

// Trade type enum
export const tradeTypeEnum = pgEnum('trade_type', [
  'bank',
  'port', 
  'player'
])

// AI personality enum  
export const aiPersonalityEnum = pgEnum('ai_personality', [
  'aggressive',
  'balanced', 
  'defensive',
  'economic'
])

// AI difficulty enum
export const aiDifficultyEnum = pgEnum('ai_difficulty', [
  'easy',
  'medium',
  'hard'
])

// User profiles table - linked to Supabase auth.users
export const userProfiles = pgTable('user_profiles', {
  id: uuid('id').primaryKey(), // References auth.users(id)
  username: varchar('username', { length: 20 }).unique().notNull(),
  avatarEmoji: varchar('avatar_emoji', { length: 10 }).notNull().default('🧙‍♂️'),
  displayName: varchar('display_name', { length: 50 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  
  // Game statistics
  gamesPlayed: integer('games_played').notNull().default(0),
  gamesWon: integer('games_won').notNull().default(0),
  totalScore: integer('total_score').notNull().default(0),
  longestRoadRecord: integer('longest_road_record').notNull().default(0),
  largestArmyRecord: integer('largest_army_record').notNull().default(0),
  
  // Profile settings
  isPublic: boolean('is_public').notNull().default(true),
  preferredPlayerCount: integer('preferred_player_count').notNull().default(4)
})

// Games table - updated to support lobby/game separation
export const games = pgTable('games', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  status: text('status').notNull().default('lobby'), // lobby, playing, ended
  
  // Game code for joining games
  gameCode: text('game_code').unique(),
  hostPlayerId: text('host_player_id'),
  hostUserId: uuid('host_user_id'), // Reference to auth.users(id)
  
  // Observer and visibility settings
  allowObservers: boolean('allow_observers').notNull().default(true),
  isPublic: boolean('is_public').notNull().default(true),
  maxObservers: integer('max_observers').notNull().default(4),
  
  // Separate state storage - only one will be populated at a time
  lobbyState: json('lobby_state').$type<any>(), // Populated when status = 'lobby'
  gameState: json('game_state').$type<any>(),   // Populated when status = 'playing'
  
  // Game-specific fields (only used when status = 'playing')
  phase: gamePhaseEnum('phase'),
  currentPlayer: text('current_player'),
  turn: integer('turn').default(0),
  winner: text('winner'),
  
  settings: json('settings').$type<{
    victoryPoints: number
    boardLayout: string
    randomizePlayerOrder: boolean
    randomizeTerrain: boolean
    randomizeNumbers: boolean
  }>(),
  
  startedAt: timestamp('started_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
})

// Players table
export const players = pgTable('players', {
  id: text('id').primaryKey(),
  gameId: text('game_id').notNull().references(() => games.id, { onDelete: 'cascade' }),
  userId: uuid('user_id'), // Reference to auth.users(id), null for AI players
  avatarEmoji: varchar('avatar_emoji').default('🧙‍♂️'), // Avatar emoji for the player
  name: text('name').notNull(),
  color: integer('color'), // 0-3 for player colors (nullable for lobby phase)
  isHost: boolean('is_host').notNull().default(false),
  isAI: boolean('is_ai').notNull().default(false),
  isConnected: boolean('is_connected').notNull().default(false),
  joinedAt: timestamp('joined_at').notNull().defaultNow(), // When player joined lobby
  
  // AI Configuration
  aiPersonality: aiPersonalityEnum('ai_personality'),
  aiDifficulty: aiDifficultyEnum('ai_difficulty'),
  aiIsAutoMode: boolean('ai_is_auto_mode').default(false), // True if player requested auto-mode
  aiIsDisconnected: boolean('ai_is_disconnected').default(false), // True if AI covering disconnection
  aiThinkingTimeMs: integer('ai_thinking_time_ms').default(2000),
  aiMaxActionsPerTurn: integer('ai_max_actions_per_turn').default(15),
  aiEnableLogging: boolean('ai_enable_logging').default(true),
  score: json('score').notNull().$type<{
    public: number
    hidden: number
    total: number
  }>().default({ public: 0, hidden: 0, total: 0 }),
  resources: json('resources').notNull().$type<{
    wood: number
    brick: number
    sheep: number
    wheat: number
    ore: number
  }>().default({
    wood: 0,
    brick: 0,
    sheep: 0,
    wheat: 0,
    ore: 0
  }),
  buildings: json('buildings').notNull().$type<{
    settlements: number
    cities: number
    roads: number
  }>().default({
    settlements: 5,
    cities: 4,
    roads: 15
  }),
  knightsPlayed: integer('knights_played').notNull().default(0),
  hasLongestRoad: boolean('has_longest_road').notNull().default(false),
  hasLargestArmy: boolean('has_largest_army').notNull().default(false)
})

// Development cards table
export const developmentCards = pgTable('development_cards', {
  id: text('id').primaryKey(),
  gameId: text('game_id').notNull().references(() => games.id, { onDelete: 'cascade' }),
  playerId: text('player_id').references(() => players.id, { onDelete: 'cascade' }),
  type: developmentCardTypeEnum('type').notNull(),
  purchasedTurn: integer('purchased_turn').notNull(),
  playedTurn: integer('played_turn'),
  createdAt: timestamp('created_at').notNull().defaultNow()
})

// Buildings table (placed on board)
export const placedBuildings = pgTable('placed_buildings', {
  id: text('id').primaryKey(),
  gameId: text('game_id').notNull().references(() => games.id, { onDelete: 'cascade' }),
  playerId: text('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  type: buildingTypeEnum('type').notNull(),
  position: json('position').notNull().$type<{
    hexes: Array<{ q: number, r: number, s: number }>
    direction: 'N' | 'NE' | 'SE' | 'S' | 'SW' | 'NW'
  }>(),
  placedAt: timestamp('placed_at').notNull().defaultNow()
})

// Roads table (placed on board)
export const placedRoads = pgTable('placed_roads', {
  id: text('id').primaryKey(),
  gameId: text('game_id').notNull().references(() => games.id, { onDelete: 'cascade' }),
  playerId: text('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  type: text('type').notNull().default('road'),
  position: json('position').notNull().$type<{
    hexes: [{ q: number, r: number, s: number }, { q: number, r: number, s: number }]
    direction: 'N' | 'NE' | 'SE'
  }>(),
  placedAt: timestamp('placed_at').notNull().defaultNow()
})

// Enhanced trades table to support full trading system
export const trades = pgTable('trades', {
  id: text('id').primaryKey(),
  gameId: text('game_id').notNull().references(() => games.id, { onDelete: 'cascade' }),
  type: tradeTypeEnum('type').notNull(), // Use proper enum
  initiator: text('initiator').notNull().references(() => players.id, { onDelete: 'cascade' }),
  target: text('target').references(() => players.id, { onDelete: 'cascade' }), // null for bank/port trades
  offering: json('offering').notNull().$type<{
    wood?: number
    brick?: number
    ore?: number
    wheat?: number
    sheep?: number
  }>(),
  requesting: json('requesting').notNull().$type<{
    wood?: number
    brick?: number
    ore?: number
    wheat?: number
    sheep?: number
  }>(),
  status: tradeStatusEnum('status').notNull().default('pending'), // Use proper enum
  ratio: integer('ratio'), // For bank/port trades (2:1, 3:1, 4:1)
  portType: text('port_type').$type<'generic' | 'wood' | 'brick' | 'ore' | 'wheat' | 'sheep'>(), // For port trades
  isOpenOffer: boolean('is_open_offer').default(false), // true if any player can accept
  createdAt: timestamp('created_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at'), // For player trades with timers
  resolvedAt: timestamp('resolved_at')
})

// Game events table for audit/replay
export const gameEvents = pgTable('game_events', {
  id: text('id').primaryKey(),
  gameId: text('game_id').notNull().references(() => games.id, { onDelete: 'cascade' }),
  playerId: text('player_id').references(() => players.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  data: json('data').notNull(),
  timestamp: timestamp('timestamp').notNull().defaultNow()
})

// AI Stats table - tracks AI performance metrics
export const aiStats = pgTable('ai_stats', {
  id: text('id').primaryKey(),
  gameId: text('game_id').notNull().references(() => games.id, { onDelete: 'cascade' }),
  playerId: text('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  turnsPlayed: integer('turns_played').notNull().default(0),
  actionsExecuted: integer('actions_executed').notNull().default(0),
  successfulActions: integer('successful_actions').notNull().default(0),
  failedActions: integer('failed_actions').notNull().default(0),
  averageDecisionTimeMs: integer('average_decision_time_ms').notNull().default(0),
  setupTurns: integer('setup_turns').notNull().default(0),
  regularTurns: integer('regular_turns').notNull().default(0),
  specialActionTurns: integer('special_action_turns').notNull().default(0),
  buildingActions: integer('building_actions').notNull().default(0),
  tradeActions: integer('trade_actions').notNull().default(0),
  cardActions: integer('card_actions').notNull().default(0),
  robberActions: integer('robber_actions').notNull().default(0),
  finalScore: integer('final_score').default(0),
  gameWon: boolean('game_won').default(false),
  gamePosition: integer('game_position'),
  aiStartedAt: timestamp('ai_started_at').notNull().defaultNow(),
  aiEndedAt: timestamp('ai_ended_at'),
  lastActionAt: timestamp('last_action_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
})

// Player-game relationship (for multi-table queries)
export const gamePlayersRelation = pgTable('game_players', {
  gameId: text('game_id').notNull().references(() => games.id, { onDelete: 'cascade' }),
  playerId: text('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  position: integer('position').notNull() // Turn order position
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.gameId, table.playerId] })
  }
})

// Game observers table - tracks users observing games
export const gameObservers = pgTable('game_observers', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  gameId: text('game_id').notNull().references(() => games.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull(), // Reference to auth.users(id)
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
}, (table) => {
  return {
    // Ensure unique observer per game
    uniqueGameObserver: unique().on(table.gameId, table.userId)
  }
}) 