"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { GameTheme } from "@/lib/theme-types"
import { loadTheme } from "@/lib/theme-loader"

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
  const [loading, setLoading] = React.useState(false)
  
  const loadGameTheme = React.useCallback(async (themeId: string) => {
    try {
      setLoading(true)
      const loadedTheme = await loadTheme(themeId)
      setTheme(loadedTheme)
    } catch (error) {
      console.error('Failed to load theme:', error)
      setTheme(null) // Use geometric fallbacks on error
    } finally {
      setLoading(false)
    }
  }, [])

  const getResourceName = React.useCallback((resourceId: string): string => {
    if (!theme) return resourceId
    const resource = theme.resources.find(r => r.id === resourceId)
    return resource?.name || resourceId
  }, [theme])

  const getResourceColor = React.useCallback((resourceId: string): string => {
    if (!theme) return '#F4E4BC'
    const resource = theme.resources.find(r => r.id === resourceId)
    return resource?.color || '#F4E4BC'
  }, [theme])

  const getResourceIcon = React.useCallback((resourceId: string): string => {
    if (!theme) return '❓'
    const resource = theme.resources.find(r => r.id === resourceId)
    return resource?.icon || '❓'
  }, [theme])

  const contextValue = React.useMemo(() => ({
    theme,
    loading,
    loadTheme: loadGameTheme,
    getResourceName,
    getResourceColor,
    getResourceIcon,
  }), [theme, loading, loadGameTheme, getResourceName, getResourceColor, getResourceIcon])

  return (
    <GameThemeContext.Provider value={contextValue}>
      {children}
    </GameThemeContext.Provider>
  )
}

export function ThemeProvider({
  children,
  ...props
}: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
      <GameThemeProvider>
        {children}
      </GameThemeProvider>
    </NextThemesProvider>
  )
} 