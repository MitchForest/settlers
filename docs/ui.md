# Premium UI/UX Design Specification - Cap Table Game

## Design Philosophy

### Core Principles
- **Clarity through Motion**: Every interaction tells a story through animation
- **Depth without Clutter**: Layered information architecture with progressive disclosure
- **Premium Feel**: Glass morphism, subtle shadows, and refined micro-interactions
- **Performance First**: 60fps animations with GPU acceleration
- **Accessible Beauty**: Stunning visuals that remain usable for all players

## Visual Design System

### Color Palette
```css
/* Primary Palette - Dark Mode First */
--background: #0A0A0B;
--surface: #131316;
--surface-elevated: #1A1A1F;
--surface-glass: rgba(255, 255, 255, 0.03);

/* Accent Colors */
--primary: #5E5CE6;
--primary-glow: #5E5CE6;
--secondary: #30D158;
--tertiary: #FFD60A;

/* Player Colors with Glow */
--player-1: #FF453A;
--player-1-glow: 0 0 20px rgba(255, 69, 58, 0.5);
--player-2: #32ADE6;
--player-2-glow: 0 0 20px rgba(50, 173, 230, 0.5);
--player-3: #30D158;
--player-3-glow: 0 0 20px rgba(48, 209, 88, 0.5);
--player-4: #FFD60A;
--player-4-glow: 0 0 20px rgba(255, 214, 10, 0.5);
```

### Typography
```css
/* Display - For big moments */
font-family: 'SF Pro Display', -apple-system, sans-serif;
font-weight: 700;
letter-spacing: -0.02em;

/* UI Text - For interface */
font-family: 'Inter', sans-serif;
font-weight: 400, 500, 600;

/* Monospace - For numbers/resources */
font-family: 'JetBrains Mono', monospace;
font-variant-numeric: tabular-nums;
```

## Game Board Design

### Hexagonal Grid Layout
```typescript
/* React-hexgrid Configuration */
- Flat-top orientation for better screen usage
- Dynamic sizing based on viewport
- Subtle grid lines (1px, 10% opacity)
- Hover state: Scale 1.02, glow effect
```

### Hex Tile Rendering
**Base State:**
- Glass morphism background with noise texture
- Resource icon centered (40% size of hex)
- Number token as floating badge (top-right)
- Subtle gradient based on resource type
- Soft shadows for depth

**Interactive States:**
- **Hover**: Gentle pulse animation, brightness +10%
- **Producing**: Ripple effect from center, particle emission
- **Blocked (Robber)**: Desaturate 80%, dark overlay, red glow
- **Valid Placement**: Green outline pulse (2px, breathing animation)

### Resource Production Animation
```css
@keyframes resourceBurst {
  0% { transform: scale(1); opacity: 0; }
  20% { transform: scale(1.5); opacity: 1; }
  100% { transform: scale(3); opacity: 0; }
}

/* Particle system for production */
- 10-15 particles per hex
- Particles match resource color
- Float upward with physics simulation
- Collect into player UI with bezier curves
```

## React Flow Integration (Expansion Routes)

### Connection Rendering
**Visual Style:**
- Gradient stroke from player color
- Animated dash pattern
- Width: 4px base, 6px on hover
- Glow effect using SVG filters

**Connection States:**
```javascript
// Idle state
strokeDasharray: "0"
strokeWidth: 4
opacity: 0.8

// Building preview
strokeDasharray: "5 5"
animation: "dash 20s linear infinite"
opacity: 0.5

// Established route
strokeDasharray: "0"
strokeWidth: 5
filter: "url(#glow)"
opacity: 1

// Longest route
strokeWidth: 6
animation: "pulse 2s ease-in-out infinite"
className: "rainbow-gradient"
```

### Node Design (Portfolio Companies)
**Seed PortCo:**
- Circular node with glass morphism
- Company icon in center
- Player color ring (2px)
- Subtle floating animation
- Connection points visible on hover

**Unicorn:**
- Larger node (1.5x)
- Golden accents
- Particle effects (subtle sparkles)
- Enhanced glow effect
- Trophy icon overlay

## Player UI Components

### Active Player Dashboard
**Layout:**
```
+------------------+
|   Resources      |
|   [Animated]     |
+------------------+
|   Dev Cards      |
|   [Fan Layout]   |
+------------------+
|   Actions        |
|   [Context]      |
+------------------+
```

**Resource Display:**
- Cards stack with slight offset (5px)
- Hover fans out cards
- Count badge with spring animation
- Drag preview for trading
- Glow effect on recent additions

**Development Cards:**
- Face-down by default
- 3D flip animation on hover
- Glassmorphism card design
- Rarity glow effects
- Play animation: Card flies to center, explodes into particles

### Opponent UI (Minimized)
**Compact Display:**
- Avatar with status ring
- Resource count (encrypted appearance)
- Public score with smooth counter
- Building inventory dots
- Turn indicator pulse

**Expansion on Hover:**
- Smooth height transition
- Show recent actions feed
- Trading availability indicator
- Connection strength bars

## Dice System

### Roll Animation Sequence
1. **Pre-roll** (0-200ms):
   - Dice fade in with scale
   - Blur background slightly
   - "Rolling..." text appears

2. **Rolling** (200-1500ms):
   - 3D dice tumbling animation
   - Motion blur on dice
   - Camera shake (subtle)
   - Sound sync with tumbles

3. **Result** (1500-2000ms):
   - Dice settle with bounce
   - Numbers glow based on rarity
   - Sum appears with typewriter effect
   - Ripple effect to producing hexes

### Dice Design
- Glass cube with frosted faces
- Numbers etched with inner glow
- Physics-based rolling
- Reflection of game board
- Special effects for 7 (red glow)

## Card Animations

### Draw Animation
```javascript
// Card emerges from deck
transform: translate3d(0, 100px, 0) rotateX(-90deg)
// Rises and flips
transform: translate3d(0, 0, 0) rotateX(0deg)
// Settles into hand
transform: translate3d(handPosition) scale(1)
```

### Card Interactions
**In Hand:**
- Tilt effect following mouse
- Parallax layers (icon, background, border)
- Soft glow on hover
- Spring physics for movement

**Playing a Card:**
1. Card scales up (1.2x)
2. Moves to screen center
3. Glows intensely
4. Shatters into themed particles
5. Effect executes (robber move, resources, etc)

## Trading Interface

### Trade Panel Design
**Modern Modal:**
- Backdrop blur (10px)
- Slide in from right
- Glass morphism panel
- Smooth scrolling sections

**Resource Selection:**
- Drag resources to trade slots
- Magnetic snap to grid
- Counter animations
- Preview totals update live
- Insufficient resources shake

**Trade Flow:**
1. Initiate: Panel slides in
2. Build offer: Drag and drop with trails
3. Send: Swoosh animation to target
4. Pending: Pulsing border
5. Complete: Burst effect, resources fly

## Turn Indicator System

### Turn Timer
**Visual Design:**
- Circular progress ring
- Gradient fill depletes
- Color shifts (green → yellow → red)
- Particle effects at critical time
- Pulse animation last 5 seconds

### Turn Transitions
```javascript
// Player A ends turn
await fadeOut(playerAHighlight, 300ms)
await cameraEaseTo(playerBPosition, 600ms)
await fadeIn(playerBHighlight, 300ms)
await bounce(playerBAvatar, 400ms)
// Play chime sound
```

## Victory Sequence

### Win Detection
1. **Freeze moment** (0-500ms):
   - Time slows (0.3x speed)
   - Desaturate non-winner elements
   - Spotlight effect on winner

2. **Announcement** (500-1500ms):
   - Winner name types out
   - Crown animation above player
   - Score counter rolls up
   - Fanfare sound builds

3. **Celebration** (1500-5000ms):
   - React-confetti explosion
   - Multiple particle systems
   - Camera orbits winner
   - UI elements dance
   - Achievement toasts

### End Game UI
**Results Screen:**
- Glass panel with stats
- Animated charts (Chart.js)
- Medal assignments with shine
- Social sharing cards
- Rematch button with glow

## Game Beginning Sequence

### Loading Experience
1. **Room Join**: 
   - Players appear as glass cards
   - Ready status as loading ring
   - Chat messages slide in

2. **Map Generation**:
   - Hexes fade in spiral pattern
   - Resources materialize
   - Numbers drop with bounce
   - Ports slide in from edges

3. **Ready Countdown**:
   - 3-2-1 with scaling numbers
   - Blur effect increases
   - "Begin" explodes into particles

## Tutorial System

### First-Time Player Experience
**Interactive Overlay:**
- Dark backdrop (80% opacity)
- Spotlight on relevant UI
- Animated hand cursor
- Progress dots at bottom
- Skip option (subtle)

**Tutorial Steps:**
1. Welcome animation (logo reveal)
2. Resource introduction (cards flip)
3. Building demo (ghost placement)
4. Trading walkthrough (AI demo)
5. Victory conditions (point counter)

**Design Elements:**
- Tooltips with tail animation
- Highlight rings pulse
- Arrow indicators bounce
- Success feedback (checkmarks)

## Micro-interactions

### Building Placement
```javascript
// Preview state
opacity: 0.6
scale: 0.9
animation: "breathe 2s infinite"

// Placement animation
scale: 0 → 1.2 → 1 (spring physics)
opacity: 0 → 1
particles: spawn(10, playerColor)
soundEffect: "construct.mp3"
```

### Resource Collection
- Icons stretch toward destination
- Trail effect during movement
- Magnetic collection animation
- Counter increment with bounce
- Glow pulse on arrival

### Connection Pulse
```css
@keyframes connectionPulse {
  0% { stroke-width: 4px; opacity: 0.8; }
  50% { stroke-width: 6px; opacity: 1; }
  100% { stroke-width: 4px; opacity: 0.8; }
}
```

## Performance Optimizations

### Animation Strategy
- Use CSS transforms only
- GPU-accelerated properties
- RequestAnimationFrame for JS
- Intersection Observer for visibility
- Reduced motion respects preferences

### Asset Loading
- Lazy load tutorial assets
- Preload critical animations
- Sprite sheets for particles
- WebP with PNG fallback
- CDN for static assets

## Responsive Design

### Breakpoints
```css
/* Mobile First */
@media (min-width: 768px) /* Tablet */
@media (min-width: 1024px) /* Desktop */
@media (min-width: 1440px) /* Large */
@media (min-width: 2560px) /* 4K */
```

### Mobile Adaptations
- Bottom sheet for player UI
- Pinch to zoom on board
- Tap and hold for tooltips
- Swipe gestures for panels
- Haptic feedback on actions

## Sound Design Integration

### Audio Cues
- UI interactions: Subtle clicks
- Resources: Unique collection sounds
- Building: Construction sounds
- Trading: Coin clinks
- Victory: Orchestral fanfare

### Music System
- Dynamic intensity based on game state
- Crossfade between themes
- Victory crescendo
- Ambient during waiting

## Accessibility Features

### Visual Accessibility
- High contrast mode toggle
- Colorblind patterns option
- Motion reduction settings
- Focus indicators prominent
- Screen reader annotations

### Interaction Accessibility
- Keyboard navigation complete
- Touch targets 44px minimum
- Drag alternatives provided
- Time limit extensions
- Audio cue alternatives

This design specification creates a premium, modern gaming experience that stands out through attention to detail, smooth animations, and thoughtful interactions while maintaining excellent performance.