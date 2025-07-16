import { pgTable, text, integer, timestamp, json, boolean, pgEnum, primaryKey } from 'drizzle-orm/pg-core'

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

// Games table
export const games = pgTable('games', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  status: text('status').notNull().default('waiting'), // waiting, playing, ended
  phase: gamePhaseEnum('phase').notNull().default('setup1'),
  currentPlayer: text('current_player').notNull(), // Changed from currentPlayerIndex to currentPlayer
  turn: integer('turn').notNull().default(0),
  
  // Game state data stored as JSON - flexible structure for complete GameState serialization
  gameState: json('game_state').notNull().$type<any>(),
  
  settings: json('settings').notNull().$type<{
    victoryPoints: number
    boardLayout: string
    randomizePlayerOrder: boolean
    randomizeTerrain: boolean
    randomizeNumbers: boolean
  }>(),
  
  winner: text('winner'),
  startedAt: timestamp('started_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
})

// Players table
export const players = pgTable('players', {
  id: text('id').primaryKey(),
  gameId: text('game_id').notNull().references(() => games.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  color: integer('color').notNull(), // 0-3 for player colors
  isHost: boolean('is_host').notNull().default(false),
  isAI: boolean('is_ai').notNull().default(false),
  isConnected: boolean('is_connected').notNull().default(false),
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
  hasLargestArmy: boolean('has_largest_army').notNull().default(false),
  joinedAt: timestamp('joined_at').notNull().defaultNow()
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