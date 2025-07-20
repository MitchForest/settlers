import { supabaseAdmin } from './supabase'

export interface ValidatedUser {
  id: string
  email: string
  role?: string
}

export interface ValidationResult {
  valid: boolean
  user?: ValidatedUser
  error?: string
}

/**
 * Validate Supabase JWT token
 * This replaces all custom JWT implementations
 */
export class SupabaseJWTValidator {
  
  /**
   * Validate a Supabase access token
   */
  static async validateToken(token: string): Promise<ValidationResult> {
    try {
      // Use Supabase Admin to verify the JWT
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
      
      if (error) {
        console.warn('🔒 JWT validation failed:', error.message)
        return {
          valid: false,
          error: error.message
        }
      }
      
      if (!user) {
        return {
          valid: false,
          error: 'No user found for token'
        }
      }
      
      console.log('✅ JWT validation successful for user:', user.email)
      
      return {
        valid: true,
        user: {
          id: user.id,
          email: user.email || '',
          role: user.role
        }
      }
      
    } catch (error) {
      console.error('❌ JWT validation error:', error)
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Validation failed'
      }
    }
  }
  
  /**
   * Extract Bearer token from Authorization header
   */
  static extractBearerToken(authHeader: string | null): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null
    }
    
    return authHeader.substring(7) // Remove "Bearer " prefix
  }
  
  /**
   * Extract token from WebSocket URL parameter
   */
  static extractTokenFromURL(url: string): string | null {
    try {
      const urlObj = new URL(url)
      return urlObj.searchParams.get('token')
    } catch {
      return null
    }
  }
  
  /**
   * Middleware function for HTTP routes
   */
  static async validateAuthHeader(authHeader: string | null): Promise<ValidationResult> {
    const token = this.extractBearerToken(authHeader)
    
    if (!token) {
      return {
        valid: false,
        error: 'No bearer token provided'
      }
    }
    
    return this.validateToken(token)
  }
}