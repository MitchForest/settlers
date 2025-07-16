// Theme loader - loads game themes with assets
// Structure: themes/[themeId]/config.json + themes/[themeId]/assets/

import { GameTheme, AssetResolver } from './theme-types'

// Default theme ID for fallbacks
const DEFAULT_THEME_ID = 'default'

// Enhanced theme loader with asset-level fallback system
export async function loadTheme(themeId: string): Promise<GameTheme> {
  const basePath = `/themes/${themeId}`
  
  try {
    const configResponse = await fetch(`${basePath}/config.json`)
    if (!configResponse.ok) {
      throw new Error(`Failed to load theme config: ${configResponse.status}`)
    }
    
    const theme: GameTheme = await configResponse.json()
    
    // Set base path for asset resolution
    theme._assetBasePath = basePath
    
    // Resolve all asset paths for this theme
    await resolveThemeAssets(theme)
    
    return theme
  } catch (error) {
    console.error(`Failed to load theme '${themeId}':`, error)
    throw error
  }
}

// Resolve asset paths for a theme
async function resolveThemeAssets(theme: GameTheme): Promise<void> {
  const basePath = theme._assetBasePath!
  
  // Process resources (terrain hex tiles)
  for (const resource of theme.resources) {
    // Look for hex tile asset (try multiple formats)
    const hexAssetCandidates = [
      `${basePath}/assets/terrain/hex-${resource.id}.png`,
      `${basePath}/assets/terrain/hex-${resource.id}.svg`,
      `${basePath}/assets/terrain/${resource.id}.png`,
      `${basePath}/assets/terrain/${resource.id}.svg`
    ]
    
    for (const candidate of hexAssetCandidates) {
      if (await assetExists(candidate)) {
        resource.hexAsset = candidate
        break
      }
    }
    
    // Look for resource icon
    if (resource.icon && !resource.icon.startsWith('http')) {
      const iconCandidates = [
        `${basePath}/assets/icons/${resource.icon}`,
        `${basePath}/assets/icons/resource-${resource.id}.svg`,
        `${basePath}/assets/icons/resource-${resource.id}.png`
      ]
      
      for (const candidate of iconCandidates) {
        if (await assetExists(candidate)) {
          resource.iconAsset = candidate
          break
        }
      }
    }
  }
  
  // Process structures (settlements, cities, roads)
  const structures = theme.structures
  
  // Look for structure assets
  const structureTypes = ['settlement', 'city', 'road'] as const
  for (const structureType of structureTypes) {
    const structure = structures[structureType]
    const assetCandidates = [
      `${basePath}/assets/structures/${structureType}.png`,
      `${basePath}/assets/structures/${structureType}.svg`,
      `${basePath}/assets/pieces/${structureType}.png`,
      `${basePath}/assets/pieces/${structureType}.svg`
    ]
    
    for (const candidate of assetCandidates) {
      if (await assetExists(candidate)) {
        structure.asset = candidate
        break
      }
    }
  }
  
  // Process development cards
  for (const [cardId, card] of Object.entries(theme.developmentCards)) {
    const cardCandidates = [
      `${basePath}/assets/cards/${cardId}.png`,
      `${basePath}/assets/cards/${cardId}.svg`,
      `${basePath}/assets/development-cards/${cardId}.png`,
      `${basePath}/assets/development-cards/${cardId}.svg`
    ]
    
    for (const candidate of cardCandidates) {
      if (await assetExists(candidate)) {
        card.artAsset = candidate
        break
      }
    }
    
    if (card.icon && !card.icon.startsWith('http')) {
      const iconCandidates = [
        `${basePath}/assets/icons/${card.icon}`,
        `${basePath}/assets/cards/icons/${cardId}.svg`
      ]
      
      for (const candidate of iconCandidates) {
        if (await assetExists(candidate)) {
          card.iconAsset = candidate
          break
        }
      }
    }
  }
}

// Create asset resolver for a theme with fallback to default
export function createAssetResolver(theme: GameTheme, defaultTheme?: GameTheme): AssetResolver {
  return async (assetPath: string, fallbackPath?: string): Promise<string | null> => {
    // Try the primary asset path
    if (await assetExists(assetPath)) {
      return assetPath
    }
    
    // Try explicit fallback path if provided
    if (fallbackPath && await assetExists(fallbackPath)) {
      return fallbackPath
    }
    
    // Try to find equivalent asset in default theme
    if (defaultTheme && theme.meta.id !== DEFAULT_THEME_ID) {
      const defaultAssetPath = assetPath.replace(theme._assetBasePath!, defaultTheme._assetBasePath!)
      if (await assetExists(defaultAssetPath)) {
        return defaultAssetPath
      }
    }
    
    return null
  }
}

// Load default theme for fallbacks
let defaultThemeCache: GameTheme | null = null

export async function getDefaultTheme(): Promise<GameTheme> {
  if (!defaultThemeCache) {
    defaultThemeCache = await loadTheme(DEFAULT_THEME_ID)
  }
  return defaultThemeCache
}

// Get asset resolver with default theme fallback
export async function getAssetResolver(theme: GameTheme): Promise<AssetResolver> {
  if (theme.meta.id === DEFAULT_THEME_ID) {
    // Default theme doesn't need fallbacks
    return createAssetResolver(theme)
  }
  
  const defaultTheme = await getDefaultTheme()
  return createAssetResolver(theme, defaultTheme)
}

// Utility to check if an asset exists
async function assetExists(path: string): Promise<boolean> {
  try {
    const response = await fetch(path, { method: 'HEAD' })
    return response.ok
  } catch {
    return false
  }
}

// Asset type detection
export function getAssetType(assetPath: string): 'png' | 'svg' | 'unknown' {
  const extension = assetPath.split('.').pop()?.toLowerCase()
  if (extension === 'png' || extension === 'jpg' || extension === 'jpeg') return 'png'
  if (extension === 'svg') return 'svg'
  return 'unknown'
} 