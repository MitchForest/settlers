import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { subscribeWithSelector } from 'zustand/middleware'
import type { PlayerId, LobbyPlayer, LightGameAction } from '../lib/types/lobby-types'
import type { ReactFlowInstance } from 'reactflow'
import { API_URL } from '../lib/api'
import { supabase } from '../lib/supabase'
import type { ConnectionStatus } from '../lib/websocket-connection-manager'
import type { GameState, Player, GameAction as EngineGameAction } from '@settlers/game-engine'
import type { AIPlayerConfig } from '@settlers/ai-system'
import { loadGameEngine, loadAISystem, isGameEngineLoaded, isAISystemLoaded } from '../lib/game-engine-loader'

// Use proper types now that we have them defined
type GameAction = EngineGameAction | LightGameAction

// Loading states for dynamic packages
interface GameEngineState {
  gameEngine: any | null  // Will be typed properly when loaded
  aiSystem: any | null    // Will be typed properly when loaded
  isLoading: boolean
  error: string | null
}

interface GameStore extends GameEngineState {
  // Game State
  gameState: GameState | null
  localPlayerId: PlayerId | null
  flowInstance: ReactFlowInstance | null
  
  // Connection (using singleton WebSocket manager now)
  connectionStatus: ConnectionStatus
  
  // Lobby State  
  lobbyState: 'idle' | 'joining' | 'joined' | 'left'
  
  // Actions
  setGameState: (gameState: GameState | null) => void
  setLocalPlayerId: (playerId: PlayerId | null) => void
  setFlowInstance: (instance: ReactFlowInstance) => void
  
  // WebSocket actions - DEPRECATED, use new singleton manager instead
  connectToLobby: (gameId: string, playerId: string) => void
  disconnectFromLobby: () => void
  sendAction: (action: GameAction) => void
  
  // Game Engine Management
  loadEngines: () => Promise<void>
  
  // Player helpers
  myPlayer: () => Player | null
}

export const useGameStore = create<GameStore>()(
  subscribeWithSelector(
    immer((set, get) => ({
      // Initial state
      gameState: null,
      localPlayerId: null,
      flowInstance: null,
      connectionStatus: 'disconnected',
      lobbyState: 'idle',
      
      // Game Engine State
      gameEngine: null,
      aiSystem: null,
      isLoading: false,
      error: null,
      
      // Actions
      setGameState: (gameState) => set({ gameState }),
      setLocalPlayerId: (playerId) => set({ localPlayerId: playerId }),
      setFlowInstance: (instance) => set({ flowInstance: instance }),
      
      // DEPRECATED WebSocket actions - use new singleton manager instead
      connectToLobby: (gameId, playerId) => {
        console.warn('🚨 gameStore.connectToLobby is DEPRECATED - use useLobbyWebSocket hook instead')
        // Don't create any WebSocket connections here anymore
      },
      
      disconnectFromLobby: () => {
        console.warn('🚨 gameStore.disconnectFromLobby is DEPRECATED - use useLobbyWebSocket hook instead')
        set({ 
          lobbyState: 'left',
          connectionStatus: 'disconnected'
        })
      },
      
      sendAction: (action) => {
        console.warn('🚨 gameStore.sendAction is DEPRECATED - use new WebSocket hooks instead')
        return false
      },
      
      // Game Engine Management
      loadEngines: async () => {
        if (get().isLoading) return
        
        set({ isLoading: true, error: null })
        
        try {
          // Load game engine if not already loaded
          if (!isGameEngineLoaded()) {
            console.log('📦 Loading game engine...')
            await loadGameEngine()
          }
          
          // Load AI system if not already loaded  
          if (!isAISystemLoaded()) {
            console.log('📦 Loading AI system...')
            await loadAISystem()
          }
          
          // Dynamic imports after packages are loaded
          const gameEngineModule = await import('@settlers/game-engine')
          const aiSystemModule = await import('@settlers/ai-system')
          
          set({
            gameEngine: gameEngineModule,
            aiSystem: aiSystemModule,
            isLoading: false
          })
          
          console.log('✅ Game engines loaded successfully')
        } catch (error) {
          console.error('❌ Failed to load game engines:', error)
          set({ 
            error: error instanceof Error ? error.message : 'Failed to load game engines',
            isLoading: false 
          })
        }
      },
      
      // Helper functions
      myPlayer: (): Player | null => {
        const { gameState, localPlayerId } = get()
        if (!gameState?.players || !localPlayerId) return null
        
        try {
          // Handle Map structure
          if (gameState.players instanceof Map) {
            return gameState.players.get(localPlayerId) || null
          }
          // Handle array structure
          if (Array.isArray(gameState.players)) {
            return (gameState.players as Player[]).find((p: Player) => p.id === localPlayerId) || null
          }
          return null
        } catch (error) {
          console.error('Error finding player:', error)
          return null
        }
      }
    }))
  )
) 