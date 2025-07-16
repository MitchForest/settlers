// Theme loader - loads game themes with CSS colors (no assets for now)
// Structure: themes/[themeId]/config.json

import { GameTheme, AssetResolver } from './theme-types'

// Enhanced theme loader for CSS-only themes
export async function loadTheme(themeId: string): Promise<GameTheme> {
  const basePath = `/themes/${themeId}`
  const configUrl = `${basePath}/config.json`
  
  console.log('Loading theme config from:', configUrl)
  
  try {
    const configResponse = await fetch(configUrl)
    console.log('Config response status:', configResponse.status, configResponse.statusText)
    if (!configResponse.ok) {
      throw new Error(`Failed to load theme config: ${configResponse.status} from ${configUrl}`)
    }
    
    const theme: GameTheme = await configResponse.json()
    
    // Set base path for future asset resolution (if needed)
    theme._assetBasePath = basePath
    
    // For now, we're using CSS colors only, so no asset resolution needed
    console.log('Theme loaded successfully:', theme.meta.name)
    
    return theme
  } catch (error) {
    console.error(`Failed to load theme '${themeId}' from ${configUrl}:`, error)
    console.error('Full error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      themeId,
      basePath,
      configUrl,
      currentURL: typeof window !== 'undefined' ? window.location.href : 'SSR'
    })
    throw error
  }
}

// Create asset resolver (simplified for CSS-only themes)
function createAssetResolver(): AssetResolver {
  return async (): Promise<string | null> => {
    // For now, we're not using assets, just return null
    // This will cause components to fall back to CSS colors and emojis
    return null
  }
}

// Get asset resolver for a theme
export async function getAssetResolver(theme: GameTheme | null): Promise<AssetResolver | null> {
  if (!theme) {
    return null
  }
  
  // Simple resolver that always falls back to CSS
  return createAssetResolver()
}

// Asset type detection (kept for future use)
export function getAssetType(assetPath: string): 'png' | 'svg' | 'unknown' {
  const extension = assetPath.split('.').pop()?.toLowerCase()
  if (extension === 'png' || extension === 'jpg' || extension === 'jpeg') return 'png'
  if (extension === 'svg') return 'svg'
  return 'unknown'
} 