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
      
      // If profile doesn't exist, try to create one
      if (error.code === 'PGRST116') { // No rows returned
        console.log(`Profile not found for ${userId}, attempting to create one`)
        return await createUserProfile(userId)
      }
      
      return null
    }
    
    return data
  } catch (error) {
    console.error('Error in getUserProfile:', error)
    return null
  }
}

// Create a user profile if it doesn't exist
async function createUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    // Get user info from auth.users
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId)
    
    if (authError || !authUser.user) {
      console.error('Could not fetch auth user:', authError)
      return null
    }
    
    const user = authUser.user
    const username = `Player${userId.substring(0, 8)}`
    const displayName = user.email || 'New Player'
    
    console.log(`Creating profile for ${userId} with username: ${username}`)
    
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .insert({
        id: userId,
        username,
        display_name: displayName,
        avatar_emoji: '🧙‍♂️'
      })
      .select()
      .single()
    
    if (error) {
      console.error('Error creating user profile:', error)
      return null
    }
    
    console.log(`Profile created successfully for ${userId}:`, data)
    return data
  } catch (error) {
    console.error('Error in createUserProfile:', error)
    return null
  }
} 