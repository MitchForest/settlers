// Action processor - handles state mutations with event sourcing
// All state changes are immutable and produce events for audit/replay

import {
  GameState,
  GameAction,
  GameEvent,
  Player,
  PlayerId,
  ResourceCards,
  DevelopmentCard,
  Building,
  Road,
  GamePhase,
  DiceRoll,
  EdgePosition
} from '../types'
import {
  BUILDING_COSTS,
  VICTORY_POINTS,
  GAME_RULES,
  DEVELOPMENT_CARD_COUNTS
} from '../constants'
import {
  rollDice,
  subtractResources,
  addResources,
  createEmptyResources,
  getTotalResourceCount,
  calculateDiscardCount,
  randomChoice,
  shuffleArray,
  hasResources
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
    case 'placeBuilding':
              return processBuilding(state, action)
    case 'placeRoad':
      return processPlaceRoad(state, action)
    case 'build':
      return processBuildAction(state, action)
    case 'trade':
      return processTradeAction(state, action)
    case 'playCard':
      return processPlayCard(state, action)
    case 'buyCard':
      return processBuyCard(state, action)
    case 'moveRobber':
      return processMoveRobber(state, action)
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

// ============= Action Validation =============

function validateAction(state: GameState, action: GameAction): { isValid: boolean, reason?: string } {
  // Check if it's the player's turn
  const currentPlayerId = state.currentPlayer
  if (action.playerId !== currentPlayerId) {
    return { isValid: false, reason: 'Not your turn' }
  }

  // Phase-specific validation would go here
  return { isValid: true }
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
      const total = getTotalResourceCount(player.resources)
      if (total > GAME_RULES.handLimitBeforeDiscard) {
        playersToDiscard.push(playerId)
      }
    })

    if (playersToDiscard.length > 0) {
      newState.phase = 'discard'
    } else {
      newState.phase = 'moveRobber'
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

// ============= Place Building =============

function processBuilding(state: GameState, action: GameAction): ProcessResult {
  const { buildingType, vertexId } = action.data
  const player = state.players.get(action.playerId)!
  const events: GameEvent[] = []
  
  let newState = deepCloneState(state)
  const newPlayer = { ...player }
  
  // Deduct resources for building cost
  const cost = BUILDING_COSTS[buildingType as keyof typeof BUILDING_COSTS]
  newPlayer.resources = subtractResources(player.resources, cost)
  
  // Update building inventory
  if (buildingType === 'settlement') {
    newPlayer.buildings.settlements -= 1
    newPlayer.score = {
      ...newPlayer.score,
      public: newPlayer.score.public + VICTORY_POINTS.settlement
    }
  } else if (buildingType === 'city') {
    newPlayer.buildings.cities -= 1
    newPlayer.score = {
      ...newPlayer.score,
      public: newPlayer.score.public + VICTORY_POINTS.city
    }
  }
  
  newPlayer.score.total = newPlayer.score.public + newPlayer.score.hidden
  
  // Place building on board
  const vertex = newState.board.vertices.get(vertexId)
  if (vertex) {
    vertex.building = {
      type: buildingType,
      owner: action.playerId,
      position: vertex.position
    }
  }
  
  newState.players.set(action.playerId, newPlayer)
  
  events.push(createEvent(state, 'buildingPlaced', action.playerId, { 
    buildingType, 
    vertexId 
  }))
  
  // Check for victory and update achievements
  newState = checkVictoryCondition(newState)
  newState = updateLongestRoad(newState)
  
  // Handle setup phase progression
  if (state.phase === 'setup1' || state.phase === 'setup2') {
    newState = progressSetupPhase(newState)
  }
  
  return {
    success: true,
    newState,
    events,
    message: 'Building placed successfully'
  }
}

// ============= Place Road =============

function processPlaceRoad(state: GameState, action: GameAction): ProcessResult {
  const { edgeId } = action.data
  const player = state.players.get(action.playerId)!
  const events: GameEvent[] = []
  
  let newState = deepCloneState(state)
  const newPlayer = { ...player }
  
  // Deduct resources for road cost (only if not in setup)
  if (state.phase !== 'setup1' && state.phase !== 'setup2') {
    const cost = BUILDING_COSTS.road
    newPlayer.resources = subtractResources(player.resources, cost)
  }
  
  // Update building inventory
  newPlayer.buildings.roads -= 1
  
  // Place road on board
  const edge = newState.board.edges.get(edgeId)
  if (edge) {
    edge.connection = {
      type: 'road',
      owner: action.playerId,
      position: edge.position
    }
  }
  
  newState.players.set(action.playerId, newPlayer)
  
  events.push(createEvent(state, 'roadPlaced', action.playerId, { 
    edgeId 
  }))
  
  // Update longest road
  newState = updateLongestRoad(newState)
  
  // Handle setup phase progression
  if (state.phase === 'setup1' || state.phase === 'setup2') {
    newState = progressSetupPhase(newState)
  }
  
  return {
    success: true,
    newState,
    events,
    message: 'Road placed successfully'
  }
}

// ============= Build Action =============

function processBuildAction(state: GameState, action: GameAction): ProcessResult {
  const { buildingType, position } = action.data
  
  // If no position specified, this is entering "placement mode"
  if (!position) {
    // For now, just return a message indicating placement mode started
    // The UI will handle the placement interaction
    return {
      success: true,
      newState: state,
      events: [createEvent(state, 'placementModeStarted', action.playerId, { buildingType })],
      message: `Select where to place your ${buildingType}`
    }
  }
  
  // Route to specific building placement handlers with position
  if (buildingType === 'settlement' || buildingType === 'city') {
    return processBuilding(state, {
      ...action,
      data: { buildingType, vertexId: position }
    })
  } else if (buildingType === 'road') {
    return processPlaceRoad(state, {
      ...action,
      data: { edgeId: position }
    })
  }
  
  return {
    success: false,
    newState: state,
    events: [],
    error: 'Invalid building type'
  }
}

// ============= Trade Action =============

function processTradeAction(state: GameState, action: GameAction): ProcessResult {
  // Trade implementation would go here
  return {
    success: false,
    newState: state,
    events: [],
    error: 'Trade not implemented yet'
  }
}

// ============= Buy Development Card =============

function processBuyCard(state: GameState, action: GameAction): ProcessResult {
  const player = state.players.get(action.playerId)!
  const events: GameEvent[] = []
  
  // Validate player has resources
  if (!hasResources(player.resources, BUILDING_COSTS.developmentCard)) {
    return {
      success: false,
      newState: state,
      events: [],
      error: 'Insufficient resources to buy development card'
    }
  }
  
  // Check if deck has cards
  if (state.developmentDeck.length === 0) {
    return {
      success: false,
      newState: state,
      events: [],
      error: 'No development cards left in deck'
    }
  }
  
  let newState = deepCloneState(state)
  const newPlayer = { ...player }
  
  // Deduct resources
  newPlayer.resources = subtractResources(player.resources, BUILDING_COSTS.developmentCard)
  
  // Draw card from deck
  const card = newState.developmentDeck.pop()!
  card.purchasedTurn = state.turn
  newPlayer.developmentCards.push(card)
  
  newState.players.set(action.playerId, newPlayer)
  
  events.push(createEvent(state, 'developmentCardPurchased', action.playerId, { 
    cardType: card.type,
    cardId: card.id
  }))
  
  return {
    success: true,
    newState,
    events,
    message: 'Development card purchased!'
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
      newState.phase = 'moveRobber'
      newState = updateLargestArmy(newState)
      events.push(createEvent(state, 'knightPlayed', action.playerId, { 
        knightsPlayed: newPlayer.knightsPlayed 
      }))
      break
      
    case 'roadBuilding':
      // Set a flag to allow building 2 free roads
      newState.pendingRoadBuilding = {
        playerId: action.playerId,
        roadsRemaining: 2
      }
      events.push(createEvent(state, 'roadBuildingActivated', action.playerId, {}))
      break
      
    case 'yearOfPlenty':
      // Handle resource selection - if resources specified, apply them
      if (action.data.resources) {
        const selectedResources = action.data.resources as Partial<ResourceCards>
        const totalSelected = Object.values(selectedResources).reduce((sum, count) => sum + (count || 0), 0)
        
        if (totalSelected === 2) {
          // Apply the selected resources
          Object.entries(selectedResources).forEach(([resource, count]) => {
            if (count && count > 0) {
              (newPlayer.resources as any)[resource] += count
            }
          })
          events.push(createEvent(state, 'yearOfPlentyUsed', action.playerId, { resources: selectedResources }))
        } else {
          return {
            success: false,
            newState: state,
            events: [],
            error: 'Must select exactly 2 resources'
          }
        }
      } else {
        // Need resource selection from UI
        return {
          success: false,
          newState: state,
          events: [],
          error: 'Must specify which 2 resources to take'
        }
      }
      break
      
    case 'monopoly':
      // Handle resource type selection
      if (action.data.resourceType) {
        const resourceType = action.data.resourceType as keyof ResourceCards
        let totalStolen = 0
        
        // Take all cards of this type from other players
        newState.players.forEach((otherPlayer, otherPlayerId) => {
          if (otherPlayerId !== action.playerId) {
            const amount = otherPlayer.resources[resourceType]
            if (amount > 0) {
              otherPlayer.resources[resourceType] = 0
              newPlayer.resources[resourceType] += amount
              totalStolen += amount
            }
          }
        })
        
        events.push(createEvent(state, 'monopolyUsed', action.playerId, { 
          resourceType, 
          totalStolen 
        }))
      } else {
        return {
          success: false,
          newState: state,
          events: [],
          error: 'Must specify which resource type to monopolize'
        }
      }
      break
      
    case 'victory':
      newPlayer.score = {
        ...newPlayer.score,
        hidden: newPlayer.score.hidden + VICTORY_POINTS.victoryCard
      }
      events.push(createEvent(state, 'victoryPointRevealed', action.playerId, {}))
      break
  }
  
  newPlayer.score.total = newPlayer.score.public + newPlayer.score.hidden
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
    message: 'Development card played'
  }
}

// ============= Move Robber =============

function processMoveRobber(state: GameState, action: GameAction): ProcessResult {
  const { hexPosition } = action.data
  let newState = deepCloneState(state)
  const events: GameEvent[] = []
  
  // Move robber to new position
  newState.board.robberPosition = hexPosition
  
  // Remove robber from old hex, add to new hex
  Array.from(newState.board.hexes.values()).forEach(hex => {
    hex.hasRobber = (hex.position.q === hexPosition.q && 
                      hex.position.r === hexPosition.r && 
                      hex.position.s === hexPosition.s)
  })
  
  events.push(createEvent(state, 'robberMoved', action.playerId, { 
    hexPosition 
  }))
  
  // Move to steal phase if there are adjacent players
  const adjacentPlayers = getPlayersAdjacentToHex(state, hexPosition)
  if (adjacentPlayers.length > 0) {
    newState.phase = 'steal'
  } else {
    newState.phase = 'actions'
  }
  
  return {
    success: true,
    newState,
    events,
    message: 'Robber moved'
  }
}

// ============= Steal Resource =============

function processStealResource(state: GameState, action: GameAction): ProcessResult {
  const { targetPlayerId } = action.data
  const currentPlayer = state.players.get(action.playerId)!
  const targetPlayer = state.players.get(targetPlayerId)!
  
  let newState = deepCloneState(state)
  const events: GameEvent[] = []
  
  // Get random resource from target player
  const availableResources = Object.entries(targetPlayer.resources)
    .filter(([_, count]) => count > 0)
    .flatMap(([resource, count]) => Array(count).fill(resource))
  
  if (availableResources.length > 0) {
    const stolenResource = randomChoice(availableResources) as keyof ResourceCards
    
    // Transfer resource
    const newCurrentPlayer = { ...currentPlayer }
    const newTargetPlayer = { ...targetPlayer }
    
    newCurrentPlayer.resources[stolenResource] += 1
    newTargetPlayer.resources[stolenResource] -= 1
    
    newState.players.set(action.playerId, newCurrentPlayer)
    newState.players.set(targetPlayerId, newTargetPlayer)
    
    events.push(createEvent(state, 'resourceStolen', action.playerId, { 
      targetPlayerId,
      resourceType: stolenResource
    }))
  }
  
  // Return to actions phase
  newState.phase = 'actions'
  
  return {
    success: true,
    newState,
    events,
    message: 'Resource stolen'
  }
}

// ============= Discard Cards =============

function processDiscard(state: GameState, action: GameAction): ProcessResult {
  const { resources } = action.data
  const player = state.players.get(action.playerId)!
  
  let newState = deepCloneState(state)
  const events: GameEvent[] = []
  
  // Remove discarded resources
  const newPlayer = { ...player }
  newPlayer.resources = subtractResources(player.resources, resources)
  newState.players.set(action.playerId, newPlayer)
  
  // Move to move robber phase after discarding
  newState.phase = 'moveRobber'
  
  events.push(createEvent(state, 'resourcesDiscarded', action.playerId, { 
    discardedResources: resources
  }))
  
  return {
    success: true,
    newState,
    events,
    message: 'Cards discarded'
  }
}

// ============= End Turn =============

function processEndTurn(state: GameState, action: GameAction): ProcessResult {
  const events: GameEvent[] = []
  let newState = deepCloneState(state)
  
  // Get all player IDs in order
  const playerIds = Array.from(state.players.keys())
  const currentIndex = playerIds.indexOf(state.currentPlayer)
  const nextIndex = (currentIndex + 1) % playerIds.length
  
  // Move to next player
  newState.currentPlayer = playerIds[nextIndex]
  newState.turn += 1
  newState.phase = 'roll'
  newState.dice = null
  
  events.push(createEvent(state, 'turnEnded', action.playerId, {
    nextPlayer: newState.currentPlayer
  }))
  
  return {
    success: true,
    newState,
    events,
    message: 'Turn ended'
  }
}

// ============= Helper Functions =============

function createEvent(
  state: GameState, 
  type: string, 
  playerId?: PlayerId, 
  data: any = {}
): GameEvent {
  return {
    id: `event-${Date.now()}-${Math.random()}`,
    type,
    gameId: state.id,
    playerId,
    data,
    timestamp: new Date()
  }
}

function deepCloneState(state: GameState): GameState {
  return {
    ...state,
    players: new Map(Array.from(state.players.entries()).map(([id, player]) => [
      id, 
      { ...player, resources: { ...player.resources } }
    ])),
    board: {
      ...state.board,
      hexes: new Map(state.board.hexes),
      vertices: new Map(state.board.vertices),
      edges: new Map(state.board.edges)
    }
  }
}

function calculateResourceDistribution(state: GameState, diceSum: number): Map<PlayerId, ResourceCards> {
  const distribution = new Map<PlayerId, ResourceCards>()
  
  // Terrain to resource mapping
  const terrainToResource: Record<string, keyof ResourceCards | undefined> = {
    'forest': 'wood',
    'hills': 'brick', 
    'pasture': 'sheep',
    'fields': 'wheat',
    'mountains': 'ore',
    'desert': undefined
  }
  
  // Find hexes that produce this dice roll
  Array.from(state.board.hexes.values()).forEach(hex => {
    if (hex.numberToken === diceSum && hex.terrain && !hex.hasRobber) {
      const resourceType = terrainToResource[hex.terrain]
      if (resourceType) {
        // Find players with buildings adjacent to this hex
        const adjacentPlayers = getPlayersAdjacentToHex(state, hex.position)
        
        adjacentPlayers.forEach(({ playerId, buildingType }) => {
          if (!distribution.has(playerId)) {
            distribution.set(playerId, createEmptyResources())
          }
          
          const playerResources = distribution.get(playerId)!
          const amount = buildingType === 'city' ? 2 : 1 // Cities produce 2, settlements produce 1
          playerResources[resourceType] += amount
        })
      }
    }
  })
  
  return distribution
}

function distributeResources(state: GameState, distribution: Map<PlayerId, ResourceCards>): GameState {
  const newState = { ...state }
  
  distribution.forEach((resources, playerId) => {
    const player = newState.players.get(playerId)
    if (player) {
      const newPlayer = { ...player }
      newPlayer.resources = addResources(player.resources, resources)
      newState.players.set(playerId, newPlayer)
    }
  })
  
  return newState
}

function getPlayersAdjacentToHex(state: GameState, hexPosition: { q: number, r: number, s: number }): Array<{ playerId: PlayerId, buildingType: string }> {
  const adjacentPlayers: Array<{ playerId: PlayerId, buildingType: string }> = []
  
  // Get all vertices adjacent to this hex
  const adjacentVertices = getAdjacentVertices(hexPosition)
  
  adjacentVertices.forEach(vertexId => {
    const vertex = state.board.vertices.get(vertexId)
    if (vertex && vertex.building) {
      adjacentPlayers.push({
        playerId: vertex.building.owner,
        buildingType: vertex.building.type
      })
    }
  })
  
  return adjacentPlayers
}

// Helper function to get vertices adjacent to a hex
function getAdjacentVertices(hexPos: { q: number, r: number, s: number }): string[] {
  const { q, r, s } = hexPos
  
  // Each hex has 6 vertices at the corners
  // Using cube coordinates, the vertices are at specific offsets
  const vertices = [
    `${q},${r},${s}-N`,     // North
    `${q},${r},${s}-NE`,    // Northeast  
    `${q},${r},${s}-SE`,    // Southeast
    `${q},${r},${s}-S`,     // South
    `${q},${r},${s}-SW`,    // Southwest
    `${q},${r},${s}-NW`     // Northwest
  ]
  
  return vertices
}

function updateLongestRoad(state: GameState): GameState {
  // Calculate longest road for each player
  // (Simplified - would need graph algorithm)
  let longestPlayer: PlayerId | null = null
  let longestLength = 0
  
  state.players.forEach((player, playerId) => {
    const pathLength = 5 // TODO: Calculate actual path length
    if (pathLength >= GAME_RULES.longestRoadMinimum && pathLength > longestLength) {
      longestPlayer = playerId
      longestLength = pathLength
    }
  })
  
  // Update longest road holder
  const newState = { ...state }
  newState.players.forEach((player, playerId) => {
    const hasLongest = playerId === longestPlayer
    if (player.hasLongestRoad !== hasLongest) {
      const newPlayer = { ...player, hasLongestRoad: hasLongest }
      newPlayer.score = {
        ...newPlayer.score,
        public: newPlayer.score.public + (hasLongest ? 2 : -2)
      }
      newPlayer.score.total = newPlayer.score.public + newPlayer.score.hidden
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
    if (player.knightsPlayed >= GAME_RULES.largestArmyMinimum && 
        player.knightsPlayed > largestCount) {
      largestPlayer = playerId
      largestCount = player.knightsPlayed
    }
  })
  
  // Update largest army holder
  const newState = { ...state }
  newState.players.forEach((player, playerId) => {
    const hasLargest = playerId === largestPlayer
    if (player.hasLargestArmy !== hasLargest) {
      const newPlayer = { ...player, hasLargestArmy: hasLargest }
      newPlayer.score = {
        ...newPlayer.score,
        public: newPlayer.score.public + (hasLargest ? 2 : -2)
      }
      newPlayer.score.total = newPlayer.score.public + newPlayer.score.hidden
      newState.players.set(playerId, newPlayer)
    }
  })
  
  return newState
}

function checkVictoryCondition(state: GameState): GameState {
  const newState = { ...state }
  
  // Check if any player has reached victory points
  state.players.forEach((player, playerId) => {
    if (player.score.total >= GAME_RULES.victoryPoints) {
      newState.winner = playerId
      newState.phase = 'ended'
    }
  })
  
  return newState
}

function progressSetupPhase(state: GameState): GameState {
  const newState = { ...state }
  const playerIds = Array.from(state.players.keys())
  const playerCount = playerIds.length
  const currentIndex = playerIds.indexOf(state.currentPlayer)
  
  if (state.phase === 'setup1') {
    // Move to next player or switch to setup2
    if (currentIndex === playerCount - 1) {
      newState.phase = 'setup2'
      // Don't change player - they place first in setup2
    } else {
      newState.currentPlayer = playerIds[currentIndex + 1]
    }
  } else if (state.phase === 'setup2') {
    // Move backwards or start main game
    if (currentIndex === 0) {
      newState.phase = 'roll'
      newState.turn = 1
    } else {
      newState.currentPlayer = playerIds[currentIndex - 1]
    }
  }
  
  return newState
} 