import { pgTable, uuid, bigint, index, unique, text, json, timestamp, foreignKey, integer, boolean, varchar, pgEnum, pgPolicy } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const buildingType = pgEnum("building_type", ['settlement', 'city'])
export const developmentCardType = pgEnum("development_card_type", ['knight', 'victory_point', 'road_building', 'year_of_plenty', 'monopoly'])
export const friendEventType = pgEnum("friend_event_type", ['friend_request_sent', 'friend_request_accepted', 'friend_request_rejected', 'friend_request_cancelled', 'friend_removed', 'presence_updated'])
export const gameEventType = pgEnum("game_event_type", ['game_started', 'settings_changed', 'dice_rolled', 'resource_produced', 'building_placed', 'road_placed', 'card_drawn', 'card_played', 'trade_proposed', 'trade_accepted', 'trade_declined', 'robber_moved', 'resources_stolen', 'turn_ended', 'game_ended'])
export const gameInviteEventType = pgEnum("game_invite_event_type", ['game_invite_sent', 'game_invite_accepted', 'game_invite_declined', 'game_invite_expired', 'game_invite_cancelled'])
export const gamePhase = pgEnum("game_phase", ['lobby', 'initial_placement', 'main_game', 'ended'])
export const playerEventType = pgEnum("player_event_type", ['player_joined', 'player_left', 'ai_player_added', 'ai_player_removed'])
export const playerType = pgEnum("player_type", ['human', 'ai'])
export const resourceType = pgEnum("resource_type", ['wood', 'brick', 'ore', 'wheat', 'sheep'])
export const terrainType = pgEnum("terrain_type", ['forest', 'hills', 'mountains', 'fields', 'pasture', 'desert'])
export const tradeStatus = pgEnum("trade_status", ['pending', 'accepted', 'declined', 'expired'])
export const tradeType = pgEnum("trade_type", ['player_to_player', 'player_to_bank', 'harbor_trade'])


// LEGACY TABLES - DEPRECATED BY UNIFIED SYSTEM
// These tables are replaced by unified_events and will be dropped

// UNIFIED EVENT SOURCING TABLES - ZERO TECHNICAL DEBT
export const unifiedEvents = pgTable("unified_events", {
	id: text("id").primaryKey().notNull(),
	gameId: text("game_id").notNull(),
	eventType: text("event_type").notNull(),
	eventData: json("event_data").notNull(),
	sequenceNumber: bigint("sequence_number", { mode: "number" }).notNull(),
	timestamp: timestamp("timestamp", { precision: 3, mode: 'string' }).defaultNow().notNull(),
	contextUserId: text("context_user_id"),
	contextPlayerId: text("context_player_id"),
	contextConnectionId: text("context_connection_id"),
}, (table) => [
	index("unified_events_game_sequence_idx").using("btree", table.gameId.asc().nullsLast(), table.sequenceNumber.asc().nullsLast()),
	index("unified_events_game_type_idx").using("btree", table.gameId.asc().nullsLast(), table.eventType.asc().nullsLast()),
	index("unified_events_timestamp_idx").using("btree", table.timestamp.asc().nullsLast()),
	unique("unified_events_game_sequence_unique").on(table.gameId, table.sequenceNumber),
]);

export const unifiedEventSequences = pgTable("unified_event_sequences", {
	gameId: text("game_id").primaryKey().notNull(),
	nextSequence: bigint("next_sequence", { mode: "number" }).default(1).notNull(),
});

export const userProfiles = pgTable("user_profiles", {
	id: uuid().primaryKey().notNull(),
	email: text().notNull(),
	name: text().notNull(),
	avatarEmoji: text("avatar_emoji"),
	createdAt: timestamp("created_at", { precision: 3, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { precision: 3, mode: 'string' }).defaultNow().notNull(),
	username: text().notNull(),
	displayName: text("display_name").notNull(),
}, (table) => [
	index("user_profiles_email_idx").using("btree", table.email.asc().nullsLast().op("text_ops")),
	index("user_profiles_username_idx").using("btree", table.username.asc().nullsLast().op("text_ops")),
	unique("user_profiles_email_unique").on(table.email),
	unique("user_profiles_username_unique").on(table.username),
	// RLS Security Policies for user_profiles - FIXED: Added table permissions + policies
	pgPolicy("public_read_profiles", { as: "permissive", for: "select", to: ["public"], using: sql`true` }),
	pgPolicy("service_role_all_access", { as: "permissive", for: "all", to: ["service_role"], using: sql`true` }),
	pgPolicy("users_update_own", { as: "permissive", for: "update", to: ["authenticated"], using: sql`auth.uid() = id` }),
	pgPolicy("users_delete_own", { as: "permissive", for: "delete", to: ["authenticated"], using: sql`auth.uid() = id` }),
]);
