import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { subscribeWithSelector } from 'zustand/middleware'
import { GameState, GameAction, PlayerId, Player, LobbyPlayer } from '@settlers/core'
import type { ReactFlowInstance } from 'reactflow'
import { API_URL } from '../lib/api'
import { supabase } from '../lib/supabase'

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
  lobbyPlayers: LobbyPlayer[]
  
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
  setLocalPlayerId: (playerId: string) => void
  
  // Lobby Actions
  createGame: (playerCount: 3 | 4, playerName: string) => Promise<{ gameCode: string; gameId: string }>
  joinGameByCode: (gameCode: string, playerName: string) => Promise<{ gameId: string; playerId: string }>
  connectToLobby: (gameId: string, playerId: string) => void
  startGame: (gameId: string) => Promise<void>
  
  // AI Bot Actions
  addAIBot: (gameId: string, difficulty: 'easy' | 'medium' | 'hard', personality: 'aggressive' | 'balanced' | 'defensive' | 'economic') => Promise<void>
  removeAIBot: (gameId: string, botPlayerId: string) => Promise<void>
  
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

        const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000'
        const ws = new WebSocket(`${wsUrl}/ws?gameId=${gameId}&playerId=${playerId}`)
        
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
          // Get current authenticated user
          const { data: { session } } = await supabase.auth.getSession()
          if (!session?.user) {
            throw new Error('Must be authenticated to create a game')
          }

          // Get auth headers
          const { data: { session: currentSession } } = await supabase.auth.getSession()
          const headers: Record<string, string> = { 
            'Content-Type': 'application/json'
          }
          if (currentSession?.access_token) {
            headers['Authorization'] = `Bearer ${currentSession.access_token}`
          }
          
          const response = await fetch(`${API_URL}/api/games`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              hostUserId: session.user.id,
              maxPlayers: playerCount,
              allowObservers: true,
              isPublic: true
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
          // Get current authenticated user
          const { data: { session } } = await supabase.auth.getSession()
          if (!session?.user) {
            throw new Error('Must be authenticated to join a game')
          }

          // Get auth headers
          const headers: Record<string, string> = { 
            'Content-Type': 'application/json'
          }
          if (session?.access_token) {
            headers['Authorization'] = `Bearer ${session.access_token}`
          }
          
          const response = await fetch(`${API_URL}/api/games/join-by-code`, {
            method: 'POST',
            headers,
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
        // Close existing WebSocket connection first
        const existingWs = get().ws
        if (existingWs) {
          console.log('🔌 Closing existing WebSocket connection')
          existingWs.close()
        }

        // Set the player ID immediately to prevent redirects
        set({ 
          localPlayerId: playerId,
          connectionStatus: 'connecting',
          lobbyState: 'joining',
          ws: null // Clear old connection
        })
        
        const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000'
        const ws = new WebSocket(`${wsUrl}/ws?gameId=${gameId}&playerId=${playerId}`)
        
        // Set connection timeout
        const connectionTimeout = setTimeout(() => {
          if (get().connectionStatus === 'connecting') {
            console.log('🕐 WebSocket connection timeout')
            ws.close()
            set({ 
              connectionStatus: 'error', 
              lobbyState: 'idle'
            })
          }
        }, 10000) // 10 second timeout
        
        ws.onopen = () => {
          clearTimeout(connectionTimeout)
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
              case 'gameStarted':
                set({ lobbyState: 'starting' })
                // Store player ID for game page access
                const currentPlayerId = get().localPlayerId
                const targetGameId = data.gameState?.id || gameId // Use gameId from closure
                if (currentPlayerId && targetGameId) {
                  localStorage.setItem(`playerId_${targetGameId}`, currentPlayerId)
                }
                // Use Next.js navigation to preserve React state
                if (typeof window !== 'undefined' && targetGameId) {
                  const event = new CustomEvent('navigateToGame', { detail: { gameId: targetGameId } })
                  window.dispatchEvent(event)
                }
                break
              case 'aiBotAdded':
                // Update lobby players list with new AI bot
                set((state) => {
                  // Check if bot already exists to prevent duplicates
                  const existingBot = state.lobbyPlayers.find(p => p.id === data.bot.id)
                  if (!existingBot) {
                    state.lobbyPlayers.push(data.bot)
                  }
                })
                break
              case 'aiBotRemoved':
                // Remove AI bot from lobby players list
                set((state) => {
                  state.lobbyPlayers = state.lobbyPlayers.filter(p => p.id !== data.botPlayerId)
                })
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
          clearTimeout(connectionTimeout)
          console.error('❌ Lobby WebSocket error:', error)
          set({ connectionStatus: 'error', lobbyState: 'idle' })
        }
        
        ws.onclose = (event) => {
          clearTimeout(connectionTimeout)
          console.log('🔌 Lobby WebSocket closed:', event.code, event.reason)
          
          // Only set disconnected if we're not already in error state
          const currentStatus = get().connectionStatus
          if (currentStatus !== 'error') {
            set({ 
              connectionStatus: 'disconnected', 
              ws: null,
              lobbyState: 'idle'
            })
          }
          
          // Only attempt reconnection for unexpected closures and if not already in error state
          if (event.code !== 1000 && event.code !== 1001 && currentStatus !== 'error') {
            console.log('🔄 Attempting to reconnect to lobby in 3 seconds...')
            setTimeout(() => {
              const state = get()
              // Only reconnect if still disconnected and have player ID
              if (state.connectionStatus === 'disconnected' && state.localPlayerId && gameId) {
                console.log('🔄 Reconnecting to lobby...')
                get().connectToLobby(gameId, state.localPlayerId)
              }
            }, 3000)
          }
        }
        
        set({ ws, connectionStatus: 'connecting' })
      },

      startGame: async (gameId) => {
        const { localPlayerId } = get()
        if (!localPlayerId) throw new Error('No player ID')
        
        // Get current authenticated user and headers
        const { data: { session } } = await supabase.auth.getSession()
        const headers: Record<string, string> = { 
          'Content-Type': 'application/json'
        }
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`
        }
        
        const response = await fetch(`${API_URL}/api/games/${gameId}/start`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ hostPlayerId: localPlayerId })
        })
        
        const data = await response.json()
        if (!data.success) throw new Error(data.error)
      },

      addAIBot: async (gameId, difficulty, personality) => {
        const { ws, isHost } = get()
        if (!isHost) throw new Error('Only host can add AI bots')
        if (!ws || ws.readyState !== WebSocket.OPEN) throw new Error('WebSocket not connected')
        
        ws.send(JSON.stringify({
          type: 'addAIBot',
          gameId,
          difficulty,
          personality
        }))
      },

      removeAIBot: async (gameId, botPlayerId) => {
        const { ws, isHost } = get()
        if (!isHost) throw new Error('Only host can remove AI bots')
        if (!ws || ws.readyState !== WebSocket.OPEN) throw new Error('WebSocket not connected')
        
        ws.send(JSON.stringify({
          type: 'removeAIBot',
          gameId,
          botPlayerId
        }))
      },
      
      setPlacementMode: (mode) => set({ placementMode: mode }),
      
      updateGameState: (state) => {
        // Convert objects to Maps if needed for compatibility
        const processedState = {
          ...state,
          players: state.players instanceof Map 
            ? state.players 
            : new Map(Object.entries(state.players as Record<string, any>)),
          board: {
            ...state.board,
            hexes: state.board.hexes instanceof Map
              ? state.board.hexes
              : new Map(Object.entries(state.board.hexes as Record<string, any>)),
            vertices: state.board.vertices instanceof Map
              ? state.board.vertices
              : new Map(Object.entries(state.board.vertices as Record<string, any>)),
            edges: state.board.edges instanceof Map
              ? state.board.edges
              : new Map(Object.entries(state.board.edges as Record<string, any>))
          }
        } as GameState
        set({ gameState: processedState })
        // TODO: Update valid placements based on new state
        // This would call validation functions from core
      },
      
      setHoveredHex: (hexId) => set({ hoveredHex: hexId }),
      setSelectedHex: (hexId) => set({ selectedHex: hexId }),
      setLocalPlayerId: (playerId) => set({ localPlayerId: playerId }),
      
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