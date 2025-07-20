import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../../drizzle/schema'

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/settlers'

// Configure postgres client for Supabase with proper SSL and timeouts
// For development, make SSL optional
const client = postgres(connectionString, {
  ssl: process.env.NODE_ENV === 'production' ? 'require' : false,
  max: 10, // Connection pool size
  idle_timeout: 20,
  connect_timeout: 10
})

export const db = drizzle(client, { schema })

// Export tables from schema
// Note: userProfiles is accessed via Supabase client, not Drizzle
export const { 
  // UNIFIED EVENT SOURCING TABLES - ZERO TECHNICAL DEBT
  unifiedEvents,
  unifiedEventSequences,
  // USER MANAGEMENT (kept)
  userProfiles
} = schema

export type Database = typeof db 