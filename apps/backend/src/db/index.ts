import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../../drizzle/schema'

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/settlers'

const client = postgres(connectionString)
export const db = drizzle(client, { schema })

// Export all tables from the event-sourced schema
// Note: userProfiles is accessed via Supabase client, not Drizzle
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
  gameObservers 
} = schema

export type Database = typeof db 