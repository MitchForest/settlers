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
  
  // Lobby State
  lobbyState: 'idle' | 'creating' | 'joining' | 'waiting' | 'starting'
  gameCode: string | null
  isHost: boolean
  lobbyPlayers: Player[]
  
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
  
  // Game Actions
  connect: (gameId: string, playerId: string) => Promise<void>
  disconnect: () => void
  sendAction: (action: GameAction) => void
  setPlacementMode: (mode: 'none' | 'settlement' | 'city' | 'road') => void
  updateGameState: (state: GameState) => void
  setHoveredHex: (hexId: string | null) => void
  setSelectedHex: (hexId: string | null) => void
  
  // Lobby Actions
  createGame: (playerCount: 3 | 4, playerName: string) => Promise<{ gameCode: string; gameId: string }>
  joinGameByCode: (gameCode: string, playerName: string) => Promise<{ gameId: string; playerId: string }>
  connectToLobby: (gameId: string, playerId: string) => void
  startGame: (gameId: string) => Promise<void>
  
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
      
      // Lobby state
      lobbyState: 'idle',
      gameCode: null,
      isHost: false,
      lobbyPlayers: [],
      
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

        // Store player ID for this game
        localStorage.setItem(`playerId_${gameId}`, playerId)

        const ws = new WebSocket(`ws://localhost:4000/ws?gameId=${gameId}&playerId=${playerId}`)
        
        ws.onopen = () => {
          console.log('🔌 WebSocket connected to game:', gameId)
          set({ connectionStatus: 'connected', ws, localPlayerId: playerId })
          
          // Send join game message
          ws.send(JSON.stringify({ 
            type: 'joinGame', 
            gameId, 
            playerId 
          }))
        }
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            console.log('📨 WebSocket message received:', data.type)
            
            switch (data.type) {
              case 'gameStateUpdate':
                if (data.gameState) {
                  get().updateGameState(data.gameState)
                }
                break
              case 'actionSuccess':
                console.log('✅ Action successful:', data.action)
                break
              case 'error':
                console.error('❌ Server error:', data.error)
                // Don't show toast here as the game page will handle it
                break
              default:
                console.log('📨 Unhandled message type:', data.type)
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
      
      // Lobby Actions
      createGame: async (playerCount, playerName) => {
        set({ lobbyState: 'creating' })
        
        try {
          const response = await fetch('/api/games', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              playerNames: [playerName],
              hostPlayerName: playerName
            })
          })
          
          const data = await response.json()
          if (!data.success) throw new Error(data.error)
          
          // Store host player ID
          localStorage.setItem('hostPlayerId', data.hostPlayerId)
          
          set({ 
            gameCode: data.gameCode,
            isHost: true,
            lobbyState: 'waiting',
            localPlayerId: data.hostPlayerId
          })
          
          return { gameCode: data.gameCode, gameId: data.gameId }
        } catch (error) {
          set({ lobbyState: 'idle' })
          throw error
        }
      },

      joinGameByCode: async (gameCode, playerName) => {
        set({ lobbyState: 'joining' })
        
        try {
          const response = await fetch('/api/games/join-by-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ gameCode, playerName })
          })
          
          const data = await response.json()
          if (!data.success) throw new Error(data.error)
          
          set({ 
            gameCode,
            isHost: false,
            lobbyState: 'waiting',
            localPlayerId: data.playerId,
            lobbyPlayers: data.players
          })
          
          return { gameId: data.gameId, playerId: data.playerId }
        } catch (error) {
          set({ lobbyState: 'idle' })
          throw error
        }
      },

      connectToLobby: (gameId, playerId) => {
        const ws = new WebSocket(`ws://localhost:4000/ws?gameId=${gameId}&playerId=${playerId}`)
        
        ws.onopen = () => {
          console.log('🔌 WebSocket connected to lobby:', gameId)
          set({ connectionStatus: 'connected' })
          ws.send(JSON.stringify({ type: 'joinLobby', gameId, playerId }))
        }
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            console.log('📨 Lobby WebSocket message:', data.type)
            
            switch (data.type) {
              case 'lobbyJoined':
                set({ 
                  gameCode: data.gameCode,
                  lobbyPlayers: data.players,
                  isHost: data.isHost 
                })
                break
              case 'lobbyUpdate':
                set({ lobbyPlayers: data.players })
                break
              case 'gameStarting':
                set({ lobbyState: 'starting' })
                // Redirect to game
                window.location.href = `/game/${data.gameId}`
                break
              case 'error':
                console.error('❌ Lobby error:', data.error)
                break
            }
          } catch (error) {
            console.error('❌ Failed to parse lobby WebSocket message:', error)
          }
        }
        
        ws.onerror = (error) => {
          console.error('❌ Lobby WebSocket error:', error)
          set({ connectionStatus: 'error' })
        }
        
        ws.onclose = () => {
          console.log('🔌 Lobby WebSocket closed')
          set({ connectionStatus: 'disconnected', ws: null })
        }
        
        set({ ws, connectionStatus: 'connecting' })
      },

      startGame: async (gameId) => {
        const { localPlayerId } = get()
        if (!localPlayerId) throw new Error('No player ID')
        
        const response = await fetch(`/api/games/${gameId}/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hostPlayerId: localPlayerId })
        })
        
        const data = await response.json()
        if (!data.success) throw new Error(data.error)
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