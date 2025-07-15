# Comprehensive Development Implementation Plan - Cap Table Game

## Phase 0: Setup & Dependencies ✓ (Complete)
- Next.js 14 with App Router
- React Flow for visual connections
- react-hexgrid for hex board
- Bun + Hono for WebSocket server
- TypeScript, Tailwind CSS, shadcn/ui
- WebSocket client libraries
- State management (Zustand/Context)

## Phase 1: Core Game Engine & Generic UI

### 1.1 Game State Management
**Core State Structure:**
```typescript
interface GameState {
  board: HexTile[]
  players: Player[]
  currentPlayer: PlayerId
  phase: 'setup' | 'roll' | 'trade' | 'build' | 'end'
  dice: [number, number]
  robber: HexPosition
  developmentCards: DevelopmentCard[]
  turn: number
  winner: PlayerId | null
}
```

**Actions Required:**
- Initialize game board with random/fixed layout
- Handle dice rolls and resource distribution
- Validate all placement rules (distance rule, connection requirements)
- Process trades between players
- Update scores and check victory conditions
- Manage development card deck and usage

### 1.2 Game Board UI

**Hex Board Component:**
- Use react-hexgrid for hex grid rendering
- Each hex displays:
  - Terrain type (generic-terrain-1 through 6)
  - Number token (2-12, except 7)
  - Highlight on hover
  - Resource production animation on dice roll
  - Robber overlay when present

**Board Interactions:**
- Click hex edges to place roads
- Click vertices to place settlements/cities
- Drag-and-drop robber on 7 roll
- Visual indicators for valid placement locations
- Ghost preview of structures before placement

**Visual Requirements:**
- Board centered in viewport with zoom/pan controls
- Mini-map in corner for large boards
- Smooth animations for all state changes
- Distinct colors for each player
- Clear visual hierarchy (cities > settlements > roads)

### 1.3 Player UI Components

**Player Dashboard (Active Player):**
- Resource cards in hand (collapsible/expandable)
- Development cards (hidden until played)
- Building options with cost display
- Available actions based on current phase
- Timer display for turn limit
- Score display (public points only)

**Opponent Displays:**
- Minimized view showing:
  - Resource count (not types)
  - Development card count
  - Public score
  - Structures remaining
  - Active/inactive indicator

**Turn Phase Indicator:**
- Visual progress through phases
- Current phase highlighted
- Available actions for phase
- Skip/End Turn button when applicable

### 1.4 Dice System UI

**Dice Roll Animation:**
- 3D dice roll animation or sprite animation
- Both dice visible during roll
- Sum displayed prominently
- History of last 5 rolls in sidebar

**Resource Distribution Animation:**
- Resources fly from producing hexes to players
- Batch animation for multiple recipients
- Sound effects for resource collection
- "+2 resource-1" popups on hexes

### 1.5 Trading Interface

**Trade Initiation:**
- "Propose Trade" button during trade phase
- Modal/panel slides in from side
- Select target player(s) or bank/port

**Player-to-Player Trading:**
- Drag resources to "Offering" section
- Drag desired resources to "Requesting" section
- Send offer to specific player
- Real-time trade status (pending/rejected/counter)

**Trade Management Panel:**
- Active trades list
- Accept/Reject/Counter buttons
- Trade history for current turn
- Quick trade templates

**Bank/Port Trading:**
- Visual representation of trade ratios
- Slider for quantity selection
- Preview of trade result
- Confirm button with animation

### 1.6 Building Interface

**Building Mode:**
- Toggle building mode button
- Valid locations highlighted in green
- Invalid locations dimmed
- Cost displayed on hover
- Right-click to cancel

**Building Placement:**
- Click to place (with confirmation)
- Smooth placement animation
- Immediate score update
- Resource deduction animation

### 1.7 Development Cards UI

**Card Purchase:**
- Buy button with cost display
- Card draw animation from deck
- Card added to hand with flip animation

**Card Display:**
- Cards in hand shown as thumbnails
- Hover for full view
- Drag to play or click-to-select
- Played knights displayed separately

**Card Effects:**
- Knight: Robber movement interface
- Progress cards: Contextual UI for each type
- Victory points: Hidden until game end

### 1.8 Victory & Game End UI

**Victory Detection:**
- Real-time victory checking
- Victory announcement modal
- Confetti animation (react-confetti)
- Final score breakdown

**End Game Screen:**
- Winner spotlight with avatar/name
- Complete scoring breakdown
- Statistics (resources collected, trades made, etc)
- Rematch button
- Return to lobby button

### 1.9 Setup Phase UI

**Initial Placement:**
- Turn order display
- Current player indicator
- Placement instructions
- Two-round setup tracking
- Starting resource distribution

## Phase 2: Theming System & Cap Table Theme

### 2.1 Theme Architecture

**Theme Provider Setup:**
- Context for current theme
- Theme loader with validation
- Hot-swappable themes
- Fallback to default theme

**Theme File Structure:**
```
/themes
  /default
    theme.json
    /assets
  /cap-table
    theme.json
    /assets
  ThemeProvider.tsx
  ThemeLoader.ts
  ThemeValidator.ts
```

### 2.2 Theme Implementation

**Asset Management:**
- Dynamic asset loading
- Sprite sheets for performance
- SVG icons with color overrides
- Lazy loading for theme assets

**Text Replacement:**
- All strings from theme file
- Interpolation for dynamic text
- Pluralization support
- Number formatting rules

**Style Application:**
- CSS variables from theme
- Dynamic color generation
- Theme-specific animations
- Font loading

### 2.3 Cap Table Theme Integration

**Visual Updates:**
- Replace all generic terms
- Apply VC-themed colors
- Load custom icons
- Update sound effects

**UI Adjustments:**
- Corporate aesthetic
- Modern typography
- Professional color palette
- Business-appropriate animations

## Phase 3: Multiplayer Infrastructure

### 3.1 Account System

**User Registration/Login:**
- Email/password authentication
- OAuth providers (Google, GitHub)
- Username selection with uniqueness
- Avatar upload/selection
- Email verification flow

**User Profile:**
- Display name and avatar
- Statistics dashboard
- Match history
- Achievement badges
- Settings/preferences

### 3.2 Lobby System

**Main Lobby UI:**
- Active games list
- Player count indicators
- Join game buttons
- Create game button
- Quick match option

**Game Creation:**
- Game name input
- Map selection (size/type)
- Player limit (2-4)
- Time limits per turn
- Private/public toggle
- Password protection option

**Pre-Game Lobby:**
- Player slots with ready status
- AI player addition/removal
- Difficulty selection for AI
- Chat window
- Start game button (host only)
- Leave game option

### 3.3 Matchmaking Engine

**Quick Match:**
- Skill-based matching (ELO/MMR)
- Region preference
- Queue time estimation
- Cancel queue option
- Auto-accept or manual accept

**Ranked System:**
- Placement matches (10 games)
- Rank tiers (Bronze to Diamond)
- Season resets
- Rank progression UI
- Protected rank floors

### 3.4 Invite System

**Creating Invites:**
- Copy invite link
- Send via email
- In-app friend invites
- QR code generation
- Expiration settings

**Receiving Invites:**
- Notification badge
- Accept/decline buttons
- Preview game details
- Invite expiration timer
- Block sender option

### 3.5 Spectator/Observer Mode

**Spectator Features:**
- Join as observer option
- All player hands visible
- No fog of war
- Chat (spectator-only channel)
- Streamer mode (hide sensitive info)

**Observer UI:**
- Toggle between player views
- Free camera mode
- Statistics overlay
- Turn timeline scrubber
- Export game replay

### 3.6 Leaderboards

**Global Rankings:**
- Top 100 players
- Weekly/monthly/all-time
- Win rate statistics
- Average game duration
- Most played faction

**Friend Rankings:**
- Friends-only leaderboard
- Recent matches together
- Head-to-head statistics
- Invite to game button

### 3.7 Statistics & Analytics

**Player Statistics:**
- Games played/won/lost
- Win rate by player count
- Resource collection rates
- Trading frequency
- Building patterns
- Average game length
- Favorite strategies

**Match History:**
- Last 50 games
- Detailed game logs
- Score progression graphs
- Key moments timeline
- Download replay option

### 3.8 Game Logs & Replay System

**Live Game Logging:**
- Every action timestamped
- Player decisions tracked
- Dice roll history
- Trade history
- Chat logs

**Replay Viewer:**
- Load from match ID
- Playback controls
- Speed adjustment
- Jump to specific turns
- Share replay link

### 3.9 Quality of Life Features

**Notifications:**
- Turn reminders
- Game invites
- Achievement unlocks
- Friend requests
- System announcements

**Settings Menu:**
- Graphics quality
- Sound volumes
- Notification preferences
- Hotkey bindings
- Language selection
- Colorblind modes

**Social Features:**
- Friends list
- Block list
- Recent players
- Chat options
- Voice chat toggle

**Performance Features:**
- Reconnection handling
- State synchronization
- Lag compensation
- Offline mode (vs AI)
- Save game state

## Phase 4: AI Players

### 4.1 AI Architecture

**Core AI System:**
```typescript
interface AIPlayer {
  difficulty: 'easy' | 'medium' | 'hard' | 'expert'
  strategy: AIStrategy
  personality: AIPersonality
  decisionDelay: number
}
```

**Decision Engine:**
- State evaluation function
- Move generation
- Trade evaluation
- Resource valuation
- Victory path planning

### 4.2 Difficulty Levels

**Easy AI:**
- Random valid moves
- Basic resource collection
- No long-term planning
- Accepts most trades
- 15% optimal play
- 2-3 second decisions

**Medium AI:**
- Prioritizes good number tiles
- Basic blocking strategies
- Simple trade evaluation
- Builds toward victory
- 45% optimal play
- 3-4 second decisions

**Hard AI:**
- Advanced placement strategy
- Resource denial tactics
- Calculated trades only
- Multiple victory paths
- 75% optimal play
- 4-5 second decisions

**Expert AI:**
- Perfect starting placement
- Optimal resource management
- Psychological trade tactics
- Adapts to player strategies
- 95% optimal play
- 5-7 second decisions

### 4.3 AI Behaviors

**Placement Strategy:**
- Evaluate hex productivity
- Consider port access
- Block opponent expansion
- Secure resource diversity

**Trading Logic:**
- Track player resources
- Predict opponent needs
- Strategic embargo
- Counter-offer system

**Development Cards:**
- Calculate optimal timing
- Knight chain strategies
- Progress card combos
- Victory point concealment

### 4.4 AI Personality System

**Personality Types:**
- **Aggressive**: Blocks players, competitive trading
- **Builder**: Focuses on own development
- **Trader**: Frequent trade offers
- **Defensive**: Protects position, careful play

**Personality Effects:**
- Trade acceptance rates
- Robber placement preferences
- Building priorities
- Chat message style

### 4.5 OpenAI Integration

**API Configuration:**
- Secure key management
- Rate limiting
- Fallback to local AI
- Cost monitoring

**LLM Features:**
- Natural language trades
- Strategic explanations
- Personality-driven chat
- Post-game analysis

**Prompt Engineering:**
- Game state serialization
- Move validation
- Strategy selection
- Trade negotiation

## Technical Implementation Details

### WebSocket Protocol

**Message Types:**
- game:create
- game:join
- game:start
- player:ready
- turn:roll
- turn:trade
- turn:build
- turn:end
- game:end

**State Sync:**
- Differential updates
- State snapshots
- Conflict resolution
- Optimistic updates

### Security Considerations

**Anti-Cheat:**
- Server-side validation
- Action rate limiting
- State tampering detection
- Report system

**Data Protection:**
- Encrypted connections
- Secure authentication
- GDPR compliance
- Data retention policies

### Performance Optimization

**Client-Side:**
- Lazy loading
- Asset bundling
- State caching
- WebGL rendering

**Server-Side:**
- Game state compression
- Connection pooling
- Horizontal scaling
- Redis caching

This comprehensive plan covers all aspects of the game development from core mechanics through advanced multiplayer features and AI implementation. Each phase builds upon the previous, ensuring a solid foundation for the complete game experience.