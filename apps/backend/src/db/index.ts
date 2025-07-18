import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/settlers'

const client = postgres(connectionString)
export const db = drizzle(client, { schema })

// Export all tables from the event-sourced schema
export const { 
  games, 
  players, 
  playerEvents,
  gameEvents, 
  gameEventSequences,
  friendEvents,
  friendEventSequences,
  gameInviteEvents,
  gameInviteEventSequences,
  userProfiles,
  gameObservers 
} = schema

export type Database = typeof db 