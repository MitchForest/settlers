'use client'

import { useState } from 'react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { User, Trophy, LogOut, Settings } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { toast } from 'sonner'
import { componentStyles } from '@/lib/design-system'
import { EditProfileDialog } from './EditProfileDialog'

interface UserAvatarMenuProps {
  className?: string
}

export function UserAvatarMenu({ className = "" }: UserAvatarMenuProps) {
  const { user, profile, signOut } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [showEditProfile, setShowEditProfile] = useState(false)

  if (!user || !profile) {
    return null
  }

  const handleSignOut = async () => {
    try {
      toast.info('Signing out...')
      await signOut()
      toast.success('Signed out successfully')
      // The auth context will handle redirecting/clearing state
    } catch (error) {
      console.error('Sign out error:', error)
      toast.error('Failed to sign out')
    }
  }

  // Calculate XP and win rate for display
  const xp = profile.total_score || 0
  const winRate = profile.games_played > 0 
    ? Math.round((profile.games_won / profile.games_played) * 100) 
    : 0

  return (
    <div className={`fixed bottom-8 left-8 z-50 ${className}`}>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="lg"
            className="h-16 w-16 p-0 bg-black/30 backdrop-blur-sm border border-white/20 hover:bg-black/40 hover:border-white/30 rounded-full transition-all duration-200"
          >
            <span className="text-3xl">{profile.avatar_emoji}</span>
          </Button>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent 
          side="top" 
          align="start"
          className="w-72 bg-black/30 backdrop-blur-sm border border-white/20 text-white mb-2 shadow-xl"
        >
          {/* User Info Header */}
          <div className="p-4 border-b border-white/20">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center border border-white/20">
                <span className="text-2xl">{profile.avatar_emoji}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white truncate">{profile.username}</p>
                <p className="text-sm text-white/60 truncate">{user.email}</p>
              </div>
            </div>
          </div>

          {/* Stats Section */}
          <div className="p-4 border-b border-white/20">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="space-y-1 bg-white/5 rounded-lg p-2 border border-white/10">
                <p className="text-lg font-bold text-white">{profile.games_played}</p>
                <p className="text-xs text-white/60">Games</p>
              </div>
              <div className="space-y-1 bg-green-500/10 rounded-lg p-2 border border-green-400/20">
                <p className="text-lg font-bold text-green-400">{profile.games_won}</p>
                <p className="text-xs text-green-300/60">Wins</p>
              </div>
              <div className="space-y-1 bg-purple-500/10 rounded-lg p-2 border border-purple-400/20">
                <p className="text-lg font-bold text-purple-400">{xp}</p>
                <p className="text-xs text-purple-300/60">XP</p>
              </div>
            </div>
            
            {/* Win Rate and Records */}
            <div className="mt-3 space-y-2">
              {profile.games_played > 0 && (
                <div className="text-center">
                  <span className="text-sm text-white/60">Win Rate: </span>
                  <span className="text-sm font-medium text-blue-400">{winRate}%</span>
                </div>
              )}
              
              {(profile.longest_road_record > 0 || profile.largest_army_record > 0) && (
                <div className="flex justify-center space-x-2">
                  {profile.longest_road_record > 0 && (
                    <Badge className="bg-orange-500/20 border-orange-400/20 text-orange-300 text-xs">
                      🛤️ {profile.longest_road_record}
                    </Badge>
                  )}
                  {profile.largest_army_record > 0 && (
                    <Badge className="bg-red-500/20 border-red-400/20 text-red-300 text-xs">
                      ⚔️ {profile.largest_army_record}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Menu Items */}
          <div className="p-1">
            <DropdownMenuItem 
              className={componentStyles.dropdownItem}
              onClick={() => {
                setIsOpen(false)
                setShowEditProfile(true)
              }}
            >
              <User className="w-4 h-4 mr-3" />
              Edit Profile
            </DropdownMenuItem>
            
            <DropdownMenuItem 
              className={componentStyles.dropdownItem}
              onClick={() => {
                setIsOpen(false)
                toast.info('Leaderboard coming soon!')
              }}
            >
              <Trophy className="w-4 h-4 mr-3" />
              Leaderboard
            </DropdownMenuItem>
            
            <DropdownMenuItem 
              className={componentStyles.dropdownItem}
              onClick={() => {
                setIsOpen(false)
                toast.info('Settings coming soon!')
              }}
            >
              <Settings className="w-4 h-4 mr-3" />
              Settings
            </DropdownMenuItem>
            
            <DropdownMenuSeparator className="bg-white/20" />
            
            <DropdownMenuItem 
              className={componentStyles.dropdownItemDestructive}
              onClick={() => {
                setIsOpen(false)
                handleSignOut()
              }}
            >
              <LogOut className="w-4 h-4 mr-3" />
              Sign Out
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit Profile Dialog */}
      <EditProfileDialog
        open={showEditProfile}
        onOpenChange={setShowEditProfile}
      />
    </div>
  )
} 