// Theme system types for Settlers game

export interface ThemeMeta {
  id: string
  name: string
  description: string
  version: string
  author?: string
  useCustomIcons?: boolean
}

export interface ResourceTheme {
  id: string
  name: string
  description: string
  color: string
  icon: string
  resourceProduced: string | null
  texture?: string  // Optional path to texture asset
}

export interface ResourceMapping {
  displayName: string
  description: string
  icon: string
  color: string
}

export interface GameElement {
  displayName: string
  description: string
  icon: string
  color: string
}

export interface DevelopmentCardTheme {
  displayName: string
  description: string
  icon: string
  color: string
}

export interface PlayerColor {
  id: number
  name: string
  primary: string
  secondary: string
  accent: string
}

export interface UIConfig {
  boardBackground: string
  hexBorder: string
  hexBorderWidth: number
  numberTokenBackground: string
  numberTokenBorder: string
  robberColor: string
}

export interface GameTheme {
  meta: ThemeMeta
  resources: ResourceTheme[]
  resourceMapping: Record<string, ResourceMapping>
  gameElements: Record<string, GameElement>
  developmentCards: Record<string, DevelopmentCardTheme>
  playerColors: PlayerColor[]
  ui: UIConfig
  _assetBasePath?: string
} 

// Asset resolution function type
export type AssetResolver = (assetPath: string, fallbackPath?: string) => Promise<string | null>

// Utility types for component props
export interface HexTileProps {
  terrain: string | null
  numberToken: number | null
  position: { x: number, y: number }
  theme: GameTheme | null
  assetResolver: AssetResolver | null
  isHovered?: boolean
  isSelected?: boolean
  isEmpty?: boolean
  disableTransitions?: boolean
}

export interface GamePieceProps {
  type: 'settlement' | 'city' | 'road'
  playerId: string
  position: { x: number, y: number }
  theme: GameTheme | null
  assetResolver: AssetResolver | null
  rotation?: number // For roads
} 