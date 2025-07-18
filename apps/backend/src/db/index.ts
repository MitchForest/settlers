import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/settlers'

const client = postgres(connectionString)
export const db = drizzle(client, { schema })

// Export only the tables that exist in the new event-sourced schema
export const { 
  games, 
  players, 
  gameEvents, 
  gameEventSequences,
  userProfiles,
  gameObservers 
} = schema

export type Database = typeof db 