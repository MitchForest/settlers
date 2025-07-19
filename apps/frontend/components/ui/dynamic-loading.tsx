'use client'

import { ReactNode, useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertTriangle } from 'lucide-react'

interface DynamicLoadingProps {
  children: ReactNode
  loader: () => Promise<any> // eslint-disable-line @typescript-eslint/no-explicit-any
  loadingMessage?: string
  errorMessage?: string
  fallback?: ReactNode
}

export function DynamicLoading({ 
  children, 
  loader, 
  loadingMessage = "Loading game components...",
  errorMessage = "Failed to load game components",
  fallback 
}: DynamicLoadingProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function loadModule() {
      try {
        setIsLoading(true)
        setError(null)
        
        console.log(`🔄 ${loadingMessage}`)
        await loader()
        
        if (isMounted) {
          setIsLoaded(true)
          setIsLoading(false)
          console.log(`✅ Module loaded successfully`)
        }
      } catch (err) {
        if (isMounted) {
          const errorMsg = err instanceof Error ? err.message : errorMessage
          setError(errorMsg)
          setIsLoading(false)
          console.error(`❌ ${errorMessage}:`, err)
        }
      }
    }

    loadModule()

    return () => {
      isMounted = false
    }
  }, [loader, loadingMessage, errorMessage])

  if (isLoading) {
    if (fallback) {
      return <>{fallback}</>
    }

    return (
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            Loading
          </CardTitle>
          <CardDescription>{loadingMessage}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="max-w-md mx-auto border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Loading Error
          </CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            The game components could not be loaded. Please refresh the page to try again.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (isLoaded) {
    return <>{children}</>
  }

  return null
}

/**
 * Hook for managing dynamic loading state
 */
export function useDynamicLoading(loader: () => Promise<any>) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const [state, setState] = useState({
    isLoading: true,
    error: null as string | null,
    isLoaded: false
  })

  useEffect(() => {
    let isMounted = true

    async function loadModule() {
      try {
        setState(prev => ({ ...prev, isLoading: true, error: null }))
        await loader()
        
        if (isMounted) {
          setState({ isLoading: false, error: null, isLoaded: true })
        }
      } catch (err) {
        if (isMounted) {
          const errorMsg = err instanceof Error ? err.message : 'Loading failed'
          setState({ isLoading: false, error: errorMsg, isLoaded: false })
        }
      }
    }

    loadModule()

    return () => {
      isMounted = false
    }
  }, [loader])

  return state
} 