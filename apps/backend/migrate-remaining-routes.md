# Remaining Route Migration Plan

## Current Status
- ✅ Core lobby system implemented
- ✅ Database schema migrated
- ✅ Game creation route converted to lobby system
- ✅ GET /games/:id route updated with unified loader
- 🔄 Currently working on: Join game route (partially done)

## Remaining Work

### 1. Complete Join Game Route Fix (games.ts)
The join game route still has `gameState` references that need to be updated to `lobbyState`.

### 2. Fix Remaining Routes in games.ts
- Line 388: Another `loadGameStateFromDB(game)` call
- Line 490: Another `loadGameStateFromDB(gameRecord[0])` call

### 3. Fix All WebSocket Routes (websocket/server.ts)
- Line 221: `loadGameStateFromDB(gameRecord[0])`
- Line 296: `loadGameStateFromDB(gameRecord[0])`  
- Line 467: `loadGameStateFromDB(gameRecord[0])`
- Line 565: `loadGameStateFromDB(gameRecord[0])`
- Line 722: `loadGameStateFromDB(gameRecord[0])`

## Migration Strategy
1. Import the unified loader in all files
2. Replace all `loadGameStateFromDB(record)` calls with `loadGameOrLobbyState(gameId)`
3. Handle both lobby and game state cases appropriately
4. Update lobby-specific operations to use LobbyManager
5. Update game-specific operations to use proper game state

## Key Principles
- Use LobbyManager for all lobby operations (add/remove players, settings, etc.)
- Use unified loader to determine state type
- Handle both lobby and game cases in each route
- Maintain backward compatibility where possible
- Proper error handling for state mismatches 