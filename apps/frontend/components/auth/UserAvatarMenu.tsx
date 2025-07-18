'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { User, Settings, LogOut, Edit, Users, UserPlus, UserMinus, Check, X, Search } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { EditProfileDialog } from './EditProfileDialog'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import * as api from '@/lib/api'
import { getFriendsWebSocket } from '@/lib/websocket-friends'

interface Friend {
  id: string
  friendUser: {
    id: string
    name: string
    email: string
    avatarEmoji: string | null
  }
  createdAt: string
}

interface FriendRequest {
  id: string
  fromUser: {
    id: string
    name: string
    email: string
    avatarEmoji: string | null
  }
  message: string | null
  createdAt: string
}

interface SearchResult {
  id: string
  name: string
  email: string
  avatarEmoji: string | null
  friendshipStatus: 'none' | 'pending_sent' | 'pending_received' | 'friends'
}

export function UserAvatarMenu() {
  const { user, profile, isGuest } = useAuth()
  const [showEditProfile, setShowEditProfile] = useState(false)
  
  // Friends state
  const [friends, setFriends] = useState<Friend[]>([])
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [friendsLoading, setFriendsLoading] = useState(false)

  // Load friends data when component mounts
  useEffect(() => {
    if (user && !isGuest) {
      loadFriends()
      loadFriendRequests()
      
      // Connect to WebSocket for real-time updates
      const friendsWS = getFriendsWebSocket()
      
      // Set up event listeners
      const handleFriendRequestReceived = (data: any) => {
        console.log('Friend request received:', data)
        loadFriendRequests() // Refresh friend requests
      }
      
      const handleFriendRequestAccepted = (data: any) => {
        console.log('Friend request accepted:', data)
        loadFriends() // Refresh friends list
        loadFriendRequests() // Refresh requests (remove accepted one)
      }
      
      const handleFriendRequestRejected = (data: any) => {
        console.log('Friend request rejected:', data)
        // No need to refresh anything, just the toast notification
      }
      
      const handleFriendRemoved = (data: any) => {
        console.log('Friend removed:', data)
        loadFriends() // Refresh friends list
      }
      
      const handlePresenceUpdate = (data: any) => {
        console.log('Friend presence update:', data)
        loadFriends() // Refresh friends list to update presence
      }
      
      // Add listeners
      friendsWS.on('friend_request_received', handleFriendRequestReceived)
      friendsWS.on('friend_request_accepted', handleFriendRequestAccepted)
      friendsWS.on('friend_request_rejected', handleFriendRequestRejected)
      friendsWS.on('friend_removed', handleFriendRemoved)
      friendsWS.on('friend_presence_update', handlePresenceUpdate)
      
      // Connect to WebSocket
      friendsWS.connect(user.id).catch(error => {
        console.error('Failed to connect to friends WebSocket:', error)
      })
      
      // Cleanup function
      return () => {
        friendsWS.off('friend_request_received', handleFriendRequestReceived)
        friendsWS.off('friend_request_accepted', handleFriendRequestAccepted)
        friendsWS.off('friend_request_rejected', handleFriendRequestRejected)
        friendsWS.off('friend_removed', handleFriendRemoved)
        friendsWS.off('friend_presence_update', handlePresenceUpdate)
      }
    }
  }, [user, isGuest])

  const loadFriends = async () => {
    try {
      setFriendsLoading(true)
      const response = await api.getFriends()
      setFriends(response.friends || [])
    } catch (error) {
      console.error('Failed to load friends:', error)
    } finally {
      setFriendsLoading(false)
    }
  }

  const loadFriendRequests = async () => {
    try {
      const response = await api.getFriendRequests()
      setFriendRequests(response.requests || [])
    } catch (error) {
      console.error('Failed to load friend requests:', error)
    }
  }

  const searchUsers = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    try {
      setSearchLoading(true)
      const response = await api.searchUsers(searchQuery.trim())
      setSearchResults(response.users || [])
    } catch (error) {
      console.error('Failed to search users:', error)
      toast.error('Failed to search users')
    } finally {
      setSearchLoading(false)
    }
  }

  const sendFriendRequest = async (userId: string) => {
    try {
      await api.sendFriendRequest(userId)
      toast.success('Friend request sent!')
      // Update search results to reflect new status
      setSearchResults(prev => 
        prev.map(user => 
          user.id === userId 
            ? { ...user, friendshipStatus: 'pending_sent' as const }
            : user
        )
      )
    } catch (error) {
      console.error('Failed to send friend request:', error)
      toast.error('Failed to send friend request')
    }
  }

  const acceptFriendRequest = async (requestId: string) => {
    try {
      await api.acceptFriendRequest(requestId)
      toast.success('Friend request accepted!')
      loadFriends()
      loadFriendRequests()
    } catch (error) {
      console.error('Failed to accept friend request:', error)
      toast.error('Failed to accept friend request')
    }
  }

  const rejectFriendRequest = async (requestId: string) => {
    try {
      await api.rejectFriendRequest(requestId)
      toast.success('Friend request rejected')
      loadFriendRequests()
    } catch (error) {
      console.error('Failed to reject friend request:', error)
      toast.error('Failed to reject friend request')
    }
  }

  const removeFriend = async (friendshipId: string, friendName: string) => {
    try {
      await api.removeFriend(friendshipId)
      toast.success(`Removed ${friendName} from friends`)
      loadFriends()
    } catch (error) {
      console.error('Failed to remove friend:', error)
      toast.error('Failed to remove friend')
    }
  }

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      toast.success('Signed out successfully')
    } catch (error) {
      console.error('Error signing out:', error)
      toast.error('Error signing out')
    }
  }

  if (!user || isGuest) {
    return null
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            className="h-12 w-12 rounded-full p-0 bg-white/5 border border-white/20 hover:bg-white/10 hover:border-white/30 transition-all"
          >
            <span className="text-3xl">{profile?.avatarEmoji || '👤'}</span>
          </Button>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent 
          align="end" 
          className="w-80 bg-black/90 backdrop-blur-sm border border-white/20 text-white"
        >
          {/* User Info Header */}
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center border border-white/20">
                <span className="text-2xl">{profile?.avatarEmoji || '👤'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-lg font-semibold text-white truncate">
                    {profile?.name || 'User'}
                  </p>
                  <Badge variant="secondary" className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                    Player
                  </Badge>
                </div>
                <p className="text-sm text-white/60 truncate">
                  {profile?.email}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="p-4 border-b border-white/10">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xl font-bold text-white">-</p>
                <p className="text-xs text-white/60">Games</p>
              </div>
              <div>
                <p className="text-xl font-bold text-green-400">-</p>
                <p className="text-xs text-white/60">Wins</p>
              </div>
              <div>
                <p className="text-xl font-bold text-blue-400">{friends.length}</p>
                <p className="text-xs text-white/60">Friends</p>
              </div>
            </div>
          </div>

          {/* Friends Section */}
          <div className="p-4 border-b border-white/10 max-h-96 overflow-y-auto">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-white" />
              <span className="text-sm font-semibold text-white">Friends</span>
              {friendRequests.length > 0 && (
                <Badge variant="secondary" className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">
                  {friendRequests.length}
                </Badge>
              )}
            </div>

            {/* Search Users */}
            <div className="mb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/60" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchUsers()}
                  placeholder="Search users..."
                  className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/60 text-sm h-8"
                />
              </div>
              {searchQuery && (
                <Button
                  onClick={searchUsers}
                  disabled={searchLoading}
                  className="w-full mt-2 h-7 text-xs bg-blue-600 hover:bg-blue-700"
                >
                  {searchLoading ? 'Searching...' : 'Search'}
                </Button>
              )}
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-white/60 mb-2">Search Results</p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {searchResults.map(user => (
                    <div key={user.id} className="flex items-center justify-between p-2 rounded bg-white/5">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-sm">{user.avatarEmoji || '👤'}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-white truncate">{user.name}</p>
                          <p className="text-xs text-white/60 truncate">{user.email}</p>
                        </div>
                      </div>
                      {user.friendshipStatus === 'none' && (
                        <Button
                          onClick={() => sendFriendRequest(user.id)}
                          size="sm"
                          className="h-6 px-2 text-xs bg-green-600 hover:bg-green-700"
                        >
                          <UserPlus className="w-3 h-3" />
                        </Button>
                      )}
                      {user.friendshipStatus === 'pending_sent' && (
                        <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-300 text-xs">
                          Sent
                        </Badge>
                      )}
                      {user.friendshipStatus === 'friends' && (
                        <Badge variant="secondary" className="bg-green-500/20 text-green-300 text-xs">
                          Friends
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Friend Requests */}
            {friendRequests.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-white/60 mb-2">Friend Requests</p>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {friendRequests.map(request => (
                    <div key={request.id} className="flex items-center justify-between p-2 rounded bg-white/5">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-sm">{request.fromUser.avatarEmoji || '👤'}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-white truncate">{request.fromUser.name}</p>
                          {request.message && (
                            <p className="text-xs text-white/60 truncate">"{request.message}"</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          onClick={() => acceptFriendRequest(request.id)}
                          size="sm"
                          className="h-6 px-1 bg-green-600 hover:bg-green-700"
                        >
                          <Check className="w-3 h-3" />
                        </Button>
                        <Button
                          onClick={() => rejectFriendRequest(request.id)}
                          size="sm"
                          variant="outline"
                          className="h-6 px-1 border-red-500/50 text-red-400 hover:bg-red-500/10"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Friends List */}
            <div>
              <p className="text-xs text-white/60 mb-2">Your Friends ({friends.length})</p>
              {friendsLoading ? (
                <p className="text-xs text-white/60 text-center py-2">Loading...</p>
              ) : friends.length === 0 ? (
                <p className="text-xs text-white/60 text-center py-2">No friends yet</p>
              ) : (
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {friends.map(friend => (
                    <div key={friend.id} className="flex items-center justify-between p-2 rounded bg-white/5">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-sm">{friend.friendUser.avatarEmoji || '👤'}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-white truncate">{friend.friendUser.name}</p>
                        </div>
                      </div>
                      <Button
                        onClick={() => removeFriend(friend.id, friend.friendUser.name)}
                        size="sm"
                        variant="outline"
                        className="h-6 px-1 border-red-500/50 text-red-400 hover:bg-red-500/10"
                      >
                        <UserMinus className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Menu Items */}
          <div className="p-2">
            <DropdownMenuItem 
              onClick={() => setShowEditProfile(true)}
              className="flex items-center gap-2 px-3 py-2 text-white hover:bg-white/10 focus:bg-white/10 cursor-pointer"
            >
              <Edit className="w-4 h-4" />
              <span>Edit Profile</span>
            </DropdownMenuItem>
            
            <DropdownMenuItem 
              disabled
              className="flex items-center gap-2 px-3 py-2 text-white/50 cursor-not-allowed"
            >
              <Settings className="w-4 h-4" />
              <span>Settings (Coming Soon)</span>
            </DropdownMenuItem>
            
            <DropdownMenuSeparator className="bg-white/10" />
            
            <DropdownMenuItem 
              onClick={handleSignOut}
              className="flex items-center gap-2 px-3 py-2 text-red-400 hover:bg-red-500/10 focus:bg-red-500/10 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditProfileDialog 
        open={showEditProfile} 
        onOpenChange={setShowEditProfile} 
      />
    </>
  )
} 