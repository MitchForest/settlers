// Standard token sizing and design constants for all game pieces
export const TOKEN_DESIGN = {
  // Standard size for all tokens (matching number tokens)
  radius: 14,
  diameter: 28,
  
  // Standard styling - off-white with off-black accents
  backgroundColor: '#FBFBF9', // ~5% off-white for subtle contrast
  borderColor: '#191919',     // ~10% off-black for readability
  borderWidth: 2,
  
  // Text styling
  textColor: '#191919',       // ~10% off-black
  redTextColor: '#DC2626',    // For probability 6s and 8s
  fontSize: {
    number: 14,     // Number tokens
    ratio: 12,      // Port ratios
    emoji: 16       // Piece emojis
  },
  
  // Player color usage (subtle accents only)
  playerAccent: {
    borderWidth: 3,
    opacity: 0.8
  }
} as const

// Road design constants
export const ROAD_DESIGN = {
  // Road should be visible but not dominate the board
  // Hex borders are 1-2px, so roads should be ~3-4x thicker for visibility
  width: 6,
  playerColorFill: true,
  outlineColor: '#191919',
  outlineWidth: 1
} as const

// Game piece emojis
export const PIECE_EMOJIS = {
  settlement: '🏠',  // House
  city: '🏢',        // Office building (NOT 🏙️)
  port: '❓'         // Red question mark for generic ports
} as const

// Probability dot configuration for number tokens
export const PROBABILITY_DOTS = {
  dotRadius: 1.5,
  dotSpacing: 4,
  yOffset: 8, // Position dots just below the number text
  color: '#191919',
  redColor: '#DC2626' // For 6s and 8s
} as const 