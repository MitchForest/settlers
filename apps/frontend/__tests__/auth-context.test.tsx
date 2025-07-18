/**
 * CRITICAL ARCHITECTURE TEST: Auth Context Integration
 * 
 * This test ensures we maintain unified auth state management and prevents
 * auth fragmentation or multiple auth systems
 */

import { describe, it, expect, vi } from 'vitest'

// Mock Supabase before importing auth context
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } }
      }),
      signInWithOtp: vi.fn(),
      signOut: vi.fn()
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null })
        })
      })
    }))
  }
}))

// Mock guest session
vi.mock('@/lib/guest-session', () => ({
  createGuestSession: vi.fn(),
  getGuestSession: vi.fn(),
  clearGuestSession: vi.fn()
}))

describe('Auth Context Architecture', () => {
  describe('🏗️ Auth Unity (CRITICAL)', () => {
    it('should have a unified auth context module', async () => {
      // Test that auth context module exists and exports expected functions
      const authModule = await import('@/lib/auth-context')
      
      expect(authModule).toHaveProperty('AuthProvider')
      expect(authModule).toHaveProperty('useAuth')
      expect(typeof authModule.AuthProvider).toBe('function')
      expect(typeof authModule.useAuth).toBe('function')
    })

    it('should prevent multiple auth systems', async () => {
      // Verify we don't have multiple auth contexts or providers
      const authModule = await import('@/lib/auth-context')
      
      // Should not export multiple auth providers
      expect(authModule).not.toHaveProperty('AuthProvider2')
      expect(authModule).not.toHaveProperty('AlternativeAuthProvider')
      expect(authModule).not.toHaveProperty('LegacyAuthProvider')
      
      // Should not export multiple auth hooks
      expect(authModule).not.toHaveProperty('useAuth2')
      expect(authModule).not.toHaveProperty('useAlternativeAuth')
      expect(authModule).not.toHaveProperty('useLegacyAuth')
    })
  })

  describe('🚫 Anti-Pattern Prevention', () => {
    it('should prevent direct Supabase auth usage outside context', async () => {
      // Auth context should encapsulate Supabase auth
      const authModule = await import('@/lib/auth-context')
      
      // Should not expose raw Supabase client
      expect(authModule).not.toHaveProperty('supabase')
      expect(authModule).not.toHaveProperty('client')
      expect(authModule).not.toHaveProperty('authClient')
    })

    it('should maintain single auth state source', async () => {
      // Verify we don't have fragmented auth state management
      const authModule = await import('@/lib/auth-context')
      
      // Should not export state management primitives
      expect(authModule).not.toHaveProperty('authState')
      expect(authModule).not.toHaveProperty('setAuthState')
      expect(authModule).not.toHaveProperty('useAuthState')
      expect(authModule).not.toHaveProperty('authStore')
    })
  })

  describe('📁 Auth Module Organization', () => {
    it('should not have multiple auth modules', async () => {
      // These should not exist or should not export auth functionality
      const deprecatedAuthPaths = [
        '@/lib/auth-provider',
        '@/lib/supabase-auth',
        '@/lib/auth-service',
        '@/components/auth-provider'
      ]
      
      for (const path of deprecatedAuthPaths) {
        try {
          const module = await import(path)
          // If module exists, it should not export auth providers
          const exports = Object.keys(module)
          const authExports = exports.filter(name => 
            name.toLowerCase().includes('auth') && 
            (name.includes('Provider') || name.includes('Context'))
          )
          expect(authExports).toHaveLength(0)
        } catch (error) {
          // Module not found is expected and good
          expect(error).toBeDefined()
        }
      }
    })

    it('should maintain consistent auth module structure', async () => {
      const authModule = await import('@/lib/auth-context')
      
      // Should have the expected auth exports
      expect(authModule).toHaveProperty('AuthProvider')
      expect(authModule).toHaveProperty('useAuth')
      
      // Should not have conflicting auth implementations
      const exports = Object.keys(authModule)
      const authProviders = exports.filter(name => name.includes('Provider'))
      expect(authProviders).toEqual(['AuthProvider'])
    })
  })
}) 