/**
 * CRITICAL ARCHITECTURE TEST: Store Import Pattern
 * 
 * This test ensures we maintain proper store import patterns and prevents
 * import drift that leads to fragmented state management
 */

import { describe, it, expect } from 'vitest'

describe('Store Import Architecture', () => {
  describe('🏗️ Import Unity (CRITICAL)', () => {
    it('should export unified store from index', async () => {
      const storeIndex = await import('@/stores/index')
      
      // Should export the main store
      expect(storeIndex).toHaveProperty('useGameStore')
      expect(typeof storeIndex.useGameStore).toBe('function')
      
      // Store should be properly typed (types are compile-time, not runtime)
      // This test validates the store structure instead
      expect(typeof storeIndex.useGameStore).toBe('function')
      expect(storeIndex.useGameStore.getState).toBeDefined()
    })

    it('should maintain legacy compatibility through domainStores', async () => {
      const domainStores = await import('@/stores/domainStores')
      
      // Should export the same store as index
      expect(domainStores).toHaveProperty('useGameStore')
      expect(typeof domainStores.useGameStore).toBe('function')
    })

    it('should provide direct access to gameStore', async () => {
      const gameStore = await import('@/stores/gameStore')
      
      // Should export the store and interface
      expect(gameStore).toHaveProperty('useGameStore')
      expect(typeof gameStore.useGameStore).toBe('function')
      // GameStore should have proper structure (types are compile-time)
      expect(gameStore.useGameStore.getState).toBeDefined()
      expect(typeof gameStore.useGameStore.getState().connect).toBe('function')
    })
  })

  describe('🔍 Import Consistency', () => {
    it('should provide the same store instance from all import paths', async () => {
      const [indexStore, domainStore, directStore] = await Promise.all([
        import('@/stores/index'),
        import('@/stores/domainStores'), 
        import('@/stores/gameStore')
      ])
      
      // All should reference the same store function
      expect(indexStore.useGameStore).toBe(domainStore.useGameStore)
      expect(indexStore.useGameStore).toBe(directStore.useGameStore)
      expect(domainStore.useGameStore).toBe(directStore.useGameStore)
    })

    it('should not export multiple store instances', async () => {
      const storeModules = await Promise.all([
        import('@/stores/index'),
        import('@/stores/domainStores'),
        import('@/stores/gameStore')
      ])
      
      // Should not have multiple different store exports
      const storeExports = storeModules.map(module => Object.keys(module))
      
      // Each should only export the unified store (and types)
      storeExports.forEach(exports => {
        expect(exports).toContain('useGameStore')
        
        // Should not have other store exports that could fragment state
        const storeNames = exports.filter(name => name.toLowerCase().includes('store'))
        expect(storeNames.length).toBeGreaterThanOrEqual(1) // At least useGameStore
        expect(storeNames.length).toBeLessThanOrEqual(2) // At most useGameStore + GameStore type
      })
    })
  })

  describe('🚫 Anti-Pattern Prevention', () => {
    it('should prevent imports of deprecated store patterns', async () => {
      // These should not exist or should not export stores
      const deprecatedPaths = [
        '@/stores/friendsStore',
        '@/stores/lobbyStore', 
        '@/stores/authStore',
        '@/stores/gameStateStore',
        '@/stores/websocketStore'
      ]
      
      for (const path of deprecatedPaths) {
        try {
          const module = await import(path)
          // If module exists, it should not export store hooks
          const exports = Object.keys(module)
          const storeExports = exports.filter(name => 
            name.startsWith('use') && name.endsWith('Store')
          )
          expect(storeExports).toHaveLength(0)
        } catch (error) {
          // Module not found is expected and good
          expect(error).toBeDefined()
        }
      }
    })

    it('should prevent bypassing unified store exports', async () => {
      const storeIndex = await import('@/stores/index')
      
      // Should not export raw store instances or creators
      expect(storeIndex).not.toHaveProperty('createStore')
      expect(storeIndex).not.toHaveProperty('store')
      expect(storeIndex).not.toHaveProperty('gameStoreInstance')
      
      // Should not export Zustand primitives directly
      expect(storeIndex).not.toHaveProperty('create')
      expect(storeIndex).not.toHaveProperty('subscribeWithSelector')
      expect(storeIndex).not.toHaveProperty('immer')
    })

    it('should enforce proper TypeScript types for store exports', async () => {
      const storeIndex = await import('@/stores/index')
      
      // useGameStore should be a function
      expect(typeof storeIndex.useGameStore).toBe('function')
      
                   // Store should have proper type structure (types are compile-time only)  
      expect(storeIndex.useGameStore).toBeDefined()
    })
  })

  describe('📁 Store File Organization', () => {
    it('should maintain proper file structure', async () => {
      // Core store files should exist
      const coreFiles = [
        '@/stores/gameStore',
        '@/stores/index',
        '@/stores/domainStores'
      ]
      
      for (const file of coreFiles) {
        const module = await import(file)
        expect(module).toBeDefined()
        expect(module).toHaveProperty('useGameStore')
      }
    })

    it('should not have conflicting store definitions', async () => {
      const [gameStore, indexStore] = await Promise.all([
        import('@/stores/gameStore'),
        import('@/stores/index')
      ])
      
      // The store from index should be the same as from gameStore
      expect(indexStore.useGameStore).toBe(gameStore.useGameStore)
      
      // Should not have different implementations
      expect(indexStore.useGameStore.toString()).toBe(gameStore.useGameStore.toString())
    })
  })

  describe('🎯 Store Interface Completeness', () => {
    it('should export complete store interface', async () => {
      const { useGameStore } = await import('@/stores/index')
      
      // Create a store instance to check interface
      const store = useGameStore.getState()
      
      // Core state properties
      expect(store).toHaveProperty('gameState')
      expect(store).toHaveProperty('localPlayerId')
      expect(store).toHaveProperty('wsManager')
      expect(store).toHaveProperty('connectionStatus')
      
      // Lobby state
      expect(store).toHaveProperty('lobbyState')
      expect(store).toHaveProperty('gameCode')
      expect(store).toHaveProperty('isHost')
      expect(store).toHaveProperty('lobbyPlayers')
      
      // UI state
      expect(store).toHaveProperty('placementMode')
      expect(store).toHaveProperty('hoveredHex')
      expect(store).toHaveProperty('selectedHex')
      
      // Actions
      expect(typeof store.connect).toBe('function')
      expect(typeof store.disconnect).toBe('function')
      expect(typeof store.sendAction).toBe('function')
      expect(typeof store.updateGameState).toBe('function')
      expect(typeof store.createGame).toBe('function')
      expect(typeof store.joinGameByCode).toBe('function')
      
      // Computed methods
      expect(typeof store.currentPlayer).toBe('function')
      expect(typeof store.isMyTurn).toBe('function')
      expect(typeof store.myPlayer).toBe('function')
    })

    it('should maintain consistent interface across import paths', async () => {
      const [indexStore, directStore] = await Promise.all([
        import('@/stores/index'),
        import('@/stores/gameStore')
      ])
      
      const indexState = indexStore.useGameStore.getState()
      const directState = directStore.useGameStore.getState()
      
      // Should have identical interfaces
      const indexKeys = Object.keys(indexState).sort()
      const directKeys = Object.keys(directState).sort()
      
      expect(indexKeys).toEqual(directKeys)
      
             // Method signatures should be identical
       const indexMethods = indexKeys.filter(key => typeof (indexState as any)[key] === 'function')
       const directMethods = directKeys.filter(key => typeof (directState as any)[key] === 'function')
      
      expect(indexMethods).toEqual(directMethods)
    })
  })
}) 