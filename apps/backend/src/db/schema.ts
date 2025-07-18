import { pgTable, unique, pgEnum, text, integer, uuid, boolean, json, timestamp, foreignKey, index, varchar, primaryKey, bigint, pgPolicy, check } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { authenticatedRole, authUid } from "drizzle-orm/supabase"

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

// Friend-specific event types that operate on friend relationships
export const friendEventType = pgEnum("friend_event_type", [
  'friend_request_sent',
  'friend_request_accepted', 
  'friend_request_rejected',
  'friend_request_cancelled',
  'friend_removed',
  'presence_updated'
])

// Game invite event types that operate on game invitations
export const gameInviteEventType = pgEnum("game_invite_event_type", [
  'game_invite_sent',
  'game_invite_accepted',
  'game_invite_declined',
  'game_invite_expired',
  'game_invite_cancelled'
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

// Legacy enums removed - now using event-sourced architecture

// **CORE TABLES**

// User profiles table with RLS policies
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
  
  // RLS Policies
  // Allow authenticated users to view all profiles
  viewAllProfilesPolicy: pgPolicy("authenticated_can_view_all_profiles", {
    for: "select",
    to: authenticatedRole,
    using: sql`true`,
  }),
  
  // Allow authenticated users to insert their own profile
  insertOwnProfilePolicy: pgPolicy("authenticated_can_insert_own_profile", {
    for: "insert", 
    to: authenticatedRole,
    withCheck: sql`(select auth.uid()) = ${table.id}`,
  }),
  
  // Allow authenticated users to update their own profile
  updateOwnProfilePolicy: pgPolicy("authenticated_can_update_own_profile", {
    for: "update",
    to: authenticatedRole,
    using: sql`(select auth.uid()) = ${table.id}`,
    withCheck: sql`(select auth.uid()) = ${table.id}`,
  }),
  
  // Allow authenticated users to delete their own profile  
  deleteOwnProfilePolicy: pgPolicy("authenticated_can_delete_own_profile", {
    for: "delete",
    to: authenticatedRole,
    using: sql`(select auth.uid()) = ${table.id}`,
  }),
}))

// **LEGACY CRUD TABLES REMOVED FOR EVENT-SOURCED ARCHITECTURE**
//
// The following tables have been ELIMINATED to achieve 100% architectural consistency:
// - friendRequests (replaced by friendEvents with 'friend_request_sent', 'friend_request_accepted' etc.)
// - friendships (replaced by friendEvents projector reconstructing current friendships)
// - userPresence (replaced by friendEvents with 'presence_updated' type)
// - gameInvites (replaced by gameInviteEvents with 'game_invite_sent', 'game_invite_accepted' etc.)
//
// ALL social features now use event-sourced architecture with command services:
// - FriendsCommandService + FriendsProjector for friend relationships
// - GameInviteCommandService + GameInviteProjector for game invitations
//
// This eliminates technical debt and ensures architectural consistency with games domain.

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
  contextPlayerId: text("context_player_id").references(() => players.id, { onDelete: "set null" }), // Optional context
}, (table) => ({
  gameSequenceIdx: index("game_events_game_sequence_idx").on(table.gameId, table.sequenceNumber),
  gameTypeIdx: index("game_events_game_type_idx").on(table.gameId, table.eventType),
  timestampIdx: index("game_events_timestamp_idx").on(table.timestamp),
  contextPlayerIdx: index("game_events_context_player_idx").on(table.contextPlayerId),
  // Ensure sequence numbers are unique within a game across ALL event types
  gameSequenceUnique: unique().on(table.gameId, table.sequenceNumber),
}))

// Sequence tracking table for unified sequence numbers across event types
export const gameEventSequences = pgTable("game_event_sequences", {
  gameId: text("game_id").primaryKey().references(() => games.id, { onDelete: "cascade" }),
  nextSequence: bigint("next_sequence", { mode: "number" }).notNull().default(1),
})

// Friend events - operate on friend relationships, user-scoped event sourcing
export const friendEvents = pgTable("friend_events", {
  id: text("id").primaryKey(),
  aggregateId: uuid("aggregate_id").notNull(), // userId who initiated the action
  eventType: friendEventType("event_type").notNull(),
  data: json("data").notNull(),
  sequenceNumber: bigint("sequence_number", { mode: "number" }).notNull(),
  timestamp: timestamp("timestamp", { precision: 3, mode: 'string' }).defaultNow().notNull(),
}, (table) => ({
  aggregateSequenceIdx: index("friend_events_aggregate_sequence_idx").on(table.aggregateId, table.sequenceNumber),
  aggregateTypeIdx: index("friend_events_aggregate_type_idx").on(table.aggregateId, table.eventType),
  timestampIdx: index("friend_events_timestamp_idx").on(table.timestamp),
  // Ensure sequence numbers are unique within an aggregate (user)
  aggregateSequenceUnique: unique().on(table.aggregateId, table.sequenceNumber),
}))

// Friend event sequences - separate from game sequences since friends are user-scoped
export const friendEventSequences = pgTable("friend_event_sequences", {
  aggregateId: uuid("aggregate_id").primaryKey(), // userId
  nextSequence: bigint("next_sequence", { mode: "number" }).notNull().default(1),
})

// Game invite events - operate on game invitations, user-scoped event sourcing
export const gameInviteEvents = pgTable("game_invite_events", {
  id: text("id").primaryKey(),
  aggregateId: uuid("aggregate_id").notNull(), // userId who received the invite (target user)
  eventType: gameInviteEventType("event_type").notNull(),
  data: json("data").notNull(),
  sequenceNumber: bigint("sequence_number", { mode: "number" }).notNull(),
  timestamp: timestamp("timestamp", { precision: 3, mode: 'string' }).defaultNow().notNull(),
}, (table) => ({
  aggregateSequenceIdx: index("invite_events_aggregate_sequence_idx").on(table.aggregateId, table.sequenceNumber),
  aggregateTypeIdx: index("invite_events_aggregate_type_idx").on(table.aggregateId, table.eventType),
  timestampIdx: index("invite_events_timestamp_idx").on(table.timestamp),
  // Ensure sequence numbers are unique within an aggregate (user)
  aggregateSequenceUnique: unique().on(table.aggregateId, table.sequenceNumber),
}))

// Game invite event sequences - separate sequences for invite events per user
export const gameInviteEventSequences = pgTable("game_invite_event_sequences", {
  aggregateId: uuid("aggregate_id").primaryKey(), // userId
  nextSequence: bigint("next_sequence", { mode: "number" }).notNull().default(1),
})

// Game observers table for tracking who's watching games
export const gameObservers = pgTable("game_observers", {
  id: text("id").primaryKey(),
  gameId: text("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  joinedAt: timestamp("joined_at", { precision: 3, mode: 'string' }).defaultNow().notNull(),
  leftAt: timestamp("left_at", { precision: 3, mode: 'string' }),
}, (table) => ({
  gameUserUnique: unique().on(table.gameId, table.userId),
  gameObserverIdx: index("game_observers_game_idx").on(table.gameId),
  userObserverIdx: index("game_observers_user_idx").on(table.userId),
}))

// **INFERRED TYPES FOR TYPESCRIPT**

// NewGame and NewPlayer types for inserts
export type NewGame = typeof games.$inferInsert
export type NewPlayer = typeof players.$inferInsert
 