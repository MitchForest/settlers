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

// Friend request status
export const friendRequestStatus = pgEnum("friend_request_status", [
  'pending',
  'accepted', 
  'rejected',
  'cancelled'
])

// User presence status
export const presenceStatus = pgEnum("presence_status", [
  'online',
  'away', 
  'busy',
  'offline'
])

// Game invite status
export const gameInviteStatus = pgEnum("game_invite_status", [
  'pending',
  'accepted',
  'declined',
  'expired'
])

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

// **FRIENDS SYSTEM TABLES**

// Friend requests table
export const friendRequests = pgTable("friend_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  fromUserId: uuid("from_user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  toUserId: uuid("to_user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  status: friendRequestStatus("status").default('pending').notNull(),
  message: text("message"), // Optional message with friend request
  createdAt: timestamp("created_at", { precision: 3, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { precision: 3, mode: 'string' }).defaultNow().notNull(),
  respondedAt: timestamp("responded_at", { precision: 3, mode: 'string' }),
}, (table) => ({
  // Indexes
  fromUserIdx: index("friend_requests_from_user_idx").on(table.fromUserId),
  toUserIdx: index("friend_requests_to_user_idx").on(table.toUserId),
  statusIdx: index("friend_requests_status_idx").on(table.status),
  createdAtIdx: index("friend_requests_created_at_idx").on(table.createdAt),
  
  // Constraints
  // Prevent duplicate requests between same users
  uniqueRequest: unique("friend_requests_unique").on(table.fromUserId, table.toUserId),
  // Prevent self-friend requests
  noSelfRequest: check("no_self_friend_request", sql`${table.fromUserId} != ${table.toUserId}`),
  
  // RLS Policies
  // Users can view requests they sent or received
  viewOwnRequestsPolicy: pgPolicy("users_can_view_own_friend_requests", {
    for: "select",
    to: authenticatedRole,
    using: sql`(select auth.uid()) IN (${table.fromUserId}, ${table.toUserId})`,
  }),
  
  // Users can create requests (as sender)
  createRequestPolicy: pgPolicy("users_can_create_friend_requests", {
    for: "insert",
    to: authenticatedRole,
    withCheck: sql`(select auth.uid()) = ${table.fromUserId}`,
  }),
  
  // Users can update requests they received (respond) or sent (cancel)
  updateRequestPolicy: pgPolicy("users_can_update_friend_requests", {
    for: "update",
    to: authenticatedRole,
    using: sql`(select auth.uid()) IN (${table.fromUserId}, ${table.toUserId})`,
    withCheck: sql`(select auth.uid()) IN (${table.fromUserId}, ${table.toUserId})`,
  }),
}))

// Friendships table (accepted friend requests become friendships)
export const friendships = pgTable("friendships", {
  id: uuid("id").primaryKey().defaultRandom(),
  user1Id: uuid("user1_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  user2Id: uuid("user2_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { precision: 3, mode: 'string' }).defaultNow().notNull(),
  // Track when friends last interacted
  lastInteractionAt: timestamp("last_interaction_at", { precision: 3, mode: 'string' }).defaultNow().notNull(),
}, (table) => ({
  // Indexes
  user1Idx: index("friendships_user1_idx").on(table.user1Id),
  user2Idx: index("friendships_user2_idx").on(table.user2Id),
  lastInteractionIdx: index("friendships_last_interaction_idx").on(table.lastInteractionAt),
  
  // Constraints
  // Ensure consistent ordering (user1Id < user2Id) and uniqueness
  uniqueFriendship: unique("friendships_unique").on(table.user1Id, table.user2Id),
  // Prevent self-friendships
  noSelfFriendship: check("no_self_friendship", sql`${table.user1Id} != ${table.user2Id}`),
  // Ensure consistent ordering
  properOrdering: check("friendship_ordering", sql`${table.user1Id} < ${table.user2Id}`),
  
  // RLS Policies
  // Users can view friendships they're part of
  viewOwnFriendshipsPolicy: pgPolicy("users_can_view_own_friendships", {
    for: "select",
    to: authenticatedRole,
    using: sql`(select auth.uid()) IN (${table.user1Id}, ${table.user2Id})`,
  }),
  
  // Friendships are created by system when requests are accepted (not directly by users)
  // Users can delete friendships (unfriend)
  deleteFriendshipPolicy: pgPolicy("users_can_delete_friendships", {
    for: "delete",
    to: authenticatedRole,
    using: sql`(select auth.uid()) IN (${table.user1Id}, ${table.user2Id})`,
  }),
}))

// User presence table
export const userPresence = pgTable("user_presence", {
  userId: uuid("user_id").primaryKey().references(() => userProfiles.id, { onDelete: "cascade" }),
  status: presenceStatus("status").default('offline').notNull(),
  lastSeenAt: timestamp("last_seen_at", { precision: 3, mode: 'string' }).defaultNow().notNull(),
  // Current activity context
  currentGameId: text("current_game_id").references(() => games.id, { onDelete: "set null" }),
  // WebSocket connection tracking
  connectionCount: integer("connection_count").default(0).notNull(),
  updatedAt: timestamp("updated_at", { precision: 3, mode: 'string' }).defaultNow().notNull(),
}, (table) => ({
  // Indexes
  statusIdx: index("user_presence_status_idx").on(table.status),
  lastSeenIdx: index("user_presence_last_seen_idx").on(table.lastSeenAt),
  currentGameIdx: index("user_presence_current_game_idx").on(table.currentGameId),
  
  // RLS Policies
  // All authenticated users can view presence (for friends lists)
  viewPresencePolicy: pgPolicy("authenticated_can_view_presence", {
    for: "select",
    to: authenticatedRole,
    using: sql`true`,
  }),
  
  // Users can only update their own presence
  updateOwnPresencePolicy: pgPolicy("users_can_update_own_presence", {
    for: "insert",
    to: authenticatedRole,
    withCheck: sql`(select auth.uid()) = ${table.userId}`,
  }),
  
  updatePresencePolicy: pgPolicy("users_can_update_presence", {
    for: "update",
    to: authenticatedRole,
    using: sql`(select auth.uid()) = ${table.userId}`,
    withCheck: sql`(select auth.uid()) = ${table.userId}`,
  }),
}))

// Game invites table
export const gameInvites = pgTable("game_invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  gameId: text("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
  fromUserId: uuid("from_user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  toUserId: uuid("to_user_id").notNull().references(() => userProfiles.id, { onDelete: "cascade" }),
  status: gameInviteStatus("status").default('pending').notNull(),
  message: text("message"), // Optional invite message
  createdAt: timestamp("created_at", { precision: 3, mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { precision: 3, mode: 'string' }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { precision: 3, mode: 'string' }).notNull(), // Auto-expire invites
}, (table) => ({
  // Indexes
  gameIdx: index("game_invites_game_idx").on(table.gameId),
  fromUserIdx: index("game_invites_from_user_idx").on(table.fromUserId),
  toUserIdx: index("game_invites_to_user_idx").on(table.toUserId),
  statusIdx: index("game_invites_status_idx").on(table.status),
  expiresAtIdx: index("game_invites_expires_at_idx").on(table.expiresAt),
  
  // Constraints
  // Prevent duplicate invites to same user for same game
  uniqueGameInvite: unique("game_invites_unique").on(table.gameId, table.toUserId),
  // Prevent self-invites
  noSelfInvite: check("no_self_game_invite", sql`${table.fromUserId} != ${table.toUserId}`),
  
  // RLS Policies
  // Users can view invites they sent or received
  viewOwnInvitesPolicy: pgPolicy("users_can_view_own_game_invites", {
    for: "select",
    to: authenticatedRole,
    using: sql`(select auth.uid()) IN (${table.fromUserId}, ${table.toUserId})`,
  }),
  
  // Users can create invites for games they're in
  createInvitePolicy: pgPolicy("users_can_create_game_invites", {
    for: "insert",
    to: authenticatedRole,
    withCheck: sql`(select auth.uid()) = ${table.fromUserId}`,
  }),
  
  // Users can update invites they received (respond)
  updateInvitePolicy: pgPolicy("users_can_update_game_invites", {
    for: "update",
    to: authenticatedRole,
    using: sql`(select auth.uid()) = ${table.toUserId}`,
    withCheck: sql`(select auth.uid()) = ${table.toUserId}`,
  }),
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
 