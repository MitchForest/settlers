"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { GameTheme } from "@/lib/theme-types"
import { ThemeLoader } from "@/lib/theme-loader"

interface ThemeProviderProps {
  children: React.ReactNode
  attribute?: "class" | "data-theme"
  defaultTheme?: string
  enableSystem?: boolean
  disableTransitionOnChange?: boolean
}

// Game theme context
interface GameThemeContextType {
  theme: GameTheme | null
  loading: boolean
  loadTheme: (themeId: string) => Promise<void>
  getResourceName: (resourceId: string) => string
  getResourceColor: (resourceId: string) => string
  getResourceIcon: (resourceId: string) => string
}

const GameThemeContext = React.createContext<GameThemeContextType | undefined>(undefined)

export function useGameTheme() {
  const context = React.useContext(GameThemeContext)
  if (!context) {
    throw new Error('useGameTheme must be used within a ThemeProvider')
  }
  return context
}

function GameThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = React.useState<GameTheme | null>(null)
  const [loading, setLoading] = React.useState(true)
  
  const themeLoader = React.useMemo(() => ThemeLoader.getInstance(), [])

  const loadTheme = React.useCallback(async (themeId: string) => {
    setLoading(true)
    try {
      const newTheme = await themeLoader.loadTheme(themeId)
      setTheme(newTheme)
    } catch (error) {
      console.error('Failed to load theme:', error)
    } finally {
      setLoading(false)
    }
  }, [themeLoader])

  // Load default theme on mount
  React.useEffect(() => {
    console.log('ThemeProvider: Loading default theme...')
    loadTheme('default').then(() => {
      console.log('ThemeProvider: Default theme loaded successfully')
    })
  }, [loadTheme])

  const getResourceName = React.useCallback((resourceId: string): string => {
    if (!theme) return resourceId
    const resource = theme.resources.find(r => r.id === resourceId)
    return resource?.name || resourceId
  }, [theme])

  const getResourceColor = React.useCallback((resourceId: string): string => {
    if (!theme) return '#666666'
    const resource = theme.resources.find(r => r.id === resourceId)
    return resource?.color || '#666666'
  }, [theme])

  const getResourceIcon = React.useCallback((resourceId: string): string => {
    if (!theme) return '?'
    const resource = theme.resources.find(r => r.id === resourceId)
    return resource?.icon || '?'
  }, [theme])

  const value: GameThemeContextType = {
    theme,
    loading,
    loadTheme,
    getResourceName,
    getResourceColor,
    getResourceIcon
  }

  return (
    <GameThemeContext.Provider value={value}>
      {children}
    </GameThemeContext.Provider>
  )
}

export function ThemeProvider({ 
  children, 
  attribute = "class",
  defaultTheme = "system",
  enableSystem = true,
  disableTransitionOnChange = false,
  ...props 
}: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute={attribute}
      defaultTheme={defaultTheme}
      enableSystem={enableSystem}
      disableTransitionOnChange={disableTransitionOnChange}
      {...props}
    >
      <GameThemeProvider>
        {children}
      </GameThemeProvider>
    </NextThemesProvider>
  )
} 