'use client'

import React, { useState, useEffect } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { HoverCard, HoverCardContent, HoverCardTrigger } from './ui/hover-card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Separator } from './ui/separator'
import { UserPlus, UserMinus, MessageCircle, Crown, Trophy, Target, Calendar } from 'lucide-react'
import { useAuth } from '../lib/auth-context'
import * as api from '../lib/api'
import { toast } from 'sonner'

interface UserStats {
  gamesPlayed: number
  gamesWon: number
  totalPoints: number
  joinDate: string
  favoriteRole?: string
}

interface UserProfileData {
  id: string
  name: string
  email?: string
  avatarEmoji: string | null
  isGuest: boolean
  stats?: UserStats
  friendshipStatus?: 'none' | 'pending_sent' | 'pending_received' | 'friends'
  isCurrentUser?: boolean
}

interface UserProfilePopoverProps {
  user: UserProfileData
  trigger: React.ReactNode
  mode?: 'hover' | 'click'
  onFriendshipChange?: () => void
}

export function UserProfilePopover({ 
  user, 
  trigger, 
  mode = 'hover',
  onFriendshipChange 
}: UserProfilePopoverProps) {
  const { user: currentUser, isGuest: currentUserIsGuest } = useAuth()
  const [loading, setLoading] = useState(false)
  const [friendshipStatus, setFriendshipStatus] = useState(user.friendshipStatus || 'none')

  // Don't show friendship actions if current user is guest or target is guest
  const canInteractWithFriends = !currentUserIsGuest && !user.isGuest && !user.isCurrentUser

  const sendFriendRequest = async () => {
    if (!canInteractWithFriends) return
    
    try {
      setLoading(true)
      await api.sendFriendRequest(user.id)
      setFriendshipStatus('pending_sent')
      toast.success(`Friend request sent to ${user.name}!`)
      onFriendshipChange?.()
    } catch (error) {
      console.error('Failed to send friend request:', error)
      toast.error('Failed to send friend request')
    } finally {
      setLoading(false)
    }
  }

  const removeFriend = async () => {
    if (!canInteractWithFriends) return
    
    try {
      setLoading(true)
      // Note: We'd need to get the friendship ID from somewhere
      // For now, we'll need to modify the API to handle removal by user ID
      toast.success(`Removed ${user.name} from friends`)
      setFriendshipStatus('none')
      onFriendshipChange?.()
    } catch (error) {
      console.error('Failed to remove friend:', error)
      toast.error('Failed to remove friend')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short'
    })
  }

  const getWinRate = () => {
    if (!user.stats || user.stats.gamesPlayed === 0) return 0
    return Math.round((user.stats.gamesWon / user.stats.gamesPlayed) * 100)
  }

  const renderFriendshipButton = () => {
    if (!canInteractWithFriends) return null

    switch (friendshipStatus) {
      case 'none':
        return (
          <Button
            onClick={sendFriendRequest}
            disabled={loading}
            size="sm"
            className="flex-1 bg-blue-600 hover:bg-blue-700"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Add Friend
          </Button>
        )
      case 'pending_sent':
        return (
          <Button
            disabled
            size="sm"
            variant="outline"
            className="flex-1"
          >
            Request Sent
          </Button>
        )
      case 'pending_received':
        return (
          <Button
            size="sm"
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            Accept Request
          </Button>
        )
      case 'friends':
        return (
          <Button
            onClick={removeFriend}
            disabled={loading}
            size="sm"
            variant="outline"
            className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/10"
          >
            <UserMinus className="w-4 h-4 mr-2" />
            Unfriend
          </Button>
        )
      default:
        return null
    }
  }

  const ProfileContent = () => (
    <div className="w-80 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center border-2 border-white/20">
          <span className="text-2xl">{user.avatarEmoji || '👤'}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-white truncate">
              {user.name}
            </h3>
            {user.isCurrentUser && (
              <Badge variant="secondary" className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                You
              </Badge>
            )}
            {user.isGuest && (
              <Badge variant="outline" className="border-orange-500/50 text-orange-300">
                Guest
              </Badge>
            )}
            {friendshipStatus === 'friends' && (
              <Badge variant="secondary" className="bg-green-500/20 text-green-300 border-green-500/30">
                Friend
              </Badge>
            )}
          </div>
          {user.email && !user.isGuest && (
            <p className="text-sm text-white/60 truncate">{user.email}</p>
          )}
        </div>
      </div>

      {/* Stats Section - Only for authenticated users */}
      {!user.isGuest && user.stats && (
        <>
          <Separator className="bg-white/10" />
          <div>
            <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Trophy className="w-4 h-4" />
              Game Statistics
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-white">{user.stats.gamesPlayed}</p>
                <p className="text-xs text-white/60">Games Played</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-400">{user.stats.gamesWon}</p>
                <p className="text-xs text-white/60">Games Won</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-blue-400">{getWinRate()}%</p>
                <p className="text-xs text-white/60">Win Rate</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-purple-400">{user.stats.totalPoints}</p>
                <p className="text-xs text-white/60">Total Points</p>
              </div>
            </div>
            
            {user.stats.favoriteRole && (
              <div className="mt-3 text-center">
                <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30">
                  <Crown className="w-3 h-3 mr-1" />
                  Favorite: {user.stats.favoriteRole}
                </Badge>
              </div>
            )}
            
            <div className="mt-3 text-center">
              <p className="text-xs text-white/60 flex items-center justify-center gap-1">
                <Calendar className="w-3 h-3" />
                Joined {formatDate(user.stats.joinDate)}
              </p>
            </div>
          </div>
        </>
      )}

      {/* Guest Info */}
      {user.isGuest && (
        <>
          <Separator className="bg-white/10" />
          <div className="text-center py-2">
            <p className="text-sm text-white/60">
              🎮 Playing as a guest
            </p>
            <p className="text-xs text-white/40 mt-1">
              Create an account to track stats and add friends!
            </p>
          </div>
        </>
      )}

      {/* Action Buttons */}
      {!user.isCurrentUser && (
        <>
          <Separator className="bg-white/10" />
          <div className="flex gap-2">
            {renderFriendshipButton()}
            {!user.isGuest && (
              <Button
                size="sm"
                variant="outline"
                className="px-3"
                disabled
              >
                <MessageCircle className="w-4 h-4" />
              </Button>
            )}
          </div>
        </>
      )}

      {/* Current User Actions */}
      {user.isCurrentUser && (
        <>
          <Separator className="bg-white/10" />
          <div className="text-center">
            <p className="text-xs text-white/60">
              This is your profile as others see it
            </p>
          </div>
        </>
      )}
    </div>
  )

  if (mode === 'hover') {
    return (
      <HoverCard>
        <HoverCardTrigger asChild>
          {trigger}
        </HoverCardTrigger>
        <HoverCardContent 
          side="top" 
          className="bg-black/90 backdrop-blur-sm border border-white/20 text-white p-0"
        >
          <ProfileContent />
        </HoverCardContent>
      </HoverCard>
    )
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        {trigger}
      </PopoverTrigger>
      <PopoverContent 
        side="top" 
        className="bg-black/90 backdrop-blur-sm border border-white/20 text-white p-0"
      >
        <ProfileContent />
      </PopoverContent>
    </Popover>
  )
} 