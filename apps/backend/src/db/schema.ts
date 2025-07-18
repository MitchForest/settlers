import { pgTable, unique, pgEnum, text, integer, uuid, boolean, json, timestamp, foreignKey, index, varchar, primaryKey, bigint } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

// **SEGREGATED EVENT TYPES FOR PROPER DOMAIN SEPARATION**

// Player-specific event types that MUST have valid player references
export const playerEventType = pgEnum("player_event_type", [
  'player_joined',
  'player_left', 
  'ai_player_added',
  'ai_player_removed'
])

// Game-system event types that operate on game state, not specific players
export const gameEventType = pgEnum("game_event_type", [
  'game_started',
  'settings_changed',
  'dice_rolled',
  'resource_produced',
  'building_placed',
  'road_placed',
  'card_drawn',
  'card_played',
  'trade_proposed',
  'trade_accepted',
  'trade_declined',
  'robber_moved',
  'resources_stolen',
  'turn_ended',
  'game_ended'
])

// Player types for distinguishing human vs AI players
export const playerType = pgEnum("player_type", ['human', 'ai'])

// Game phases for better state management
export const gamePhase = pgEnum("game_phase", [
  'lobby',
  'initial_placement', 
  'main_game',
  'ended'
])

// Enhanced terrain types
export const terrainType = pgEnum("terrain_type", [
  'forest',    // Produces wood
  'hills',     // Produces brick  
  'mountains', // Produces ore
  'fields',    // Produces wheat
  'pasture',   // Produces sheep
  'desert'     // Non-producing terrain with robber
])

// Resource types
export const resourceType = pgEnum("resource_type", [
  'wood',
  'brick', 
  'ore',
  'wheat',
  'sheep'
])

// Building types
export const buildingType = pgEnum("building_type", [
  'settlement',
  'city'
])

// Development card types
export const developmentCardType = pgEnum("development_card_type", [
  'knight',
  'victory_point',
  'road_building', 
  'year_of_plenty',
  'monopoly'
])

// Trade status for tracking trade proposals
export const tradeStatus = pgEnum("trade_status", [
  'pending',
  'accepted',
  'declined',
  'expired'
])

// Trade type for different kinds of trades
export const tradeType = pgEnum("trade_type", [
  'player_to_player',
  'player_to_bank',
  'harbor_trade'
])

// **CORE TABLES**

// User profiles table
export const userProfiles = pgTable("user_profiles", {
  id: uuid("id").primaryKey(), // References auth.users(id)
  email: text("email").notNull(),
  name: text("name").notNull(),
  avatarEmoji: text("avatar_emoji"),
  createdAt: timestamp("created_at", { precision: 3, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { precision: 3, mode: 'string' }).defaultNow().notNull(),
}, (table) => ({
  emailUnique: unique().on(table.email),
  emailIdx: index("user_profiles_email_idx").on(table.email),
}))

// Core games table - minimal state, events provide the truth
export const games = pgTable("games", {
  id: text("id").primaryKey(),
  gameCode: varchar("game_code", { length: 10 }).notNull(),
  createdAt: timestamp("created_at", { precision: 3, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { precision: 3, mode: 'string' }).defaultNow().notNull(),
  currentPhase: gamePhase("current_phase").default('lobby').notNull(),
  currentPlayerId: text("current_player_id"), // Can be null during lobby phase
  isActive: boolean("is_active").default(true).notNull(),
  endedAt: timestamp("ended_at", { precision: 3, mode: 'string' }),
  winnerId: text("winner_id"),
  // Remove all JSON state fields - events are the source of truth
}, (table) => ({
  gameCodeUnique: unique().on(table.gameCode),
  gameCodeIdx: index("games_game_code_idx").on(table.gameCode),
  phaseIdx: index("games_phase_idx").on(table.currentPhase),
  activeIdx: index("games_active_idx").on(table.isActive),
}))

// Players table - core player info
export const players = pgTable("players", {
  id: text("id").primaryKey(),
  gameId: text("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => userProfiles.id, { onDelete: "set null" }),
  playerType: playerType("player_type").notNull(),
  name: text("name").notNull(),
  avatarEmoji: text("avatar_emoji"),
  color: text("color").notNull(),
  joinOrder: integer("join_order").notNull(),
  isHost: boolean("is_host").default(false).notNull(),
  joinedAt: timestamp("joined_at", { precision: 3, mode: 'string' }).defaultNow().notNull(),
  leftAt: timestamp("left_at", { precision: 3, mode: 'string' }),
}, (table) => ({
  gamePlayerIdx: index("players_game_player_idx").on(table.gameId, table.id),
  gameJoinOrderUnique: unique().on(table.gameId, table.joinOrder),
  gameColorUnique: unique().on(table.gameId, table.color),
}))

// **SEGREGATED EVENT TABLES FOR PROPER REFERENTIAL INTEGRITY**

// Player events - MUST reference valid players, enforced by NOT NULL constraint
export const playerEvents = pgTable("player_events", {
  id: text("id").primaryKey(),
  gameId: text("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
  playerId: text("player_id").notNull().references(() => players.id, { onDelete: "cascade" }), // NOT NULL - must be valid
  eventType: playerEventType("event_type").notNull(),
  data: json("data").notNull(),
  sequenceNumber: bigint("sequence_number", { mode: "number" }).notNull(),
  timestamp: timestamp("timestamp", { precision: 3, mode: 'string' }).defaultNow().notNull(),
}, (table) => ({
  gameSequenceIdx: index("player_events_game_sequence_idx").on(table.gameId, table.sequenceNumber),
  gameTypeIdx: index("player_events_game_type_idx").on(table.gameId, table.eventType),
  playerIdx: index("player_events_player_idx").on(table.playerId),
  timestampIdx: index("player_events_timestamp_idx").on(table.timestamp),
  // Ensure sequence numbers are unique within a game across ALL event types
  gameSequenceUnique: unique().on(table.gameId, table.sequenceNumber),
}))

// Game events - system events that don't reference players directly
export const gameEvents = pgTable("game_events", {
  id: text("id").primaryKey(),
  gameId: text("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
  eventType: gameEventType("event_type").notNull(),
  data: json("data").notNull(),
  sequenceNumber: bigint("sequence_number", { mode: "number" }).notNull(),
  timestamp: timestamp("timestamp", { precision: 3, mode: 'string' }).defaultNow().notNull(),
  // Optional player context for game events (e.g., "dice_rolled" by specific player)
  contextPlayerId: text("context_player_id").references(() => players.id, { onDelete: "set null" }),
}, (table) => ({
  gameSequenceIdx: index("game_events_game_sequence_idx").on(table.gameId, table.sequenceNumber),
  gameTypeIdx: index("game_events_game_type_idx").on(table.gameId, table.eventType),
  timestampIdx: index("game_events_timestamp_idx").on(table.timestamp),
  contextPlayerIdx: index("game_events_context_player_idx").on(table.contextPlayerId),
  // Ensure sequence numbers are unique within a game across ALL event types
  gameSequenceUnique: unique().on(table.gameId, table.sequenceNumber),
}))

// Unified sequence tracking for both event types (ensures global ordering)
export const gameEventSequences = pgTable("game_event_sequences", {
  gameId: text("game_id").primaryKey().references(() => games.id, { onDelete: "cascade" }),
  nextSequence: bigint("next_sequence", { mode: "number" }).notNull().default(1),
})

// Game observers table (for spectators)
export const gameObservers = pgTable("game_observers", {
  id: text("id").primaryKey(),
  gameId: text("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  joinedAt: timestamp("joined_at", { precision: 3, mode: 'string' }).defaultNow().notNull(),
  leftAt: timestamp("left_at", { precision: 3, mode: 'string' }),
}, (table) => ({
  gameUserUnique: unique().on(table.gameId, table.userId),
  gameObserverIdx: index("game_observers_game_idx").on(table.gameId),
}))

// **TYPE EXPORTS**

export type Game = typeof games.$inferSelect
export type NewGame = typeof games.$inferInsert
export type Player = typeof players.$inferSelect
export type NewPlayer = typeof players.$inferInsert
export type PlayerEvent = typeof playerEvents.$inferSelect
export type NewPlayerEvent = typeof playerEvents.$inferInsert
export type GameEvent = typeof gameEvents.$inferSelect
export type NewGameEvent = typeof gameEvents.$inferInsert
export type UserProfile = typeof userProfiles.$inferSelect
export type NewUserProfile = typeof userProfiles.$inferInsert
export type GameObserver = typeof gameObservers.$inferSelect
export type NewGameObserver = typeof gameObservers.$inferInsert
export type GameEventSequence = typeof gameEventSequences.$inferSelect
export type NewGameEventSequence = typeof gameEventSequences.$inferInsert
 