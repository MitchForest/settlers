// Feature flags for gradual migration
// These can be toggled to enable/disable new features during migration

interface FeatureFlags {
  useSessionBasedAuth: boolean
  useUnifiedWebSocket: boolean
  useUrlBasedNavigation: boolean
  useNewErrorRecovery: boolean
  debugSessionManagement: boolean
}

// Default feature flags - can be overridden by environment variables
const defaultFlags: FeatureFlags = {
  useSessionBasedAuth: true,     // Enable JWT session tokens
  useUnifiedWebSocket: true,     // Use new unified WebSocket server
  useUrlBasedNavigation: true,   // Use URL-based session management
  useNewErrorRecovery: true,     // Use new error recovery system
  debugSessionManagement: process.env.NODE_ENV === 'development'
}

// Parse environment variable overrides
const envFlags: Partial<FeatureFlags> = {
  useSessionBasedAuth: process.env.NEXT_PUBLIC_USE_SESSION_AUTH === 'true',
  useUnifiedWebSocket: process.env.NEXT_PUBLIC_USE_UNIFIED_WS === 'true',
  useUrlBasedNavigation: process.env.NEXT_PUBLIC_USE_URL_NAV === 'true',
  useNewErrorRecovery: process.env.NEXT_PUBLIC_USE_NEW_ERROR_RECOVERY === 'true',
  debugSessionManagement: process.env.NEXT_PUBLIC_DEBUG_SESSIONS === 'true'
}

// Remove undefined values and merge with defaults
const activeFlags: FeatureFlags = {
  ...defaultFlags,
  ...Object.fromEntries(
    Object.entries(envFlags).filter(([_, value]) => value !== undefined)
  )
}

/**
 * Check if a feature flag is enabled
 */
export function isFeatureEnabled(flag: keyof FeatureFlags): boolean {
  return activeFlags[flag]
}

/**
 * Get all active feature flags (for debugging)
 */
export function getActiveFlags(): FeatureFlags {
  return { ...activeFlags }
}

/**
 * Log feature flag status (for debugging)
 */
export function logFeatureFlags(): void {
  if (typeof window !== 'undefined' && activeFlags.debugSessionManagement) {
    console.group('🚩 Feature Flags')
    Object.entries(activeFlags).forEach(([flag, enabled]) => {
      console.log(`${enabled ? '✅' : '❌'} ${flag}:`, enabled)
    })
    console.groupEnd()
  }
}

// Log flags on import in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  logFeatureFlags()
}

// Specific feature checks (for better IDE support and type safety)
export const featureFlags = {
  // Session management features
  isSessionBasedAuthEnabled: () => isFeatureEnabled('useSessionBasedAuth'),
  isUrlBasedNavigationEnabled: () => isFeatureEnabled('useUrlBasedNavigation'),
  
  // WebSocket features  
  isUnifiedWebSocketEnabled: () => isFeatureEnabled('useUnifiedWebSocket'),
  
  // Error handling features
  isNewErrorRecoveryEnabled: () => isFeatureEnabled('useNewErrorRecovery'),
  
  // Debug features
  isSessionDebuggingEnabled: () => isFeatureEnabled('debugSessionManagement')
}

/**
 * Conditional execution based on feature flags
 */
export function withFeature<T>(
  flag: keyof FeatureFlags,
  enabledFn: () => T,
  disabledFn?: () => T
): T {
  if (isFeatureEnabled(flag)) {
    return enabledFn()
  } else if (disabledFn) {
    return disabledFn()
  }
  throw new Error(`Feature ${flag} is disabled and no fallback provided`)
}

/**
 * Get WebSocket URL based on feature flags
 */
export function getWebSocketUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000'
  
  if (isFeatureEnabled('useUnifiedWebSocket')) {
    return `${baseUrl}/ws`
  } else {
    // Legacy WebSocket endpoint (if it exists)
    return `${baseUrl}/ws-legacy`
  }
}

/**
 * Migration helper - gradually enable features
 */
export function enableFeatureForUser(userId: string, flag: keyof FeatureFlags): boolean {
  // Simple hash-based rollout (deterministic based on user ID)
  if (!userId) return activeFlags[flag]
  
  const hash = hashCode(userId)
  const rolloutPercentage = getRolloutPercentage(flag)
  
  return (Math.abs(hash) % 100) < rolloutPercentage || activeFlags[flag]
}

// Helper functions
function hashCode(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return hash
}

function getRolloutPercentage(flag: keyof FeatureFlags): number {
  // Default rollout percentages for gradual feature enablement
  const rollouts: Partial<Record<keyof FeatureFlags, number>> = {
    useSessionBasedAuth: 100,      // Full rollout
    useUnifiedWebSocket: 100,      // Full rollout
    useUrlBasedNavigation: 100,    // Full rollout
    useNewErrorRecovery: 100,      // Full rollout
    debugSessionManagement: 0      // Only via explicit flag
  }
  
  return rollouts[flag] ?? 0
} 