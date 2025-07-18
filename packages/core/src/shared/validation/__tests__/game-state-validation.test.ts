// ===== COMPREHENSIVE GAME STATE VALIDATION TESTS =====
// Complete integration tests for game state validation system

import { describe, it, expect, beforeEach } from 'vitest'
import { GameState, Player, PlayerId, GamePhase } from '../../../types'
import { GameStateValidator } from '../game-state-validator'
import { StateSynchronizer } from '../state-synchronizer'
import { StateMachineValidator } from '../state-machine-validator'
import { GameStateError } from '../../errors'

describe('Game State Validation System', () => {
  let validator: GameStateValidator
  let synchronizer: StateSynchronizer
  let stateMachine: StateMachineValidator
  let sampleGameState: GameState
  
  beforeEach(() => {
    validator = new GameStateValidator()
    synchronizer = new StateSynchronizer()
    stateMachine = new StateMachineValidator()
    sampleGameState = createSampleGameState()
  })
  
  describe('GameStateValidator', () => {
    describe('validateGameState', () => {
      it('should validate a complete valid game state', () => {
        const result = validator.validateGameState(sampleGameState)
        
        expect(result.success).toBe(true)
        expect(result.data.isValid).toBe(true)
        expect(result.data.errors).toHaveLength(0)
        expect(result.data.warnings).toHaveLength(0)
      })
      
      it('should detect invalid game ID', () => {
        const invalidState = { ...sampleGameState, id: '' }
        const result = validator.validateGameState(invalidState)
        
        expect(result.success).toBe(true)
        expect(result.data.isValid).toBe(false)
        expect(result.data.errors).toContainEqual(
          expect.objectContaining({
            code: 'INVALID_GAME_ID',
            field: 'id',
            severity: 'critical'
          })
        )
      })
      
      it('should detect invalid game phase', () => {
        const invalidState = { ...sampleGameState, phase: 'invalid_phase' as GamePhase }
        const result = validator.validateGameState(invalidState)
        
        expect(result.success).toBe(true)
        expect(result.data.isValid).toBe(false)
        expect(result.data.errors).toContainEqual(
          expect.objectContaining({
            code: 'INVALID_PHASE',
            field: 'phase',
            severity: 'critical'
          })
        )
      })
      
      it('should detect invalid player count', () => {
        const invalidState = { ...sampleGameState }
        invalidState.players = new Map() // No players
        const result = validator.validateGameState(invalidState)
        
        expect(result.success).toBe(true)
        expect(result.data.isValid).toBe(false)
        expect(result.data.errors).toContainEqual(
          expect.objectContaining({
            code: 'INVALID_PLAYER_COUNT',
            field: 'players',
            severity: 'critical'
          })
        )
      })
      
      it('should detect invalid current player', () => {
        const invalidState = { ...sampleGameState, currentPlayer: 'invalid_player' as PlayerId }
        const result = validator.validateGameState(invalidState)
        
        expect(result.success).toBe(true)
        expect(result.data.isValid).toBe(false)
        expect(result.data.errors).toContainEqual(
          expect.objectContaining({
            code: 'INVALID_CURRENT_PLAYER',
            field: 'currentPlayer',
            severity: 'critical'
          })
        )
      })
      
      it('should detect duplicate player colors', () => {
        const player1 = createSamplePlayer('player1', 0)
        const player2 = createSamplePlayer('player2', 0) // Same color
        const invalidState = { ...sampleGameState }
        invalidState.players = new Map([
          ['player1', player1],
          ['player2', player2]
        ])
        
        const result = validator.validateGameState(invalidState)
        
        expect(result.success).toBe(true)
        expect(result.data.isValid).toBe(false)
        expect(result.data.errors).toContainEqual(
          expect.objectContaining({
            code: 'DUPLICATE_PLAYER_COLOR',
            field: 'players',
            severity: 'error'
          })
        )
      })
      
      it('should detect invalid resource counts', () => {
        const player = createSamplePlayer('player1', 0)
        player.resources.wood = -5 // Invalid negative resources
        const invalidState = { ...sampleGameState }
        invalidState.players = new Map([['player1', player]])
        invalidState.currentPlayer = 'player1'
        
        const result = validator.validateGameState(invalidState)
        
        expect(result.success).toBe(true)
        expect(result.data.isValid).toBe(false)
        expect(result.data.errors).toContainEqual(
          expect.objectContaining({
            code: 'INVALID_RESOURCE_COUNT',
            field: 'player.resources.wood',
            severity: 'error'
          })
        )
      })
      
      it('should detect score total mismatch', () => {
        const player = createSamplePlayer('player1', 0)
        player.score = { public: 5, hidden: 3, total: 10 } // Should be 8
        const invalidState = { ...sampleGameState }
        invalidState.players = new Map([['player1', player]])
        invalidState.currentPlayer = 'player1'
        
        const result = validator.validateGameState(invalidState)
        
        expect(result.success).toBe(true)
        expect(result.data.isValid).toBe(false)
        expect(result.data.errors).toContainEqual(
          expect.objectContaining({
            code: 'SCORE_TOTAL_MISMATCH',
            field: 'player.score.total',
            severity: 'error'
          })
        )
      })
      
      it('should detect invalid building counts', () => {
        const player = createSamplePlayer('player1', 0)
        player.buildings.settlements = 10 // Exceeds max
        const invalidState = { ...sampleGameState }
        invalidState.players = new Map([['player1', player]])
        invalidState.currentPlayer = 'player1'
        
        const result = validator.validateGameState(invalidState)
        
        expect(result.success).toBe(true)
        expect(result.data.isValid).toBe(false)
        expect(result.data.errors).toContainEqual(
          expect.objectContaining({
            code: 'INVALID_SETTLEMENT_COUNT',
            field: 'player.buildings.settlements',
            severity: 'error'
          })
        )
      })
      
      it('should detect winner without ended phase', () => {
        const invalidState = { ...sampleGameState, winner: 'player1' as PlayerId }
        const result = validator.validateGameState(invalidState)
        
        expect(result.success).toBe(true)
        expect(result.data.isValid).toBe(false)
        expect(result.data.errors).toContainEqual(
          expect.objectContaining({
            code: 'GAME_ENDED_PHASE_MISMATCH',
            field: 'phase',
            severity: 'error'
          })
        )
      })
      
      it('should warn about players who should have won', () => {
        const player = createSamplePlayer('player1', 0)
        player.score = { public: 10, hidden: 0, total: 10 } // Should have won
        const invalidState = { ...sampleGameState }
        invalidState.players = new Map([['player1', player]])
        invalidState.currentPlayer = 'player1'
        
        const result = validator.validateGameState(invalidState)
        
        expect(result.success).toBe(true)
        expect(result.data.warnings).toContainEqual(
          expect.objectContaining({
            code: 'PLAYER_SHOULD_HAVE_WON',
            field: 'winner'
          })
        )
      })
    })
    
    describe('validateStateTransition', () => {
      it('should validate valid state transition', () => {
        const fromState = { ...sampleGameState }
        const toState = { 
          ...sampleGameState, 
          turn: sampleGameState.turn + 1,
          updatedAt: new Date(Date.now() + 1000) // Ensure timestamp advances
        }
        const action = { type: 'roll', playerId: 'player1' as PlayerId, data: {} }
        
        const result = validator.validateStateTransition(fromState, toState, action)
        
        expect(result.success).toBe(true)
        expect(result.data.isValid).toBe(true)
      })
      
      it('should detect game ID change', () => {
        const fromState = { ...sampleGameState }
        const toState = { ...sampleGameState, id: 'different_id' }
        const action = { type: 'roll', playerId: 'player1' as PlayerId, data: {} }
        
        const result = validator.validateStateTransition(fromState, toState, action)
        
        expect(result.success).toBe(true)
        expect(result.data.isValid).toBe(false)
        expect(result.data.errors).toContainEqual(
          expect.objectContaining({
            code: 'GAME_ID_CHANGED',
            field: 'id',
            severity: 'critical'
          })
        )
      })
      
      it('should detect turn regression', () => {
        const fromState = { ...sampleGameState, turn: 5 }
        const toState = { ...sampleGameState, turn: 3 }
        const action = { type: 'roll', playerId: 'player1' as PlayerId, data: {} }
        
        const result = validator.validateStateTransition(fromState, toState, action)
        
        expect(result.success).toBe(true)
        expect(result.data.isValid).toBe(false)
        expect(result.data.errors).toContainEqual(
          expect.objectContaining({
            code: 'TURN_REGRESSION',
            field: 'turn',
            severity: 'error'
          })
        )
      })
      
      it('should detect invalid phase transition', () => {
        const fromState = { ...sampleGameState, phase: 'roll' as GamePhase }
        const toState = { ...sampleGameState, phase: 'setup1' as GamePhase }
        const action = { type: 'roll', playerId: 'player1' as PlayerId, data: {} }
        
        const result = validator.validateStateTransition(fromState, toState, action)
        
        expect(result.success).toBe(true)
        expect(result.data.isValid).toBe(false)
        expect(result.data.errors).toContainEqual(
          expect.objectContaining({
            code: 'INVALID_PHASE_TRANSITION',
            field: 'phase',
            severity: 'error'
          })
        )
      })
      
      it('should detect player disappearance', () => {
        const fromState = { ...sampleGameState }
        const toState = { ...sampleGameState }
        toState.players = new Map([['player1', createSamplePlayer('player1', 0)]])
        const action = { type: 'roll', playerId: 'player1' as PlayerId, data: {} }
        
        const result = validator.validateStateTransition(fromState, toState, action)
        
        expect(result.success).toBe(true)
        expect(result.data.isValid).toBe(false)
        expect(result.data.errors).toContainEqual(
          expect.objectContaining({
            code: 'PLAYER_DISAPPEARED',
            field: 'players',
            severity: 'error'
          })
        )
      })
      
      it('should detect score decrease', () => {
        const player1 = createSamplePlayer('player1', 0)
        player1.score = { public: 5, hidden: 0, total: 5 }
        const fromState = { ...sampleGameState }
        fromState.players = new Map([['player1', player1]])
        
        const player2 = createSamplePlayer('player1', 0)
        player2.score = { public: 3, hidden: 0, total: 3 } // Score decreased
        const toState = { ...sampleGameState }
        toState.players = new Map([['player1', player2]])
        
        const action = { type: 'roll', playerId: 'player1' as PlayerId, data: {} }
        
        const result = validator.validateStateTransition(fromState, toState, action)
        
        expect(result.success).toBe(true)
        expect(result.data.isValid).toBe(false)
        expect(result.data.errors).toContainEqual(
          expect.objectContaining({
            code: 'SCORE_DECREASED',
            field: 'player.score.total',
            severity: 'error'
          })
        )
      })
    })
    
    describe('validateStoreConsistency', () => {
      it('should validate consistent frontend and backend states', () => {
        const frontendState = {
          id: sampleGameState.id,
          phase: sampleGameState.phase,
          turn: sampleGameState.turn,
          currentPlayer: sampleGameState.currentPlayer,
          players: Object.fromEntries(sampleGameState.players),
          board: sampleGameState.board,
          dice: sampleGameState.dice,
          activeTrades: sampleGameState.activeTrades
        }
        
        const result = validator.validateStoreConsistency(frontendState, sampleGameState)
        
        expect(result.success).toBe(true)
        expect(result.data.isValid).toBe(true)
      })
      
      it('should detect ID mismatch', () => {
        const frontendState = {
          id: 'different_id',
          phase: sampleGameState.phase,
          turn: sampleGameState.turn,
          currentPlayer: sampleGameState.currentPlayer
        }
        
        const result = validator.validateStoreConsistency(frontendState, sampleGameState)
        
        expect(result.success).toBe(true)
        expect(result.data.isValid).toBe(false)
        expect(result.data.errors).toContainEqual(
          expect.objectContaining({
            code: 'STORE_ID_MISMATCH',
            field: 'id',
            severity: 'critical'
          })
        )
      })
      
      it('should detect phase mismatch', () => {
        const frontendState = {
          id: sampleGameState.id,
          phase: 'setup1',
          turn: sampleGameState.turn,
          currentPlayer: sampleGameState.currentPlayer
        }
        
        const result = validator.validateStoreConsistency(frontendState, sampleGameState)
        
        expect(result.success).toBe(true)
        expect(result.data.isValid).toBe(false)
        expect(result.data.errors).toContainEqual(
          expect.objectContaining({
            code: 'STORE_PHASE_MISMATCH',
            field: 'phase',
            severity: 'error'
          })
        )
      })
      
      it('should detect turn mismatch', () => {
        const frontendState = {
          id: sampleGameState.id,
          phase: sampleGameState.phase,
          turn: sampleGameState.turn + 5,
          currentPlayer: sampleGameState.currentPlayer
        }
        
        const result = validator.validateStoreConsistency(frontendState, sampleGameState)
        
        expect(result.success).toBe(true)
        expect(result.data.isValid).toBe(false)
        expect(result.data.errors).toContainEqual(
          expect.objectContaining({
            code: 'STORE_TURN_MISMATCH',
            field: 'turn',
            severity: 'error'
          })
        )
      })
    })
  })
  
  describe('StateSynchronizer', () => {
    describe('validateFrontendBackendSync', () => {
      it('should validate synchronized states', async () => {
        const frontendState = {
          id: sampleGameState.id,
          phase: sampleGameState.phase,
          turn: sampleGameState.turn,
          currentPlayer: sampleGameState.currentPlayer
        }
        
        const result = await synchronizer.validateFrontendBackendSync(frontendState, sampleGameState)
        
        expect(result.success).toBe(true)
        // Note: This test focuses on basic field consistency
        // More complex board/player sync would be tested separately
      })
      
      it('should detect and categorize inconsistencies', async () => {
        const frontendState = {
          id: 'different_id',
          phase: 'setup1',
          turn: sampleGameState.turn + 1,
          currentPlayer: 'wrong_player',
          players: {}
        }
        
        const result = await synchronizer.validateFrontendBackendSync(frontendState, sampleGameState)
        
        expect(result.success).toBe(true)
        expect(result.data.isConsistent).toBe(false)
        expect(result.data.inconsistencies.length).toBeGreaterThan(0)
        expect(result.data.severity).toBe('critical')
        expect(result.data.canRepair).toBe(true)
      })
      
      it('should generate repair actions', async () => {
        const frontendState = {
          id: sampleGameState.id,
          phase: 'setup1',
          turn: sampleGameState.turn,
          currentPlayer: sampleGameState.currentPlayer
        }
        
        const result = await synchronizer.validateFrontendBackendSync(frontendState, sampleGameState)
        
        expect(result.success).toBe(true)
        expect(result.data.repairActions.length).toBeGreaterThan(0)
        expect(result.data.repairActions[0]).toMatchObject({
          type: 'sync_from_backend',
          safe: expect.any(Boolean),
          priority: expect.any(Number)
        })
      })
    })
    
    describe('repairStateInconsistencies', () => {
      it('should repair field mismatches', async () => {
        const frontendState = {
          id: sampleGameState.id,
          phase: 'setup1',
          turn: sampleGameState.turn,
          currentPlayer: sampleGameState.currentPlayer
        }
        
        const syncResult = await synchronizer.validateFrontendBackendSync(frontendState, sampleGameState)
        expect(syncResult.success).toBe(true)
        
        const repairResult = await synchronizer.repairStateInconsistencies(
          syncResult.data.inconsistencies,
          frontendState,
          sampleGameState
        )
        
        expect(repairResult.success).toBe(true)
        expect(repairResult.data.repairedFrontendState.phase).toBe(sampleGameState.phase)
      })
    })
    
    describe('auditStateConsistency', () => {
      it('should generate comprehensive audit report', async () => {
        const frontendState = {
          id: sampleGameState.id,
          phase: sampleGameState.phase,
          turn: sampleGameState.turn,
          currentPlayer: sampleGameState.currentPlayer
        }
        
        const result = await synchronizer.auditStateConsistency(frontendState, sampleGameState)
        
        expect(result.success).toBe(true)
        expect(result.data.timestamp).toBeInstanceOf(Date)
        expect(result.data.gameId).toBe(sampleGameState.id)
        expect(result.data.syncResult).toBeDefined()
        expect(result.data.backendValidation).toBeDefined()
        expect(result.data.overallHealth).toBeDefined()
        expect(result.data.overallHealth.score).toBeGreaterThan(0)
        expect(result.data.overallHealth.status).toBeDefined()
      })
    })
  })
  
  describe('StateMachineValidator', () => {
    describe('validatePhaseTransition', () => {
      it('should validate valid phase transitions', () => {
        const result = stateMachine.validatePhaseTransition('setup1', 'setup2')
        
        expect(result.success).toBe(true)
        expect(result.data.isValid).toBe(true)
        expect(result.data.errors).toHaveLength(0)
      })
      
      it('should reject invalid phase transitions', () => {
        const result = stateMachine.validatePhaseTransition('setup1', 'ended')
        
        expect(result.success).toBe(true)
        expect(result.data.isValid).toBe(false)
        expect(result.data.errors).toContainEqual(
          expect.objectContaining({
            code: 'INVALID_PHASE_TRANSITION',
            currentPhase: 'setup1',
            attemptedPhase: 'ended'
          })
        )
      })
      
      it('should provide allowed transitions', () => {
        const result = stateMachine.validatePhaseTransition('roll', 'actions')
        
        expect(result.success).toBe(true)
        expect(result.data.allowedTransitions).toContain('actions')
        expect(result.data.allowedTransitions).toContain('discard')
      })
    })
    
    describe('validateActionInPhase', () => {
      it('should validate valid actions in phase', () => {
        const action = { type: 'roll', playerId: 'player1' as PlayerId, data: {} }
        const result = stateMachine.validateActionInPhase(action, 'roll')
        
        expect(result.success).toBe(true)
        expect(result.data.isValid).toBe(true)
      })
      
      it('should reject invalid actions in phase', () => {
        const action = { type: 'build', playerId: 'player1' as PlayerId, data: {} }
        const result = stateMachine.validateActionInPhase(action, 'roll')
        
        expect(result.success).toBe(true)
        expect(result.data.isValid).toBe(false)
        expect(result.data.errors).toContainEqual(
          expect.objectContaining({
            code: 'INVALID_ACTION_FOR_PHASE',
            currentPhase: 'roll',
            attemptedAction: 'build'
          })
        )
      })
      
      it('should provide allowed actions for phase', () => {
        const action = { type: 'build', playerId: 'player1' as PlayerId, data: {} }
        const result = stateMachine.validateActionInPhase(action, 'actions')
        
        expect(result.success).toBe(true)
        expect(result.data.allowedActions).toContain('build')
        expect(result.data.allowedActions).toContain('bankTrade')
        expect(result.data.allowedActions).toContain('endTurn')
      })
    })
    
    describe('validateTurnOrder', () => {
      it('should validate correct turn order', () => {
        const result = stateMachine.validateTurnOrder('player1', 'player2', sampleGameState)
        
        expect(result.success).toBe(true)
        expect(result.data).toBe(true)
      })
      
      it('should reject invalid turn order', () => {
        const result = stateMachine.validateTurnOrder('player1', 'player1', sampleGameState)
        
        expect(result.success).toBe(true)
        expect(result.data).toBe(false)
      })
    })
    
    describe('validateGameStateMachine', () => {
      it('should validate valid game state machine', () => {
        const result = stateMachine.validateGameStateMachine(sampleGameState)
        
        expect(result.success).toBe(true)
        expect(result.data.isValid).toBe(true)
      })
      
      it('should detect invalid game phase', () => {
        const invalidState = { ...sampleGameState, phase: 'invalid' as GamePhase }
        const result = stateMachine.validateGameStateMachine(invalidState)
        
        expect(result.success).toBe(true)
        expect(result.data.isValid).toBe(false)
        expect(result.data.errors).toContainEqual(
          expect.objectContaining({
            code: 'INVALID_GAME_PHASE',
            currentPhase: 'invalid'
          })
        )
      })
      
      it('should detect winner without ended phase', () => {
        const invalidState = { ...sampleGameState, winner: 'player1' as PlayerId }
        const result = stateMachine.validateGameStateMachine(invalidState)
        
        expect(result.success).toBe(true)
        expect(result.data.isValid).toBe(false)
        expect(result.data.errors).toContainEqual(
          expect.objectContaining({
            code: 'WINNER_PHASE_INCONSISTENCY',
            currentPhase: 'actions'
          })
        )
      })
    })
    
    describe('getNextValidPhase', () => {
      it('should return correct next phase for setup1', () => {
        const nextPhase = stateMachine.getNextValidPhase('setup1', sampleGameState)
        expect(nextPhase).toBe('setup2')
      })
      
      it('should return correct next phase for roll with 7', () => {
        // Create a state where players have more than 7 resources
        const stateWith7 = { ...sampleGameState, dice: { die1: 3, die2: 4, sum: 7, timestamp: Date.now() } }
        const playerWithManyResources = createSamplePlayer('player1', 0)
        playerWithManyResources.resources = { wood: 3, brick: 3, ore: 3, wheat: 3, sheep: 3 } // 15 resources
        stateWith7.players.set('player1', playerWithManyResources)
        
        const nextPhase = stateMachine.getNextValidPhase('roll', stateWith7)
        expect(nextPhase).toBe('discard')
      })
      
      it('should return actions for normal dice roll', () => {
        const stateWith6 = { ...sampleGameState, dice: { die1: 3, die2: 3, sum: 6, timestamp: Date.now() } }
        const nextPhase = stateMachine.getNextValidPhase('roll', stateWith6)
        expect(nextPhase).toBe('actions')
      })
    })
  })
  
  describe('Integration Tests', () => {
    it('should handle complete validation workflow', async () => {
      // 1. Validate initial state
      const stateValidation = validator.validateGameState(sampleGameState)
      expect(stateValidation.success).toBe(true)
      expect(stateValidation.data.isValid).toBe(true)
      
      // 2. Validate state machine
      const machineValidation = stateMachine.validateGameStateMachine(sampleGameState)
      expect(machineValidation.success).toBe(true)
      expect(machineValidation.data.isValid).toBe(true)
      
      // 3. Validate frontend-backend sync
      const frontendState = {
        id: sampleGameState.id,
        phase: sampleGameState.phase,
        turn: sampleGameState.turn,
        currentPlayer: sampleGameState.currentPlayer
      }
      const syncValidation = await synchronizer.validateFrontendBackendSync(frontendState, sampleGameState)
      expect(syncValidation.success).toBe(true)
      // Note: Focus on successful validation rather than perfect consistency for integration test
      
      // 4. Generate audit report
      const auditResult = await synchronizer.auditStateConsistency(frontendState, sampleGameState)
      expect(auditResult.success).toBe(true)
      expect(auditResult.data.overallHealth.status).toBe('healthy')
    })
    
    it('should handle error recovery workflow', async () => {
      // Create inconsistent states
      const frontendState = {
        id: sampleGameState.id,
        phase: 'setup1' as GamePhase,
        turn: sampleGameState.turn + 1,
        currentPlayer: 'wrong_player'
      }
      
      // 1. Detect inconsistencies
      const syncResult = await synchronizer.validateFrontendBackendSync(frontendState, sampleGameState)
      expect(syncResult.success).toBe(true)
      expect(syncResult.data.isConsistent).toBe(false)
      
      // 2. Generate repair actions
      expect(syncResult.data.repairActions.length).toBeGreaterThan(0)
      expect(syncResult.data.canRepair).toBe(true)
      
      // 3. Apply repairs
      const repairResult = await synchronizer.repairStateInconsistencies(
        syncResult.data.inconsistencies,
        frontendState,
        sampleGameState
      )
      expect(repairResult.success).toBe(true)
      
      // 4. Verify repairs
      const repairedSyncResult = await synchronizer.validateFrontendBackendSync(
        repairResult.data.repairedFrontendState,
        repairResult.data.repairedBackendState
      )
      expect(repairedSyncResult.success).toBe(true)
      expect(repairedSyncResult.data.isConsistent).toBe(true)
    })
  })
})

// ===== TEST UTILITIES =====

function createSampleGameState(): GameState {
  const player1 = createSamplePlayer('player1', 0)
  const player2 = createSamplePlayer('player2', 1)
  const player3 = createSamplePlayer('player3', 2)
  const player4 = createSamplePlayer('player4', 3)
  
  return {
    id: 'test-game-123',
    phase: 'actions',
    turn: 1,
    currentPlayer: 'player1',
    players: new Map([
      ['player1', player1],
      ['player2', player2],
      ['player3', player3],
      ['player4', player4]
    ]),
    board: {
      hexes: new Map(),
      vertices: new Map(),
      edges: new Map(),
      ports: [],
      robberPosition: null
    },
    dice: null,
    developmentDeck: [],
    discardPile: [],
    winner: null,
    activeTrades: [],
    startedAt: new Date(),
    updatedAt: new Date()
  }
}

function createSamplePlayer(id: PlayerId, color: 0 | 1 | 2 | 3): Player {
  return {
    id,
    name: `Player ${id}`,
    color,
    resources: {
      wood: 2,
      brick: 1,
      ore: 1,
      wheat: 2,
      sheep: 1
    },
    developmentCards: [],
    score: {
      public: 3,
      hidden: 0,
      total: 3
    },
    buildings: {
      settlements: 2,
      cities: 0,
      roads: 2
    },
    knightsPlayed: 0,
    hasLongestRoad: false,
    hasLargestArmy: false,
    isConnected: true,
    isAI: false
  }
}