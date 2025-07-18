// Guest session management for unauthenticated users

export interface GameHistoryEntry {
  gameId: string
  joinedAt: string
  leftAt?: string
  result?: 'won' | 'lost' | 'abandoned'
  playerCount: number
}

export interface GuestPreferences {
  theme: 'auto' | 'light' | 'dark'
  notifications: boolean
  autoJoinEnabled: boolean
}

export interface SessionStats {
  gamesJoined: number
  gamesCompleted: number
  totalPlayTime: number // in minutes
  winRate: number // percentage
  favoriteBoardSize: string
  lastActive: string
}

export interface GuestSession {
  id: string
  name: string
  avatarEmoji: string
  createdAt: string
  gameHistory: GameHistoryEntry[]
  preferences: GuestPreferences
  stats: SessionStats
  version: number // for migration purposes
}

const GUEST_SESSION_KEY = 'settlers-guest-session'

// Generate a unique guest ID
function generateGuestId(): string {
  return `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Migrate old session format to new format
function migrateGuestSession(oldSession: Record<string, unknown>): GuestSession {
  const now = new Date().toISOString()
  
  return {
    id: (typeof oldSession.id === 'string' ? oldSession.id : null) || generateGuestId(),
    name: (typeof oldSession.name === 'string' ? oldSession.name : null) || generateThematicName(),
    avatarEmoji: (typeof oldSession.avatarEmoji === 'string' ? oldSession.avatarEmoji : null) || '🧙‍♂️',
    createdAt: (typeof oldSession.createdAt === 'string' ? oldSession.createdAt : null) || now,
    gameHistory: Array.isArray(oldSession.gameHistory) 
      ? oldSession.gameHistory.map((gameId: unknown) => ({
          gameId: typeof gameId === 'string' ? gameId : `unknown_${Date.now()}`,
          joinedAt: (typeof oldSession.createdAt === 'string' ? oldSession.createdAt : null) || now,
          playerCount: 4
        }))
      : [],
    preferences: (oldSession.preferences && typeof oldSession.preferences === 'object' && oldSession.preferences !== null) 
      ? oldSession.preferences as GuestPreferences 
      : {
          theme: 'auto',
          notifications: true,
          autoJoinEnabled: false
        },
    stats: (oldSession.stats && typeof oldSession.stats === 'object' && oldSession.stats !== null)
      ? oldSession.stats as SessionStats
      : {
          gamesJoined: Array.isArray(oldSession.gameHistory) ? oldSession.gameHistory.length : 0,
          gamesCompleted: 0,
          totalPlayTime: 0,
          winRate: 0,
          favoriteBoardSize: 'standard',
          lastActive: now
        },
    version: 1
  }
}

// Get or create guest session
export function getGuestSession(): GuestSession {
  if (typeof window === 'undefined') {
    // Server-side fallback
    return createNewGuestSession()
  }

  const stored = localStorage.getItem(GUEST_SESSION_KEY)
  
  if (stored) {
    try {
      const session = JSON.parse(stored) as Record<string, unknown>
      
      // Check if session needs migration
      if (!session.version || (typeof session.version === 'number' && session.version < 1)) {
        console.log('Migrating guest session to new format')
        const migratedSession = migrateGuestSession(session)
        saveGuestSession(migratedSession)
        return migratedSession
      }
      
      // Validate session structure
      if (session.id && session.name && session.avatarEmoji && session.createdAt && session.version) {
        return session as unknown as GuestSession
      }
    } catch (error) {
      console.warn('Invalid guest session data, creating new session:', error)
    }
  }
  
  // Create new session if none exists or is invalid
  return createNewGuestSession()
}

// Thematic name generation
const NAME_THEMES = {
  fantasy: ['Aragorn', 'Gandalf', 'Elrond', 'Galadriel', 'Thorin', 'Legolas', 'Gimli', 'Boromir'],
  cosmic: ['Stardust', 'Nebula', 'Cosmos', 'Galaxy', 'Quasar', 'Pulsar', 'Aurora', 'Comet'],
  nature: ['River', 'Mountain', 'Forest', 'Ocean', 'Storm', 'Wildfire', 'Frost', 'Thunder'],
  colors: ['Crimson', 'Azure', 'Golden', 'Silver', 'Violet', 'Emerald', 'Amber', 'Scarlet']
}

// Generate thematic guest name
export function generateThematicName(): string {
  const themes = Object.keys(NAME_THEMES)
  const randomTheme = themes[Math.floor(Math.random() * themes.length)] as keyof typeof NAME_THEMES
  const names = NAME_THEMES[randomTheme]
  const randomName = names[Math.floor(Math.random() * names.length)]
  const suffix = Math.floor(Math.random() * 1000)
  return `${randomName}${suffix}`
}

// Create a new guest session
function createNewGuestSession(): GuestSession {
  const guestEmojis = ['🧙‍♂️', '🧙‍♀️', '🧌', '🦹‍♂️', '🦹‍♀️', '🥷', '🧚‍♂️', '🧚‍♀️', '🧞‍♂️', '🧞‍♀️']
  const randomEmoji = guestEmojis[Math.floor(Math.random() * guestEmojis.length)]
  const now = new Date().toISOString()
  
  const session: GuestSession = {
    id: generateGuestId(),
    name: generateThematicName(),
    avatarEmoji: randomEmoji,
    createdAt: now,
    gameHistory: [],
    preferences: {
      theme: 'auto',
      notifications: true,
      autoJoinEnabled: false
    },
    stats: {
      gamesJoined: 0,
      gamesCompleted: 0,
      totalPlayTime: 0,
      winRate: 0,
      favoriteBoardSize: 'standard',
      lastActive: now
    },
    version: 1
  }
  
  saveGuestSession(session)
  return session
}

// Save guest session to localStorage
export function saveGuestSession(session: GuestSession): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(session))
    } catch (error) {
      console.error('Failed to save guest session:', error)
      // If localStorage is full or disabled, try to clear and retry once
      try {
        localStorage.removeItem(GUEST_SESSION_KEY)
        localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(session))
      } catch (retryError) {
        console.error('Failed to save guest session even after cleanup:', retryError)
        throw new Error('Unable to save session data. Your browser storage may be full.')
      }
    }
  }
}

// Update guest session name and avatar
export function updateGuestSession(updates: Partial<Pick<GuestSession, 'name' | 'avatarEmoji'>>): GuestSession {
  const session = getGuestSession()
  const updatedSession = { ...session, ...updates }
  saveGuestSession(updatedSession)
  return updatedSession
}

// Add game to guest history
export function addGameToGuestHistory(gameId: string, playerCount: number = 4): void {
  const session = getGuestSession()
  
  // Check if game already exists in history
  const existingGame = session.gameHistory.find(entry => entry.gameId === gameId)
  if (!existingGame) {
    const newEntry: GameHistoryEntry = {
      gameId,
      joinedAt: new Date().toISOString(),
      playerCount
    }
    session.gameHistory.push(newEntry)
    session.stats.gamesJoined += 1
    session.stats.lastActive = new Date().toISOString()
    saveGuestSession(session)
  }
}

// Complete a game in guest history
export function completeGameInHistory(gameId: string, result: 'won' | 'lost' | 'abandoned', playTimeMinutes?: number): void {
  const session = getGuestSession()
  const gameEntry = session.gameHistory.find(entry => entry.gameId === gameId)
  
  if (gameEntry && !gameEntry.leftAt) {
    gameEntry.leftAt = new Date().toISOString()
    gameEntry.result = result
    
    session.stats.gamesCompleted += 1
    if (playTimeMinutes) {
      session.stats.totalPlayTime += playTimeMinutes
    }
    
    // Update win rate
    const completedGames = session.gameHistory.filter(entry => entry.result).length
    const wins = session.gameHistory.filter(entry => entry.result === 'won').length
    session.stats.winRate = completedGames > 0 ? (wins / completedGames) * 100 : 0
    
    session.stats.lastActive = new Date().toISOString()
    saveGuestSession(session)
  }
}

// Update guest preferences
export function updateGuestPreferences(preferences: Partial<GuestPreferences>): GuestSession {
  const session = getGuestSession()
  session.preferences = { ...session.preferences, ...preferences }
  saveGuestSession(session)
  return session
}

// Clear guest session (when user signs up)
export function clearGuestSession(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(GUEST_SESSION_KEY)
  }
}

// Check if user has an existing guest session
export function hasGuestSession(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(GUEST_SESSION_KEY) !== null
}

// Get guest display name for UI
export function getGuestDisplayName(): string {
  const session = getGuestSession()
  return session.name
}

// Get guest avatar for UI
export function getGuestAvatar(): string {
  const session = getGuestSession()
  return session.avatarEmoji
}

// Prepare upgrade data for account creation
export interface UpgradeData {
  preferredName: string
  avatarEmoji: string
  gameExperience: {
    gamesPlayed: number
    hoursPlayed: number
    winRate: number
  }
  preserveableData: {
    preferences: GuestPreferences
    recentGames: string[]
  }
}

export function prepareUpgradeData(): UpgradeData {
  const session = getGuestSession()
  
  return {
    preferredName: session.name,
    avatarEmoji: session.avatarEmoji,
    gameExperience: {
      gamesPlayed: session.stats.gamesJoined,
      hoursPlayed: Math.round(session.stats.totalPlayTime / 60 * 10) / 10,
      winRate: session.stats.winRate
    },
    preserveableData: {
      preferences: session.preferences,
      recentGames: session.gameHistory
        .slice(-5)
        .map(entry => entry.gameId)
    }
  }
}

// Session persistence across browser closes
export function persistSession(): void {
  const session = getGuestSession()
  session.stats.lastActive = new Date().toISOString()
  saveGuestSession(session)
}

// Restore session and update last active
export function restoreSession(): GuestSession {
  const session = getGuestSession()
  session.stats.lastActive = new Date().toISOString()
  saveGuestSession(session)
  return session
}

// Get session duration for stats
export function getSessionDuration(): number {
  const session = getGuestSession()
  const created = new Date(session.createdAt)
  const now = new Date()
  return Math.round((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)) // days
}