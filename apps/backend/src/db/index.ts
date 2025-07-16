import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/settlers'

// Singleton pattern to prevent stack overflow
let client: postgres.Sql | null = null

export function getClient() {
  if (!client) {
    client = postgres(connectionString, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10
    })
  }
  return client
}

export const db = drizzle(getClient(), { schema })

// Export tables for easier access
export const { games, players, gameEvents, trades, developmentCards, placedBuildings, placedRoads, gamePlayersRelation } = schema

export type Database = typeof db 