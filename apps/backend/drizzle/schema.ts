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


export const friendEventSequences = pgTable("friend_event_sequences", {
	aggregateId: uuid("aggregate_id").primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	nextSequence: bigint("next_sequence", { mode: "number" }).default(1).notNull(),
});

export const friendEvents = pgTable("friend_events", {
	id: text().primaryKey().notNull(),
	aggregateId: uuid("aggregate_id").notNull(),
	eventType: friendEventType("event_type").notNull(),
	data: json().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	sequenceNumber: bigint("sequence_number", { mode: "number" }).notNull(),
	timestamp: timestamp({ precision: 3, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("friend_events_aggregate_sequence_idx").using("btree", table.aggregateId.asc().nullsLast().op("uuid_ops"), table.sequenceNumber.asc().nullsLast().op("int8_ops")),
	index("friend_events_aggregate_type_idx").using("btree", table.aggregateId.asc().nullsLast().op("uuid_ops"), table.eventType.asc().nullsLast().op("uuid_ops")),
	index("friend_events_timestamp_idx").using("btree", table.timestamp.asc().nullsLast().op("timestamp_ops")),
	unique("friend_events_aggregate_id_sequence_number_unique").on(table.aggregateId, table.sequenceNumber),
]);

export const gameInviteEventSequences = pgTable("game_invite_event_sequences", {
	aggregateId: uuid("aggregate_id").primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	nextSequence: bigint("next_sequence", { mode: "number" }).default(1).notNull(),
});

export const gameInviteEvents = pgTable("game_invite_events", {
	id: text().primaryKey().notNull(),
	aggregateId: uuid("aggregate_id").notNull(),
	eventType: gameInviteEventType("event_type").notNull(),
	data: json().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	sequenceNumber: bigint("sequence_number", { mode: "number" }).notNull(),
	timestamp: timestamp({ precision: 3, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("invite_events_aggregate_sequence_idx").using("btree", table.aggregateId.asc().nullsLast().op("uuid_ops"), table.sequenceNumber.asc().nullsLast().op("int8_ops")),
	index("invite_events_aggregate_type_idx").using("btree", table.aggregateId.asc().nullsLast().op("uuid_ops"), table.eventType.asc().nullsLast().op("uuid_ops")),
	index("invite_events_timestamp_idx").using("btree", table.timestamp.asc().nullsLast().op("timestamp_ops")),
	unique("game_invite_events_aggregate_id_sequence_number_unique").on(table.aggregateId, table.sequenceNumber),
]);

export const gameEvents = pgTable("game_events", {
	id: text().primaryKey().notNull(),
	gameId: text("game_id").notNull(),
	eventType: gameEventType("event_type").notNull(),
	data: json().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	sequenceNumber: bigint("sequence_number", { mode: "number" }).notNull(),
	timestamp: timestamp({ precision: 3, mode: 'string' }).defaultNow().notNull(),
	contextPlayerId: text("context_player_id"),
}, (table) => [
	index("game_events_context_player_idx").using("btree", table.contextPlayerId.asc().nullsLast().op("text_ops")),
	index("game_events_game_sequence_idx").using("btree", table.gameId.asc().nullsLast().op("int8_ops"), table.sequenceNumber.asc().nullsLast().op("int8_ops")),
	index("game_events_game_type_idx").using("btree", table.gameId.asc().nullsLast().op("text_ops"), table.eventType.asc().nullsLast().op("text_ops")),
	index("game_events_timestamp_idx").using("btree", table.timestamp.asc().nullsLast().op("timestamp_ops")),
	foreignKey({
			columns: [table.contextPlayerId],
			foreignColumns: [players.id],
			name: "game_events_context_player_id_players_id_fk"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.gameId],
			foreignColumns: [games.id],
			name: "game_events_game_id_games_id_fk"
		}).onDelete("cascade"),
	unique("game_events_game_id_sequence_number_unique").on(table.gameId, table.sequenceNumber),
]);

export const players = pgTable("players", {
	id: text().primaryKey().notNull(),
	gameId: text("game_id").notNull(),
	userId: uuid("user_id"),
	playerType: playerType("player_type").notNull(),
	name: text().notNull(),
	avatarEmoji: text("avatar_emoji"),
	color: text().notNull(),
	joinOrder: integer("join_order").notNull(),
	isHost: boolean("is_host").default(false).notNull(),
	joinedAt: timestamp("joined_at", { precision: 3, mode: 'string' }).defaultNow().notNull(),
	leftAt: timestamp("left_at", { precision: 3, mode: 'string' }),
}, (table) => [
	index("players_game_player_idx").using("btree", table.gameId.asc().nullsLast().op("text_ops"), table.id.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.gameId],
			foreignColumns: [games.id],
			name: "players_game_id_games_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [userProfiles.id],
			name: "players_user_id_user_profiles_id_fk"
		}).onDelete("set null"),
	unique("players_game_id_join_order_unique").on(table.gameId, table.joinOrder),
	unique("players_game_id_color_unique").on(table.gameId, table.color),
]);

export const games = pgTable("games", {
	id: text().primaryKey().notNull(),
	gameCode: varchar("game_code", { length: 10 }).notNull(),
	createdAt: timestamp("created_at", { precision: 3, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { precision: 3, mode: 'string' }).defaultNow().notNull(),
	currentPhase: gamePhase("current_phase").default('lobby').notNull(),
	currentPlayerId: text("current_player_id"),
	isActive: boolean("is_active").default(true).notNull(),
	endedAt: timestamp("ended_at", { precision: 3, mode: 'string' }),
	winnerId: text("winner_id"),
}, (table) => [
	index("games_active_idx").using("btree", table.isActive.asc().nullsLast().op("bool_ops")),
	index("games_game_code_idx").using("btree", table.gameCode.asc().nullsLast().op("text_ops")),
	index("games_phase_idx").using("btree", table.currentPhase.asc().nullsLast().op("enum_ops")),
	unique("games_game_code_unique").on(table.gameCode),
]);

export const gameEventSequences = pgTable("game_event_sequences", {
	gameId: text("game_id").primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	nextSequence: bigint("next_sequence", { mode: "number" }).default(1).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.gameId],
			foreignColumns: [games.id],
			name: "game_event_sequences_game_id_games_id_fk"
		}).onDelete("cascade"),
]);

export const gameObservers = pgTable("game_observers", {
	id: text().primaryKey().notNull(),
	gameId: text("game_id").notNull(),
	userId: uuid("user_id").notNull(),
	joinedAt: timestamp("joined_at", { precision: 3, mode: 'string' }).defaultNow().notNull(),
	leftAt: timestamp("left_at", { precision: 3, mode: 'string' }),
}, (table) => [
	index("game_observers_game_idx").using("btree", table.gameId.asc().nullsLast().op("text_ops")),
	index("game_observers_user_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.gameId],
			foreignColumns: [games.id],
			name: "game_observers_game_id_games_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [userProfiles.id],
			name: "game_observers_user_id_user_profiles_id_fk"
		}).onDelete("cascade"),
	unique("game_observers_game_id_user_id_unique").on(table.gameId, table.userId),
]);

export const playerEvents = pgTable("player_events", {
	id: text().primaryKey().notNull(),
	gameId: text("game_id").notNull(),
	playerId: text("player_id").notNull(),
	eventType: playerEventType("event_type").notNull(),
	data: json().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	sequenceNumber: bigint("sequence_number", { mode: "number" }).notNull(),
	timestamp: timestamp({ precision: 3, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("player_events_game_sequence_idx").using("btree", table.gameId.asc().nullsLast().op("text_ops"), table.sequenceNumber.asc().nullsLast().op("int8_ops")),
	index("player_events_game_type_idx").using("btree", table.gameId.asc().nullsLast().op("text_ops"), table.eventType.asc().nullsLast().op("text_ops")),
	index("player_events_player_idx").using("btree", table.playerId.asc().nullsLast().op("text_ops")),
	index("player_events_timestamp_idx").using("btree", table.timestamp.asc().nullsLast().op("timestamp_ops")),
	foreignKey({
			columns: [table.gameId],
			foreignColumns: [games.id],
			name: "player_events_game_id_games_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.playerId],
			foreignColumns: [players.id],
			name: "player_events_player_id_players_id_fk"
		}).onDelete("cascade"),
	unique("player_events_game_id_sequence_number_unique").on(table.gameId, table.sequenceNumber),
]);

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
