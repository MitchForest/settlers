import { Context, Next } from 'hono'
import { supabaseAdmin, getUserProfile, UserProfile } from '../auth/supabase'
import type { User } from '@supabase/supabase-js'

// Extend Hono context to include user data
declare module 'hono' {
  interface ContextVariableMap {
    user: User
    userId: string
    userProfile: UserProfile | null
  }
}

// Authentication middleware - validates JWT tokens
export const authMiddleware = async (c: Context, next: Next) => {
  try {
    // Extract token from Authorization header
    const authHeader = c.req.header('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ 
        success: false, 
        error: 'Missing or invalid Authorization header' 
      }, 401)
    }

    const token = authHeader.replace('Bearer ', '')
    
    // Validate token with Supabase
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    
    if (error || !user) {
      console.error('Auth validation failed:', error)
      return c.json({ 
        success: false, 
        error: 'Invalid or expired token' 
      }, 401)
    }

    // Get user profile
    const userProfile = await getUserProfile(user.id)
    
    // Set user data in context
    c.set('user', user)
    c.set('userId', user.id)
    c.set('userProfile', userProfile)
    
    await next()
  } catch (error) {
    console.error('Auth middleware error:', error)
    return c.json({ 
      success: false, 
      error: 'Authentication failed' 
    }, 500)
  }
}

// Optional auth middleware - validates token if present but doesn't require it
export const optionalAuthMiddleware = async (c: Context, next: Next) => {
  try {
    const authHeader = c.req.header('Authorization')
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
      
      if (!error && user) {
        const userProfile = await getUserProfile(user.id)
        c.set('user', user)
        c.set('userId', user.id)
        c.set('userProfile', userProfile)
      }
    }
    
    await next()
  } catch (error) {
    console.error('Optional auth middleware error:', error)
    // Continue without auth if optional auth fails
    await next()
  }
} 