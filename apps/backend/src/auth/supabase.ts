import { createClient } from '@supabase/supabase-js'

// Server-side Supabase client for JWT validation
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

// User profile type for backend use
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

// Get user profile from database
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()
    
    if (error) {
      console.error('Error fetching user profile:', error)
      return null
    }
    
    return data
  } catch (error) {
    console.error('Error in getUserProfile:', error)
    return null
  }
} 