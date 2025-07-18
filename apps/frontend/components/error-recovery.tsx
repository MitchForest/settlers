'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  AlertTriangle, 
  RefreshCw, 
  Home, 
  LogIn,
  Users,
  Search,
  Loader2,
  Plus
} from 'lucide-react'
import { SessionError, RecoveryAction } from '@/lib/session-types'
import { analyzeSessionError } from '@/lib/session-utils'
import { toast } from 'sonner'

interface ExtendedRecoveryAction extends RecoveryAction {
  primary?: boolean
}

interface GameErrorRecoveryProps {
  error: SessionError
  gameId?: string
  onRetry?: () => void
  className?: string
}

export function GameErrorRecovery({ 
  error, 
  gameId, 
  onRetry, 
  className 
}: GameErrorRecoveryProps) {
  const router = useRouter()
  const [isRecovering, setIsRecovering] = useState(false)
  const [gameCode, setGameCode] = useState('')
  const [showJoinForm, setShowJoinForm] = useState(false)
  
  const recovery = analyzeSessionError(error, gameId)

  const handleRecoveryAction = async (action: RecoveryAction) => {
    setIsRecovering(true)
    
    try {
      switch (action.type) {
        case 'refresh_session':
          if (onRetry) {
            onRetry()
          } else {
            window.location.reload()
          }
          break
          
        case 'rejoin_lobby':
          if (gameId) {
            // Redirect to lobby without session - will prompt for auth
            router.push(`/lobby/${gameId}`)
          } else {
            router.push('/')
          }
          break
          
        case 'rejoin_by_code':
          setShowJoinForm(true)
          setIsRecovering(false)
          return
          
        case 'redirect_home':
          router.push('/')
          break
          
        case 'create_new_game':
          router.push('/?action=create')
          break
          
        default:
          router.push('/')
      }
    } catch (error) {
      console.error('Recovery action failed:', error)
      toast.error('Recovery failed. Redirecting to home.')
      router.push('/')
    }
  }

  const handleJoinByCode = async () => {
    if (!gameCode.trim()) {
      toast.error('Please enter a game code')
      return
    }
    
    setIsRecovering(true)
    
    try {
      // Navigate to home with join action and pre-filled code
      router.push(`/?action=join&code=${encodeURIComponent(gameCode.trim())}`)
    } catch (error) {
      console.error('Join by code failed:', error)
      toast.error('Failed to join game')
      setIsRecovering(false)
    }
  }

  // Specialized error messages and actions based on error type
  const getErrorDetails = (): {
    title: string
    description: string
    icon: React.ReactNode
    actions: ExtendedRecoveryAction[]
  } => {
    switch (error.type) {
      case 'expired':
        return {
          title: 'Session Expired',
          description: 'Your game session has expired. You can refresh to get a new session or rejoin manually.',
          icon: <RefreshCw className="h-5 w-5 text-yellow-500" />,
          actions: [
            { ...recovery, primary: true },
            { 
              type: 'rejoin_by_code', 
              message: 'Or rejoin with game code',
              buttonText: 'Join by Code'
            }
          ]
        }
        
              case 'game_not_found':
        return {
          title: 'Game Not Found',
          description: 'This game no longer exists or has ended. You can create a new game or join a different one.',
          icon: <Search className="h-5 w-5 text-red-500" />,
          actions: [
            { 
              type: 'create_new_game',
              message: 'Start fresh with a new game',
              buttonText: 'Create New Game',
              primary: true
            },
            { 
              type: 'rejoin_by_code',
              message: 'Join a different game',
              buttonText: 'Join by Code'
            },
            { 
              type: 'redirect_home',
              message: 'Go back to main menu',
              buttonText: 'Go Home'
            }
          ]
        }
        
              case 'player_not_found':
        return {
          title: 'Player Not Found',
          description: 'You are no longer part of this game. You may have been removed or the game was reset.',
          icon: <Users className="h-5 w-5 text-orange-500" />,
          actions: [
            { ...recovery, primary: true },
            { 
              type: 'redirect_home',
              message: 'Return to main menu',
              buttonText: 'Go Home'
            }
          ]
        }
        
      case 'permission_denied':
        return {
          title: 'Permission Denied',
          description: 'You don&apos;t have permission to perform this action. Try rejoining the game.',
          icon: <AlertTriangle className="h-5 w-5 text-red-500" />,
          actions: [
            { ...recovery, primary: true },
            { 
              type: 'redirect_home',
              message: 'Go to main menu',
              buttonText: 'Go Home'
            }
          ]
        }
        
      case 'invalid_signature':
        return {
          title: 'Invalid Session',
          description: 'Your session token is corrupted or invalid. Please sign in again.',
          icon: <LogIn className="h-5 w-5 text-purple-500" />,
          actions: [
            { 
              type: 'redirect_home',
              message: 'Sign in again',
              buttonText: 'Go Home & Sign In',
              primary: true
            },
            { 
              type: 'rejoin_by_code',
              message: 'Try joining manually',
              buttonText: 'Join by Code'
            }
          ]
        }
        
      default:
        return {
          title: 'Session Error',
          description: error.message || 'An unexpected error occurred with your game session.',
          icon: <AlertTriangle className="h-5 w-5 text-gray-500" />,
          actions: [
            { ...recovery, primary: true },
            { 
              type: 'redirect_home',
              message: 'Go to main menu',
              buttonText: 'Go Home'
            }
          ]
        }
    }
  }

  const errorDetails = getErrorDetails()

  if (showJoinForm) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-500" />
            <CardTitle>Join Game by Code</CardTitle>
          </div>
          <CardDescription>
            Enter the game code to rejoin or join a different game
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="game-code">Game Code</Label>
            <Input
              id="game-code"
              value={gameCode}
              onChange={(e) => setGameCode(e.target.value.toUpperCase())}
              placeholder="Enter 4-letter game code"
              maxLength={4}
              className="text-center font-mono text-lg"
              disabled={isRecovering}
            />
          </div>
          
          <div className="flex gap-2">
            <Button 
              onClick={handleJoinByCode}
              disabled={!gameCode.trim() || isRecovering}
              className="flex-1"
            >
              {isRecovering ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Users className="h-4 w-4 mr-2" />
              )}
              Join Game
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowJoinForm(false)}
              disabled={isRecovering}
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center gap-2">
          {errorDetails.icon}
          <CardTitle>{errorDetails.title}</CardTitle>
        </div>
        <CardDescription>
          {errorDetails.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Error details for debugging */}
        {process.env.NODE_ENV === 'development' && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs font-mono">
              Error Type: {error.type}
              {error.gameId && <><br />Game ID: {error.gameId}</>}
              {error.playerId && <><br />Player ID: {error.playerId}</>}
            </AlertDescription>
          </Alert>
        )}
        
        {/* Recovery actions */}
        <div className="space-y-2">
          {errorDetails.actions.map((action, index) => (
            <Button
              key={index}
              onClick={() => handleRecoveryAction(action)}
              disabled={isRecovering}
              variant={action.primary ? 'default' : 'outline'}
              className="w-full justify-start"
            >
              {isRecovering ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : action.type === 'refresh_session' ? (
                <RefreshCw className="h-4 w-4 mr-2" />
              ) : action.type === 'rejoin_by_code' ? (
                <Users className="h-4 w-4 mr-2" />
              ) : action.type === 'create_new_game' ? (
                <Plus className="h-4 w-4 mr-2" />
              ) : (
                <Home className="h-4 w-4 mr-2" />
              )}
              {action.buttonText}
            </Button>
          ))}
        </div>
        
        {error.canRecover && (
          <p className="text-xs text-muted-foreground text-center">
            Don&apos;t worry - your game progress is saved and you can rejoin anytime.
          </p>
        )}
      </CardContent>
    </Card>
  )
} 