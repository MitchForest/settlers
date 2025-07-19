import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'

// Lightweight types - no heavy imports from @settlers/game-engine
interface AppStore {
  // Core State - minimal for homepage/lobby
  localPlayerId: string | null
  
  // UI State for dialogs
  showCreateGame: boolean
  showJoinGame: boolean
  showObserveGame: boolean
  showMagicLink: boolean
  
  // Actions
  setLocalPlayerId: (playerId: string | null) => void
  setShowCreateGame: (show: boolean) => void
  setShowJoinGame: (show: boolean) => void
  setShowObserveGame: (show: boolean) => void
  setShowMagicLink: (show: boolean) => void
  
  // Reset all dialogs
  closeAllDialogs: () => void
}

export const useAppStore = create<AppStore>()(
  immer((set) => ({
    // Initial state
    localPlayerId: null,
    showCreateGame: false,
    showJoinGame: false,
    showObserveGame: false,
    showMagicLink: false,
    
    // Actions
    setLocalPlayerId: (playerId) => set((state) => {
      state.localPlayerId = playerId
    }),
    
    setShowCreateGame: (show) => set((state) => {
      state.showCreateGame = show
    }),
    
    setShowJoinGame: (show) => set((state) => {
      state.showJoinGame = show
    }),
    
    setShowObserveGame: (show) => set((state) => {
      state.showObserveGame = show
    }),
    
    setShowMagicLink: (show) => set((state) => {
      state.showMagicLink = show
    }),
    
    closeAllDialogs: () => set((state) => {
      state.showCreateGame = false
      state.showJoinGame = false
      state.showObserveGame = false
      state.showMagicLink = false
    })
  }))
) 