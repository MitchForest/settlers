// Development utility to monitor package loading
// Helps ensure packages are only loaded when actually needed

interface LoadingEvent {
  package: string
  route: string
  timestamp: number
  reason: string
}

class PackageLoadingMonitor {
  private events: LoadingEvent[] = []
  private isEnabled: boolean

  constructor() {
    this.isEnabled = process.env.NODE_ENV === 'development'
  }

  logLoad(packageName: string, reason: string) {
    if (!this.isEnabled) return

    const event: LoadingEvent = {
      package: packageName,
      route: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
      timestamp: Date.now(),
      reason
    }

    this.events.push(event)
    console.log(`📦 Package Loading: ${packageName} (${reason}) on ${event.route}`)
  }

  getLoadingHistory() {
    return this.events
  }

  hasPackageLoaded(packageName: string) {
    return this.events.some(event => event.package === packageName)
  }

  // Verify packages are only loaded on appropriate routes
  verifyLoadingBoundaries() {
    if (!this.isEnabled) return

    const issues: string[] = []

    // Check if game-engine was loaded on homepage
    const gameEngineOnHomepage = this.events.find(
      event => event.package === 'game-engine' && event.route === '/'
    )
    if (gameEngineOnHomepage) {
      issues.push('❌ game-engine loaded on homepage')
    }

    // Check if AI system was loaded without AI players
    const aiLoads = this.events.filter(event => event.package === 'ai-system')
    const inappropriateAILoads = aiLoads.filter(
      event => !event.reason.includes('AI players detected')
    )
    if (inappropriateAILoads.length > 0) {
      issues.push('❌ ai-system loaded without AI players')
    }

    if (issues.length === 0) {
      console.log('✅ Package loading boundaries verified')
    } else {
      console.warn('Package loading issues:', issues)
    }

    return issues
  }
}

export const packageMonitor = new PackageLoadingMonitor()

// Export for use in game-engine-loader
export function logPackageLoad(packageName: string, reason: string) {
  packageMonitor.logLoad(packageName, reason)
} 