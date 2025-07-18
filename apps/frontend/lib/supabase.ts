import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: 'settlers-auth-token',
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    flowType: 'pkce',
    debug: process.env.NODE_ENV === 'development'
  }
})

// Types for our user profile
export interface UserProfile {
  id: string
  username: string
  avatar_emoji: string
  display_name: string | null
  created_at: string
  updated_at: string
  games_played: number
  games_won: number
  total_score: number
  longest_road_record: number
  largest_army_record: number
  is_public: boolean
  preferred_player_count: number
}

// Helper function to get user profile
export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    // Check if user is authenticated
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      console.error('No authenticated session when fetching profile')
      return null
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      // If profile doesn't exist (PGRST116), that's expected for new users
      if (error.code === 'PGRST116') {
        console.log('No profile found for user, new user needs to create profile')
        return null
      }
      console.error('Error fetching user profile:', error)
      return null
    }

    return data
  } catch (error) {
    console.error('Unexpected error fetching user profile:', error)
    return null
  }
}

// Helper function to create/update user profile
export const upsertUserProfile = async (profile: Partial<UserProfile> & { id: string }) => {
  const { data, error } = await supabase
    .from('user_profiles')
    .upsert(profile)
    .select()
    .single()

  if (error) {
    console.error('Error upserting user profile:', error)
    throw error
  }

  return data
}

// Helper function to check if username is available
export const isUsernameAvailable = async (username: string, excludeUserId?: string): Promise<boolean> => {
  let query = supabase
    .from('user_profiles')
    .select('id')
    .eq('username', username)

  if (excludeUserId) {
    query = query.neq('id', excludeUserId)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error checking username availability:', error)
    return false
  }

  return data.length === 0
} 