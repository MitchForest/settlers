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
        const ws = new WebSocket(`ws://localhost:4000/ws?gameId=${gameId}&playerId=${playerId}`)
        
        ws.onopen = () => {
          set({ connectionStatus: 'connected', ws })
        }
        
        ws.onmessage = (event) => {
          const data = JSON.parse(event.data)
          if (data.type === 'gameState') {
            get().updateGameState(data.state)
          }
        }
        
        ws.onerror = () => {
          set({ connectionStatus: 'error' })
        }
        
        ws.onclose = () => {
          set({ connectionStatus: 'disconnected', ws: null })
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
          ws.send(JSON.stringify({ type: 'action', action }))
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
        const state = get().gameState
        if (!state) return null
        return state.players.get(state.currentPlayer) || null
      },
      
      isMyTurn: () => {
        const state = get().gameState
        const localId = get().localPlayerId
        if (!state || !localId) return false
        return state.currentPlayer === localId
      },
      
      myPlayer: () => {
        const state = get().gameState
        const localId = get().localPlayerId
        if (!state || !localId) return null
        return state.players.get(localId) || null
      }
    }))
  )
) 