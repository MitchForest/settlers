'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  AlertTriangle, 
  RefreshCw, 
  Home, 
  LogIn,
  Loader2
} from 'lucide-react'
import { useUnifiedAuth } from '@/lib/unified-auth'

interface UnifiedErrorRecoveryProps {
  error: string
  gameId?: string
  onRetry?: () => void
  onRedirect?: (path: string) => void
}

export function UnifiedErrorRecovery({ 
  error, 
  gameId, 
  onRetry, 
  onRedirect 
}: UnifiedErrorRecoveryProps) {
  const router = useRouter()
  const auth = useUnifiedAuth()
  const [isRetrying, setIsRetrying] = useState(false)

  const handleRetry = async () => {
    setIsRetrying(true)
    try {
      if (onRetry) {
        await onRetry()
      } else {
        // Default retry: refresh the page
        window.location.reload()
      }
    } finally {
      setIsRetrying(false)
    }
  }

  const handleRedirect = (path: string) => {
    if (onRedirect) {
      onRedirect(path)
    } else {
      router.push(path)
    }
  }

  const getErrorActions = () => {
    // Not authenticated
    if (!auth.isAuthenticated()) {
      return (
        <div className="space-y-3">
          <Button 
            onClick={() => handleRedirect('/')} 
            className="w-full"
            variant="default"
          >
            <LogIn className="w-4 h-4 mr-2" />
            Sign In
          </Button>
          <Button 
            onClick={() => handleRedirect('/')} 
            variant="outline" 
            className="w-full"
          >
            <Home className="w-4 h-4 mr-2" />
            Go Home
          </Button>
        </div>
      )
    }

    // Connection/WebSocket errors
    if (error.toLowerCase().includes('connection') || error.toLowerCase().includes('websocket')) {
      return (
        <div className="space-y-3">
          <Button 
            onClick={handleRetry} 
            disabled={isRetrying}
            className="w-full"
            variant="default"
          >
            {isRetrying ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Reconnecting...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry Connection
              </>
            )}
          </Button>
          {gameId && (
            <Button 
              onClick={() => handleRedirect(`/lobby/${gameId}`)} 
              variant="outline" 
              className="w-full"
            >
              Return to Lobby
            </Button>
          )}
          <Button 
            onClick={() => handleRedirect('/')} 
            variant="outline" 
            className="w-full"
          >
            <Home className="w-4 h-4 mr-2" />
            Go Home
          </Button>
        </div>
      )
    }

    // Game-specific errors
    if (error.toLowerCase().includes('game') || error.toLowerCase().includes('lobby')) {
      return (
        <div className="space-y-3">
          <Button 
            onClick={handleRetry} 
            disabled={isRetrying}
            className="w-full"
            variant="default"
          >
            {isRetrying ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Retrying...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Try Again
              </>
            )}
          </Button>
          <Button 
            onClick={() => handleRedirect('/')} 
            variant="outline" 
            className="w-full"
          >
            <Home className="w-4 h-4 mr-2" />
            Find Another Game
          </Button>
        </div>
      )
    }

    // Generic error recovery
    return (
      <div className="space-y-3">
        <Button 
          onClick={handleRetry} 
          disabled={isRetrying}
          className="w-full"
          variant="default"
        >
          {isRetrying ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Retrying...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </>
          )}
        </Button>
        <Button 
          onClick={() => handleRedirect('/')} 
          variant="outline" 
          className="w-full"
        >
          <Home className="w-4 h-4 mr-2" />
          Go Home
        </Button>
      </div>
    )
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center pb-4">
        <div className="mx-auto mb-3 p-3 bg-red-100 dark:bg-red-900/20 rounded-full w-fit">
          <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
        </div>
        <CardTitle className="text-xl">Something went wrong</CardTitle>
        <CardDescription>
          We encountered an issue while processing your request
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            {error}
          </AlertDescription>
        </Alert>

        {getErrorActions()}
      </CardContent>
    </Card>
  )
}