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

// Types for our user profile - aligned with backend schema
export interface UserProfile {
  id: string
  email: string
  name: string
  avatarEmoji: string | null
  createdAt: string
  updatedAt: string
}

// Helper function to get user profile
export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    // Check if user is authenticated
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      console.warn('No authenticated session when fetching profile')
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
      
      // Log other errors but don't throw to avoid breaking the app
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
  try {
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
  } catch (error) {
    console.error('Failed to upsert user profile:', error)
    throw error
  }
}

// Helper function to check if username is available (removed since we don't have username field)
export const createUserProfile = async (userId: string, email: string, name: string): Promise<UserProfile | null> => {
  try {
    const newProfile = {
      id: userId,
      email,
      name,
      avatarEmoji: '🧙‍♂️'
    }

    const result = await upsertUserProfile(newProfile)
    return result
  } catch (error) {
    console.error('Failed to create user profile:', error)
    return null
  }
} 