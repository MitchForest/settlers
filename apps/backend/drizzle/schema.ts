import { pgTable, foreignKey, pgEnum, text, json, integer, boolean, timestamp, index, unique, uuid, varchar, primaryKey } from "drizzle-orm/pg-core"
  import { sql } from "drizzle-orm"

export const factorType = pgEnum("factor_type", ['totp', 'webauthn', 'phone'])
export const factorStatus = pgEnum("factor_status", ['unverified', 'verified'])
export const aalLevel = pgEnum("aal_level", ['aal1', 'aal2', 'aal3'])
export const codeChallengeMethod = pgEnum("code_challenge_method", ['s256', 'plain'])
export const oneTimeTokenType = pgEnum("one_time_token_type", ['confirmation_token', 'reauthentication_token', 'recovery_token', 'email_change_token_new', 'email_change_token_current', 'phone_change_token'])
export const equalityOp = pgEnum("equality_op", ['eq', 'neq', 'lt', 'lte', 'gt', 'gte', 'in'])
export const action = pgEnum("action", ['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'ERROR'])
export const buildingType = pgEnum("building_type", ['settlement', 'city'])
export const connectionType = pgEnum("connection_type", ['road'])
export const developmentCardType = pgEnum("development_card_type", ['knight', 'victory', 'roadBuilding', 'yearOfPlenty', 'monopoly'])
export const gamePhase = pgEnum("game_phase", ['setup1', 'setup2', 'roll', 'actions', 'discard', 'moveRobber', 'steal', 'ended'])
export const resourceType = pgEnum("resource_type", ['wood', 'brick', 'ore', 'wheat', 'sheep'])
export const terrainType = pgEnum("terrain_type", ['forest', 'hills', 'mountains', 'fields', 'pasture', 'desert'])
export const tradeStatus = pgEnum("trade_status", ['pending', 'accepted', 'rejected', 'cancelled', 'expired'])
export const tradeType = pgEnum("trade_type", ['bank', 'port', 'player'])
export const aiDifficulty = pgEnum("ai_difficulty", ['easy', 'medium', 'hard'])
export const aiPersonality = pgEnum("ai_personality", ['aggressive', 'balanced', 'defensive', 'economic'])


export const trades = pgTable("trades", {
	id: text("id").primaryKey().notNull(),
	gameId: text("game_id").notNull().references(() => games.id, { onDelete: "cascade" } ),
	type: tradeType("type").notNull(),
	initiator: text("initiator").notNull().references(() => players.id, { onDelete: "cascade" } ),
	target: text("target").references(() => players.id, { onDelete: "cascade" } ),
	offering: json("offering").notNull(),
	requesting: json("requesting").notNull(),
	status: tradeStatus("status").default('pending').notNull(),
	ratio: integer("ratio"),
	portType: text("port_type"),
	isOpenOffer: boolean("is_open_offer").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }),
	resolvedAt: timestamp("resolved_at", { mode: 'string' }),
});

export const games = pgTable("games", {
	id: text("id").primaryKey().notNull(),
	name: text("name").notNull(),
	status: text("status").default('waiting').notNull(),
	phase: gamePhase("phase").default('setup1').notNull(),
	currentPlayer: text("current_player").notNull(),
	turn: integer("turn").default(0).notNull(),
	gameCode: text("game_code"),
	hostPlayerId: text("host_player_id"),
	gameState: json("game_state").notNull(),
	settings: json("settings").notNull(),
	winner: text("winner"),
	startedAt: timestamp("started_at", { mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	hostUserId: uuid("host_user_id"),
},
(table) => {
	return {
		idxGamesHostUserId: index("idx_games_host_user_id").on(table.hostUserId),
		gamesGameCodeUnique: unique("games_game_code_unique").on(table.gameCode),
	}
});

export const developmentCards = pgTable("development_cards", {
	id: text("id").primaryKey().notNull(),
	gameId: text("game_id").notNull().references(() => games.id, { onDelete: "cascade" } ),
	playerId: text("player_id").references(() => players.id, { onDelete: "cascade" } ),
	type: developmentCardType("type").notNull(),
	purchasedTurn: integer("purchased_turn").notNull(),
	playedTurn: integer("played_turn"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
});

export const players = pgTable("players", {
	id: text("id").primaryKey().notNull(),
	gameId: text("game_id").notNull().references(() => games.id, { onDelete: "cascade" } ),
	name: text("name").notNull(),
	color: integer("color").notNull(),
	isHost: boolean("is_host").default(false).notNull(),
	isAi: boolean("is_ai").default(false).notNull(),
	isConnected: boolean("is_connected").default(false).notNull(),
	score: json("score").default({"public":0,"hidden":0,"total":0}).notNull(),
	resources: json("resources").default({"wood":0,"brick":0,"sheep":0,"wheat":0,"ore":0}).notNull(),
	buildings: json("buildings").default({"settlements":5,"cities":4,"roads":15}).notNull(),
	knightsPlayed: integer("knights_played").default(0).notNull(),
	hasLongestRoad: boolean("has_longest_road").default(false).notNull(),
	hasLargestArmy: boolean("has_largest_army").default(false).notNull(),
	joinedAt: timestamp("joined_at", { mode: 'string' }).defaultNow().notNull(),
	userId: uuid("user_id"),
	avatarEmoji: varchar("avatar_emoji", { length: 10 }).default('🧙‍♂️'::character varying),
	aiPersonality: aiPersonality("ai_personality"),
	aiDifficulty: aiDifficulty("ai_difficulty"),
	aiIsAutoMode: boolean("ai_is_auto_mode").default(false),
	aiIsDisconnected: boolean("ai_is_disconnected").default(false),
	aiThinkingTimeMs: integer("ai_thinking_time_ms").default(2000),
	aiMaxActionsPerTurn: integer("ai_max_actions_per_turn").default(15),
	aiEnableLogging: boolean("ai_enable_logging").default(true),
},
(table) => {
	return {
		idxPlayersUserId: index("idx_players_user_id").on(table.userId),
	}
});

export const gameEvents = pgTable("game_events", {
	id: text("id").primaryKey().notNull(),
	gameId: text("game_id").notNull().references(() => games.id, { onDelete: "cascade" } ),
	playerId: text("player_id").references(() => players.id, { onDelete: "cascade" } ),
	type: text("type").notNull(),
	data: json("data").notNull(),
	timestamp: timestamp("timestamp", { mode: 'string' }).defaultNow().notNull(),
});

export const placedBuildings = pgTable("placed_buildings", {
	id: text("id").primaryKey().notNull(),
	gameId: text("game_id").notNull().references(() => games.id, { onDelete: "cascade" } ),
	playerId: text("player_id").notNull().references(() => players.id, { onDelete: "cascade" } ),
	type: buildingType("type").notNull(),
	position: json("position").notNull(),
	placedAt: timestamp("placed_at", { mode: 'string' }).defaultNow().notNull(),
});

export const placedRoads = pgTable("placed_roads", {
	id: text("id").primaryKey().notNull(),
	gameId: text("game_id").notNull().references(() => games.id, { onDelete: "cascade" } ),
	playerId: text("player_id").notNull().references(() => players.id, { onDelete: "cascade" } ),
	type: text("type").default('road').notNull(),
	position: json("position").notNull(),
	placedAt: timestamp("placed_at", { mode: 'string' }).defaultNow().notNull(),
});

export const userProfiles = pgTable("user_profiles", {
	id: uuid("id").primaryKey().notNull(),
	username: varchar("username", { length: 20 }).notNull(),
	avatarEmoji: varchar("avatar_emoji", { length: 10 }).default('🧙‍♂️'::character varying).notNull(),
	displayName: varchar("display_name", { length: 50 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
	gamesPlayed: integer("games_played").default(0),
	gamesWon: integer("games_won").default(0),
	totalScore: integer("total_score").default(0),
	longestRoadRecord: integer("longest_road_record").default(0),
	largestArmyRecord: integer("largest_army_record").default(0),
	isPublic: boolean("is_public").default(true),
	preferredPlayerCount: integer("preferred_player_count").default(4),
},
(table) => {
	return {
		idxUserProfilesUsername: index("idx_user_profiles_username").on(table.username),
		userProfilesUsernameKey: unique("user_profiles_username_key").on(table.username),
	}
});

export const aiStats = pgTable("ai_stats", {
	id: text("id").primaryKey().notNull(),
	gameId: text("game_id").notNull().references(() => games.id, { onDelete: "cascade" } ),
	playerId: text("player_id").notNull().references(() => players.id, { onDelete: "cascade" } ),
	turnsPlayed: integer("turns_played").default(0).notNull(),
	actionsExecuted: integer("actions_executed").default(0).notNull(),
	successfulActions: integer("successful_actions").default(0).notNull(),
	failedActions: integer("failed_actions").default(0).notNull(),
	averageDecisionTimeMs: integer("average_decision_time_ms").default(0).notNull(),
	setupTurns: integer("setup_turns").default(0).notNull(),
	regularTurns: integer("regular_turns").default(0).notNull(),
	specialActionTurns: integer("special_action_turns").default(0).notNull(),
	buildingActions: integer("building_actions").default(0).notNull(),
	tradeActions: integer("trade_actions").default(0).notNull(),
	cardActions: integer("card_actions").default(0).notNull(),
	robberActions: integer("robber_actions").default(0).notNull(),
	finalScore: integer("final_score").default(0),
	gameWon: boolean("game_won").default(false),
	gamePosition: integer("game_position"),
	aiStartedAt: timestamp("ai_started_at", { mode: 'string' }).defaultNow().notNull(),
	aiEndedAt: timestamp("ai_ended_at", { mode: 'string' }),
	lastActionAt: timestamp("last_action_at", { mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
});

export const gamePlayers = pgTable("game_players", {
	gameId: text("game_id").notNull().references(() => games.id, { onDelete: "cascade" } ),
	playerId: text("player_id").notNull().references(() => players.id, { onDelete: "cascade" } ),
	position: integer("position").notNull(),
},
(table) => {
	return {
		gamePlayersGameIdPlayerIdPk: primaryKey({ columns: [table.gameId, table.playerId], name: "game_players_game_id_player_id_pk"})
	}
});