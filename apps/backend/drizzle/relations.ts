import { relations } from "drizzle-orm/relations";
import { players, gameEvents, games, userProfiles, gameEventSequences, gameObservers, playerEvents } from "./schema";

export const gameEventsRelations = relations(gameEvents, ({one}) => ({
	player: one(players, {
		fields: [gameEvents.contextPlayerId],
		references: [players.id]
	}),
	game: one(games, {
		fields: [gameEvents.gameId],
		references: [games.id]
	}),
}));

export const playersRelations = relations(players, ({one, many}) => ({
	gameEvents: many(gameEvents),
	game: one(games, {
		fields: [players.gameId],
		references: [games.id]
	}),
	userProfile: one(userProfiles, {
		fields: [players.userId],
		references: [userProfiles.id]
	}),
	playerEvents: many(playerEvents),
}));

export const gamesRelations = relations(games, ({many}) => ({
	gameEvents: many(gameEvents),
	players: many(players),
	gameEventSequences: many(gameEventSequences),
	gameObservers: many(gameObservers),
	playerEvents: many(playerEvents),
}));

export const userProfilesRelations = relations(userProfiles, ({many}) => ({
	players: many(players),
	gameObservers: many(gameObservers),
}));

export const gameEventSequencesRelations = relations(gameEventSequences, ({one}) => ({
	game: one(games, {
		fields: [gameEventSequences.gameId],
		references: [games.id]
	}),
}));

export const gameObserversRelations = relations(gameObservers, ({one}) => ({
	game: one(games, {
		fields: [gameObservers.gameId],
		references: [games.id]
	}),
	userProfile: one(userProfiles, {
		fields: [gameObservers.userId],
		references: [userProfiles.id]
	}),
}));

export const playerEventsRelations = relations(playerEvents, ({one}) => ({
	game: one(games, {
		fields: [playerEvents.gameId],
		references: [games.id]
	}),
	player: one(players, {
		fields: [playerEvents.playerId],
		references: [players.id]
	}),
}));