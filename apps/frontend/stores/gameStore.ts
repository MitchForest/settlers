import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { subscribeWithSelector } from 'zustand/middleware'
import { GameState, GameAction, PlayerId, Player } from '@settlers/core'
import type { ReactFlowInstance } from 'reactflow'

interface GameStore {
  // Core State
  gameState: GameState | null
  localPlayerId: PlayerId | null
  
  // React Flow State
  flowInstance: ReactFlowInstance | null
  setFlowInstance: (instance: ReactFlowInstance) => void
  
  // WebSocket
  ws: WebSocket | null
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error'
  
  // UI State
  placementMode: 'none' | 'settlement' | 'city' | 'road'
  hoveredHex: string | null
  selectedHex: string | null
  selectedVertex: string | null
  selectedEdge: string | null
  validPlacements: {
    settlements: Set<string>
    roads: Set<string>
    cities: Set<string>
  }
  productionAnimation: Set<string> | null
  
  // Actions
  connect: (gameId: string, playerId: string) => Promise<void>
  disconnect: () => void
  sendAction: (action: GameAction) => void
  setPlacementMode: (mode: 'none' | 'settlement' | 'city' | 'road') => void
  updateGameState: (state: GameState) => void
  setHoveredHex: (hexId: string | null) => void
  setSelectedHex: (hexId: string | null) => void
  
  // Computed
  currentPlayer: () => Player | null
  isMyTurn: () => boolean
  myPlayer: () => Player | null
}

export const useGameStore = create<GameStore>()(
  subscribeWithSelector(
    immer((set, get) => ({
      // Initial state
      gameState: null,
      localPlayerId: null,
      flowInstance: null,
      ws: null,
      connectionStatus: 'disconnected',
      placementMode: 'none',
      hoveredHex: null,
      selectedHex: null,
      selectedVertex: null,
      selectedEdge: null,
      validPlacements: {
        settlements: new Set(),
        roads: new Set(),
        cities: new Set()
      },
      productionAnimation: null,
      
      // Actions
      setFlowInstance: (instance) => set({ flowInstance: instance }),
      
      connect: async (gameId, playerId) => {
        // Close existing connection if any
        const existingWs = get().ws
        if (existingWs) {
          existingWs.close()
        }

        const ws = new WebSocket(`ws://localhost:4000/ws?gameId=${gameId}&playerId=${playerId}`)
        
        ws.onopen = () => {
          console.log('🔌 WebSocket connected')
          set({ connectionStatus: 'connected', ws })
        }
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            if (data.type === 'gameState' && data.state) {
              get().updateGameState(data.state)
            }
          } catch (error) {
            console.error('❌ Failed to parse WebSocket message:', error, event.data)
          }
        }
        
        ws.onerror = (error) => {
          console.error('❌ WebSocket error:', error)
          set({ connectionStatus: 'error' })
        }
        
        ws.onclose = (event) => {
          console.log('🔌 WebSocket closed:', event.code, event.reason)
          set({ connectionStatus: 'disconnected', ws: null })
          
          // Auto-reconnect after 5 seconds if not a clean close
          if (event.code !== 1000 && event.code !== 1001) {
            console.log('🔄 Attempting to reconnect in 5 seconds...')
            setTimeout(() => {
              if (get().connectionStatus === 'disconnected') {
                get().connect(gameId, playerId)
              }
            }, 5000)
          }
        }
        
        set({ ws, connectionStatus: 'connecting', localPlayerId: playerId })
      },
      
      disconnect: () => {
        const ws = get().ws
        if (ws) {
          ws.close()
          set({ ws: null, connectionStatus: 'disconnected' })
        }
      },
      
      sendAction: (action) => {
        const ws = get().ws
        if (ws && ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(JSON.stringify({ type: 'action', action }))
          } catch (error) {
            console.error('❌ Failed to send action:', error)
            set({ connectionStatus: 'error' })
          }
        } else {
          console.warn('⚠️ Cannot send action: WebSocket not connected')
        }
      },
      
      setPlacementMode: (mode) => set({ placementMode: mode }),
      
      updateGameState: (state) => {
        set({ gameState: state })
        // TODO: Update valid placements based on new state
        // This would call validation functions from core
      },
      
      setHoveredHex: (hexId) => set({ hoveredHex: hexId }),
      setSelectedHex: (hexId) => set({ selectedHex: hexId }),
      
      // Computed
      currentPlayer: () => {
        try {
          const state = get().gameState
          if (!state || !state.players || !state.currentPlayer) return null
          return state.players.get(state.currentPlayer) || null
        } catch (error) {
          console.error('❌ Error getting current player:', error)
          return null
        }
      },
      
      isMyTurn: () => {
        try {
          const state = get().gameState
          const localId = get().localPlayerId
          if (!state || !localId || !state.currentPlayer) return false
          return state.currentPlayer === localId
        } catch (error) {
          console.error('❌ Error checking if my turn:', error)
          return false
        }
      },
      
      myPlayer: () => {
        try {
          const state = get().gameState
          const localId = get().localPlayerId
          if (!state || !localId || !state.players) return null
          return state.players.get(localId) || null
        } catch (error) {
          console.error('❌ Error getting my player:', error)
          return null
        }
      }
    }))
  )
) 