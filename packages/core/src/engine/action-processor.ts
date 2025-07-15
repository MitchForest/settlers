// Action processor - handles state mutations with event sourcing
// All state changes are immutable and produce events for audit/replay

import {
  GameState,
  GameAction,
  GameEvent,
  GameEventType,
  Player,
  PlayerId,
  ResourceCards,
  DevelopmentCard,
  Building,
  Connection,
  Trade,
  GamePhase,
  DiceRoll,
  EdgePosition
} from '../types'
import {
  BUILDING_COSTS,
  VICTORY_POINTS,
  GAME_RULES,
  DEVELOPMENT_CARD_COUNTS,
  SUCCESS_MESSAGES
} from '../constants'
import {
  rollDice,
  subtractResources,
  addResources,
  createEmptyResources,
  getTotalResources,
  calculateDiscardCount,
  hexToString,
  randomChoice,
  shuffleArray
} from '../calculations'
import * as validator from './state-validator'

// Result of processing an action
export interface ProcessResult {
  success: boolean
  newState: GameState
  events: GameEvent[]
  error?: string
  message?: string
}

// Main action processor - pure function, no side effects
export function processAction(
  state: GameState,
  action: GameAction
): ProcessResult {
  // Validate action first
  const validation = validateAction(state, action)
  if (!validation.isValid) {
    return {
      success: false,
      newState: state,
      events: [],
      error: validation.reason
    }
  }

  // Process based on action type
  switch (action.type) {
    case 'roll':
      return processRollDice(state, action)
    case 'placeSettlement':
      return processPlaceSettlement(state, action)
    case 'placeConnection':
      return processPlaceConnection(state, action)
    case 'build':
      return processBuildAction(state, action)
    case 'trade':
      return processTradeAction(state, action)
    case 'playCard':
      return processPlayCard(state, action)
    case 'moveBlocker':
      return processMoveBlocker(state, action)
    case 'stealResource':
      return processStealResource(state, action)
    case 'discard':
      return processDiscard(state, action)
    case 'endTurn':
      return processEndTurn(state, action)
    default:
      return {
        success: false,
        newState: state,
        events: [],
        error: 'Unknown action type'
      }
  }
}

// ============= Action Validators =============

function validateAction(state: GameState, action: GameAction): { isValid: boolean; reason?: string } {
  // Basic validation - is it player's turn?
  if (action.type !== 'discard' && !validator.isPlayerTurn(state, action.playerId)) {
    return { isValid: false, reason: 'Not your turn' }
  }

  // Action-specific validation
  switch (action.type) {
    case 'roll':
      return validator.canPerformAction(state, action.playerId, 'roll')
    case 'placeSettlement':
      return validator.canPlaceSettlement(state, action.playerId, action.data.vertexId)
    case 'placeConnection':
      return validator.canPlaceConnection(state, action.playerId, action.data.edgeId)
    case 'moveBlocker':
      return validator.canMoveBlocker(state, action.playerId, action.data.hexId)
    case 'stealResource':
      return validator.canStealFrom(state, action.playerId, action.data.targetId)
    case 'discard':
      return validator.canDiscard(state, action.playerId, action.data.resources)
    default:
      return { isValid: true }
  }
}

// ============= Roll Dice =============

function processRollDice(state: GameState, action: GameAction): ProcessResult {
  const dice = rollDice()
  const events: GameEvent[] = []
  let newState = { ...state }

  // Create dice rolled event
  events.push(createEvent(state, 'diceRolled', action.playerId, { dice }))

  // Update state with dice
  newState.dice = dice

  if (dice.sum === 7) {
    // Handle robber - check who needs to discard
    const playersToDiscard: PlayerId[] = []
    
    state.players.forEach((player, playerId) => {
      const total = getTotalResources(player.resources)
      if (total > GAME_RULES.handLimitBeforeDiscard) {
        playersToDiscard.push(playerId)
      }
    })

    if (playersToDiscard.length > 0) {
      newState.phase = 'discard'
      newState.discardingPlayers = playersToDiscard
    } else {
      newState.phase = 'moveBlocker'
    }
  } else {
    // Distribute resources
    const distribution = calculateResourceDistribution(state, dice.sum)
    newState = distributeResources(newState, distribution)
    
    if (distribution.size > 0) {
      events.push(createEvent(state, 'resourcesDistributed', undefined, { 
        dice: dice.sum, 
        distribution: Object.fromEntries(distribution) 
      }))
    }

    // Move to actions phase
    newState.phase = 'actions'
  }

  return {
    success: true,
    newState,
    events,
    message: `Rolled ${dice.die1} + ${dice.die2} = ${dice.sum}`
  }
}

// ============= Place Settlement =============

function processPlaceSettlement(state: GameState, action: GameAction): ProcessResult {
  const { vertexId } = action.data
  const player = state.players.get(action.playerId)!
  const events: GameEvent[] = []
  
  // Deep clone state for immutability
  let newState = deepCloneState(state)
  
  // Place the settlement
  const vertex = newState.board.vertices.get(vertexId)!
  vertex.building = {
    type: 'settlement',
    owner: action.playerId,
    position: vertex.position
  }

  // Update player's building inventory
  const newPlayer = { ...player }
  newPlayer.buildings.settlements -= 1
  
  // Deduct resources (unless in setup)
  if (state.phase !== 'setup1' && state.phase !== 'setup2') {
    newPlayer.resources = subtractResources(
      newPlayer.resources,
      BUILDING_COSTS.settlement
    )
  }
  
  // Update score
  newPlayer.score = {
    ...newPlayer.score,
    public: newPlayer.score.public + VICTORY_POINTS.settlement
  }
  
  newState.players.set(action.playerId, newPlayer)

  // Create event
  events.push(createEvent(state, 'buildingPlaced', action.playerId, {
    type: 'settlement',
    vertexId,
    position: vertex.position
  }))

  // Check for victory
  newState = checkVictoryCondition(newState)

  // Handle setup phase resource distribution
  if (state.phase === 'setup2') {
    const resources = collectSetupResources(newState, vertexId)
    if (Object.values(resources).some(v => v > 0)) {
      const updatedPlayer = { ...newState.players.get(action.playerId)! }
      updatedPlayer.resources = addResources(updatedPlayer.resources, resources)
      newState.players.set(action.playerId, updatedPlayer)
      
      events.push(createEvent(state, 'resourcesDistributed', action.playerId, { resources }))
    }
  }

  return {
    success: true,
    newState,
    events,
    message: SUCCESS_MESSAGES.buildingPlaced
  }
}

// ============= Place Connection =============

function processPlaceConnection(state: GameState, action: GameAction): ProcessResult {
  const { edgeId } = action.data
  const player = state.players.get(action.playerId)!
  const events: GameEvent[] = []
  
  let newState = deepCloneState(state)
  
  // Place the connection
  const edge = newState.board.edges.get(edgeId)!
  edge.connection = {
    owner: action.playerId,
    position: edge.position
  }

  // Update player
  const newPlayer = { ...player }
  newPlayer.buildings.connections -= 1
  
  // Deduct resources (unless in setup)
  if (state.phase !== 'setup1' && state.phase !== 'setup2') {
    newPlayer.resources = subtractResources(
      newPlayer.resources,
      BUILDING_COSTS.connection
    )
  }
  
  newState.players.set(action.playerId, newPlayer)

  // Create event
  events.push(createEvent(state, 'connectionBuilt', action.playerId, {
    edgeId,
    position: edge.position as EdgePosition
  }))

  // Check for longest path
  newState = updateLongestPath(newState)

  // Check for victory
  newState = checkVictoryCondition(newState)

  // Handle setup phase progression
  if (state.phase === 'setup1' || state.phase === 'setup2') {
    newState = progressSetupPhase(newState)
  }

  return {
    success: true,
    newState,
    events,
    message: 'Connection built'
  }
}

// ============= Build Action (City) =============

function processBuildAction(state: GameState, action: GameAction): ProcessResult {
  const { buildingType, location } = action.data
  
  if (buildingType === 'city') {
    return processUpgradeToCity(state, action.playerId, location)
  }
  
  // Other building types would be handled here
  return {
    success: false,
    newState: state,
    events: [],
    error: 'Unknown building type'
  }
}

function processUpgradeToCity(state: GameState, playerId: PlayerId, vertexId: string): ProcessResult {
  const player = state.players.get(playerId)!
  const events: GameEvent[] = []
  
  let newState = deepCloneState(state)
  
  // Upgrade the settlement
  const vertex = newState.board.vertices.get(vertexId)!
  vertex.building = {
    type: 'city',
    owner: playerId,
    position: vertex.position
  }

  // Update player
  const newPlayer = { ...player }
  newPlayer.buildings.settlements += 1  // Return settlement to inventory
  newPlayer.buildings.cities -= 1
  newPlayer.resources = subtractResources(newPlayer.resources, BUILDING_COSTS.city)
  
  // Update score (city worth 2, settlement was worth 1, so +1)
  newPlayer.score = {
    ...newPlayer.score,
    public: newPlayer.score.public + 1
  }
  
  newState.players.set(playerId, newPlayer)

  // Create event
  events.push(createEvent(state, 'buildingPlaced', playerId, {
    type: 'city',
    vertexId,
    position: vertex.position
  }))

  // Check for victory
  newState = checkVictoryCondition(newState)

  return {
    success: true,
    newState,
    events,
    message: 'City built'
  }
}

// ============= Trade Action =============

function processTradeAction(state: GameState, action: GameAction): ProcessResult {
  const trade = action.data.trade as Trade
  const events: GameEvent[] = []
  
  let newState = deepCloneState(state)
  
  if (trade.to === 'bank' || trade.to === 'port') {
    // Maritime trade
    return processMaritimeTrade(newState, action.playerId, trade)
  } else {
    // Player trade - just record the proposal
    newState.trades.push({
      ...trade,
      id: generateId(),
      status: 'pending',
      createdAt: Date.now()
    })
    
    events.push(createEvent(state, 'tradeProposed', action.playerId, { trade }))
    
    return {
      success: true,
      newState,
      events,
      message: 'Trade proposed'
    }
  }
}

function processMaritimeTrade(state: GameState, playerId: PlayerId, trade: Trade): ProcessResult {
  const player = state.players.get(playerId)!
  const events: GameEvent[] = []
  
  // Calculate trade ratio
  const ratio = trade.to === 'port' ? 
    GAME_RULES.specialPortRatio : 
    GAME_RULES.bankTradeRatio
  
  // Execute trade
  const newPlayer = { ...player }
  newPlayer.resources = subtractResources(newPlayer.resources, trade.offering)
  newPlayer.resources = addResources(newPlayer.resources, trade.requesting)
  
  const newState = { ...state }
  newState.players.set(playerId, newPlayer)
  
  events.push(createEvent(state, 'tradeCompleted', playerId, { trade }))
  
  return {
    success: true,
    newState,
    events,
    message: SUCCESS_MESSAGES.tradeCompleted
  }
}

// ============= Play Development Card =============

function processPlayCard(state: GameState, action: GameAction): ProcessResult {
  const { cardId } = action.data
  const player = state.players.get(action.playerId)!
  const card = player.developmentCards.find(c => c.id === cardId)!
  
  let newState = deepCloneState(state)
  const events: GameEvent[] = []
  
  // Mark card as played
  const newPlayer = { ...player }
  const cardIndex = newPlayer.developmentCards.findIndex(c => c.id === cardId)
  newPlayer.developmentCards[cardIndex] = {
    ...card,
    playedTurn: state.turn
  }
  
  // Process card effect
  switch (card.type) {
    case 'knight':
      newPlayer.knightsPlayed += 1
      newState.phase = 'moveBlocker'
      newState = updateLargestArmy(newState)
      break
      
    case 'progress1': // Road Building
      // Would need UI to select where to build 2 roads
      break
      
    case 'progress2': // Year of Plenty
      // Would need UI to select 2 resources
      break
      
    case 'progress3': // Monopoly
      // Would need UI to select resource type
      break
      
    case 'victory':
      newPlayer.score = {
        ...newPlayer.score,
        hidden: newPlayer.score.hidden + VICTORY_POINTS.developmentCard
      }
      break
  }
  
  newState.players.set(action.playerId, newPlayer)
  
  events.push(createEvent(state, 'cardPlayed', action.playerId, { 
    cardType: card.type,
    cardId 
  }))
  
  // Check for victory
  newState = checkVictoryCondition(newState)
  
  return {
    success: true,
    newState,
    events,
    message: SUCCESS_MESSAGES.cardPurchased
  }
}

// ============= Move Blocker =============

function processMoveBlocker(state: GameState, action: GameAction): ProcessResult {
  const { hexId } = action.data
  const events: GameEvent[] = []
  
  let newState = deepCloneState(state)
  
  // Update blocker position
  const targetHex = newState.board.hexes.find(hex => hex.id === hexId)!
  newState.board.blockerPosition = targetHex.position
  
  // Update hex states
  newState.board.hexes.forEach(hex => {
    hex.hasBlocker = hexToString(hex.position) === hexId
  })
  
  events.push(createEvent(state, 'blockerMoved', action.playerId, {
    from: state.board.blockerPosition,
    to: targetHex.position
  }))
  
  // Move to steal phase
  newState.phase = 'steal'
  
  return {
    success: true,
    newState,
    events,
    message: 'Blocker moved'
  }
}

// ============= Steal Resource =============

function processStealResource(state: GameState, action: GameAction): ProcessResult {
  const { targetId } = action.data
  const thief = state.players.get(action.playerId)!
  const target = state.players.get(targetId)!
  const events: GameEvent[] = []
  
  let newState = deepCloneState(state)
  
  // Get random resource from target
  const targetResources: string[] = []
  Object.entries(target.resources).forEach(([resource, count]) => {
    for (let i = 0; i < count; i++) {
      targetResources.push(resource)
    }
  })
  
  if (targetResources.length > 0) {
    const stolenResource = randomChoice(targetResources)!
    
    // Transfer resource
    const newThief = { ...thief }
    const newTarget = { ...target }
    
    newTarget.resources[stolenResource as keyof ResourceCards] -= 1
    newThief.resources[stolenResource as keyof ResourceCards] += 1
    
    newState.players.set(action.playerId, newThief)
    newState.players.set(targetId, newTarget)
    
    events.push(createEvent(state, 'resourceStolen', action.playerId, {
      targetId,
      resource: stolenResource
    }))
  }
  
  // Move to actions phase
  newState.phase = 'actions'
  
  return {
    success: true,
    newState,
    events,
    message: 'Resource stolen'
  }
}

// ============= Discard =============

function processDiscard(state: GameState, action: GameAction): ProcessResult {
  const { resources } = action.data
  const player = state.players.get(action.playerId)!
  const events: GameEvent[] = []
  
  let newState = deepCloneState(state)
  
  // Discard resources
  const newPlayer = { ...player }
  newPlayer.resources = subtractResources(newPlayer.resources, resources)
  newState.players.set(action.playerId, newPlayer)
  
  // Remove from discarding list
  newState.discardingPlayers = newState.discardingPlayers?.filter(
    id => id !== action.playerId
  ) || []
  
  // Check if all players have discarded
  if (newState.discardingPlayers.length === 0) {
    newState.phase = 'moveBlocker'
  }
  
  return {
    success: true,
    newState,
    events,
    message: 'Resources discarded'
  }
}

// ============= End Turn =============

function processEndTurn(state: GameState, action: GameAction): ProcessResult {
  const events: GameEvent[] = []
  let newState = deepCloneState(state)
  
  // Move to next player
  newState.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.playerOrder.length
  newState.turn += 1
  newState.phase = 'roll'
  newState.dice = null
  
  events.push(createEvent(state, 'turnEnded', action.playerId, {
    nextPlayer: newState.playerOrder[newState.currentPlayerIndex]
  }))
  
  return {
    success: true,
    newState,
    events,
    message: SUCCESS_MESSAGES.turnEnded
  }
}

// ============= Helper Functions =============

function createEvent(
  state: GameState,
  type: GameEventType,
  playerId?: PlayerId,
  data: any = {}
): GameEvent {
  return {
    id: generateId(),
    gameId: state.id,
    type,
    playerId,
    data,
    timestamp: Date.now()
  }
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

function deepCloneState(state: GameState): GameState {
  // Deep clone with proper Map handling
  return {
    ...state,
    board: {
      ...state.board,
      hexes: [...state.board.hexes], // Clone array
      vertices: new Map(state.board.vertices),
      edges: new Map(state.board.edges)
    },
    players: new Map(state.players),
    playerOrder: [...state.playerOrder],
    developmentDeck: [...state.developmentDeck],
    trades: [...state.trades]
  }
}

function calculateResourceDistribution(
  state: GameState,
  diceSum: number
): Map<PlayerId, Partial<ResourceCards>> {
  const distribution = new Map<PlayerId, Partial<ResourceCards>>()
  
  // Find all hexes with this number
  state.board.hexes.forEach(hex => {
    if (hex.numberToken === diceSum && !hex.hasBlocker) {
      // Find all buildings adjacent to this hex
      // (Simplified - would need proper adjacency check)
      state.board.vertices.forEach(vertex => {
        if (vertex.building) {
          const playerId = vertex.building.owner
          const resourceType = getResourceForTerrain(hex.terrain)
          
          if (resourceType) {
            const current = distribution.get(playerId) || createEmptyResources()
            const amount = vertex.building.type === 'city' ? 2 : 1
            current[resourceType] = (current[resourceType] || 0) + amount
            distribution.set(playerId, current)
          }
        }
      })
    }
  })
  
  return distribution
}

function distributeResources(
  state: GameState,
  distribution: Map<PlayerId, Partial<ResourceCards>>
): GameState {
  const newState = { ...state }
  
  distribution.forEach((resources, playerId) => {
    const player = newState.players.get(playerId)!
    const newPlayer = {
      ...player,
      resources: addResources(player.resources, resources)
    }
    newState.players.set(playerId, newPlayer)
  })
  
  return newState
}

function getResourceForTerrain(terrain: string): keyof ResourceCards | null {
  const terrainToResource: Record<string, keyof ResourceCards> = {
    terrain1: 'resource1',  // Forest -> Lumber
    terrain2: 'resource2',  // Pasture -> Wool
    terrain3: 'resource3',  // Fields -> Grain
    terrain4: 'resource4',  // Hills -> Brick
    terrain5: 'resource5',  // Mountains -> Ore
  }
  return terrainToResource[terrain] || null
}

function collectSetupResources(state: GameState, vertexId: string): Partial<ResourceCards> {
  const resources: Partial<ResourceCards> = {}
  
  // Find hexes adjacent to this vertex
  // (Simplified - would need proper adjacency check)
  state.board.hexes.forEach(hex => {
    const resourceType = getResourceForTerrain(hex.terrain)
    if (resourceType) {
      resources[resourceType] = (resources[resourceType] || 0) + 1
    }
  })
  
  return resources
}

function updateLongestPath(state: GameState): GameState {
  // Calculate longest path for each player
  // (Simplified - would need graph algorithm)
  let longestPlayer: PlayerId | null = null
  let longestLength = 0
  
  state.players.forEach((player, playerId) => {
    const pathLength = 5 // TODO: Calculate actual path length
    if (pathLength >= GAME_RULES.longestPathMinimum && pathLength > longestLength) {
      longestPlayer = playerId
      longestLength = pathLength
    }
  })
  
  // Update longest path holder
  const newState = { ...state }
  newState.players.forEach((player, playerId) => {
    const hasLongest = playerId === longestPlayer
    if (player.hasLongestPath !== hasLongest) {
      const newPlayer = { ...player, hasLongestPath: hasLongest }
      newPlayer.score = {
        ...newPlayer.score,
        public: newPlayer.score.public + (hasLongest ? 2 : -2)
      }
      newState.players.set(playerId, newPlayer)
    }
  })
  
  return newState
}

function updateLargestArmy(state: GameState): GameState {
  // Find player with most knights
  let largestPlayer: PlayerId | null = null
  let largestCount = 0
  
  state.players.forEach((player, playerId) => {
    if (player.knightsPlayed >= GAME_RULES.largestForceMinimum && 
        player.knightsPlayed > largestCount) {
      largestPlayer = playerId
      largestCount = player.knightsPlayed
    }
  })
  
  // Update largest army holder
  const newState = { ...state }
  newState.players.forEach((player, playerId) => {
    const hasLargest = playerId === largestPlayer
    if (player.hasLargestForce !== hasLargest) {
      const newPlayer = { ...player, hasLargestForce: hasLargest }
      newPlayer.score = {
        ...newPlayer.score,
        public: newPlayer.score.public + (hasLargest ? 2 : -2)
      }
      newState.players.set(playerId, newPlayer)
    }
  })
  
  return newState
}

function checkVictoryCondition(state: GameState): GameState {
  const newState = { ...state }
  
  state.players.forEach((player, playerId) => {
    const totalScore = player.score.public + player.score.hidden
    if (totalScore >= state.settings.victoryPoints && !state.winner) {
      newState.winner = playerId
      newState.phase = 'ended'
      newState.endedAt = Date.now()
    }
  })
  
  return newState
}

function progressSetupPhase(state: GameState): GameState {
  const newState = { ...state }
  const playerCount = state.playerOrder.length
  
  if (state.phase === 'setup1') {
    // Move to next player or switch to setup2
    if (state.currentPlayerIndex === playerCount - 1) {
      newState.phase = 'setup2'
      // Don't change player - they place first in setup2
    } else {
      newState.currentPlayerIndex += 1
    }
  } else if (state.phase === 'setup2') {
    // Move backwards or start main game
    if (state.currentPlayerIndex === 0) {
      newState.phase = 'roll'
      newState.turn = 1
    } else {
      newState.currentPlayerIndex -= 1
    }
  }
  
  return newState
} 