// Guest session management for unauthenticated users

export interface GuestSession {
  id: string
  name: string
  avatarEmoji: string
  createdAt: string
  gameHistory: string[] // Array of game IDs the guest has participated in
}

const GUEST_SESSION_KEY = 'settlers-guest-session'

// Generate a unique guest ID
function generateGuestId(): string {
  return `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
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
      const session = JSON.parse(stored) as GuestSession
      // Validate session structure
      if (session.id && session.name && session.avatarEmoji && session.createdAt) {
        return session
      }
    } catch (error) {
      console.warn('Invalid guest session data, creating new session:', error)
    }
  }
  
  // Create new session if none exists or is invalid
  return createNewGuestSession()
}

// Create a new guest session
function createNewGuestSession(): GuestSession {
  const guestEmojis = ['🧙‍♂️', '🧙‍♀️', '🧌', '🦹‍♂️', '🦹‍♀️', '🥷', '🧚‍♂️', '🧚‍♀️', '🧞‍♂️', '🧞‍♀️']
  const randomEmoji = guestEmojis[Math.floor(Math.random() * guestEmojis.length)]
  
  const session: GuestSession = {
    id: generateGuestId(),
    name: `Guest${Math.floor(Math.random() * 1000)}`,
    avatarEmoji: randomEmoji,
    createdAt: new Date().toISOString(),
    gameHistory: []
  }
  
  saveGuestSession(session)
  return session
}

// Save guest session to localStorage
export function saveGuestSession(session: GuestSession): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(session))
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
export function addGameToGuestHistory(gameId: string): void {
  const session = getGuestSession()
  if (!session.gameHistory.includes(gameId)) {
    session.gameHistory.push(gameId)
    saveGuestSession(session)
  }
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