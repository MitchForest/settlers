// Debug script to test AI action generation
const fs = require('fs');
const path = require('path');

// Mock game state with the scenario you described
const mockGameState = {
  phase: 'actions',
  players: new Map([
    ['ai-player', {
      id: 'ai-player',
      resources: { wood: 2, brick: 2, ore: 2, wheat: 2, sheep: 2 },
      buildings: { settlements: 3, cities: 4, roads: 13 }, // Has buildings available
      score: { total: 4 },
      developmentCards: [],
      knightsPlayed: 0
    }]
  ]),
  board: {
    vertices: new Map([
      ['vertex1', { building: null, position: { hexes: [] } }],
      ['vertex2', { building: null, position: { hexes: [] } }],
      ['vertex3', { building: { owner: 'ai-player', type: 'settlement' }, position: { hexes: [] } }]
    ]),
    edges: new Map([
      ['edge1', { connection: null, position: { hexes: [] } }],
      ['edge2', { connection: null, position: { hexes: [] } }]
    ])
  },
  turn: 1
};

// Test function to debug action generation
function debugAI() {
  console.log('=== AI Debug Analysis ===');
  console.log('Player resources:', mockGameState.players.get('ai-player').resources);
  console.log('Player buildings available:', mockGameState.players.get('ai-player').buildings);
  
  // Check resource requirements
  const BUILDING_COSTS = {
    settlement: { wood: 1, brick: 1, wheat: 1, sheep: 1, ore: 0 },
    road: { wood: 1, brick: 1, wheat: 0, sheep: 0, ore: 0 },
    developmentCard: { wood: 0, brick: 0, wheat: 1, sheep: 1, ore: 1 }
  };
  
  const player = mockGameState.players.get('ai-player');
  
  console.log('\n=== Resource Check ===');
  console.log('Can build settlement:', hasResources(player.resources, BUILDING_COSTS.settlement));
  console.log('Can build road:', hasResources(player.resources, BUILDING_COSTS.road));
  console.log('Can buy dev card:', hasResources(player.resources, BUILDING_COSTS.developmentCard));
  
  console.log('\n=== Building Availability ===');
  console.log('Has settlements to place:', player.buildings.settlements > 0);
  console.log('Has roads to place:', player.buildings.roads > 0);
  
  // Test position finding
  console.log('\n=== Position Analysis ===');
  console.log('Available settlement positions:', ['vertex1', 'vertex2']); // Mock
  console.log('Available road positions:', ['edge1', 'edge2']); // Mock
  
  console.log('\n=== Expected Actions ===');
  console.log('Should generate:');
  console.log('- Settlement build actions (has resources + positions)');
  console.log('- Road build actions (has resources + positions)');
  console.log('- Development card purchase (has resources)');
  console.log('- Trade actions (has excess resources)');
  console.log('- End turn action (fallback)');
}

function hasResources(playerResources, requiredResources) {
  return playerResources.wood >= requiredResources.wood &&
         playerResources.brick >= requiredResources.brick &&
         playerResources.ore >= requiredResources.ore &&
         playerResources.wheat >= requiredResources.wheat &&
         playerResources.sheep >= requiredResources.sheep;
}

debugAI();