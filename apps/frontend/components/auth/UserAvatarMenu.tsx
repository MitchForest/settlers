'use client'

import { useState } from 'react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { User, Trophy, LogOut, Settings } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { toast } from 'sonner'

interface UserAvatarMenuProps {
  className?: string
}

export function UserAvatarMenu({ className = "" }: UserAvatarMenuProps) {
  const { user, profile, signOut } = useAuth()
  const [isOpen, setIsOpen] = useState(false)

  if (!user || !profile) {
    return null
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      toast.success('Signed out successfully')
    } catch (error) {
      console.error('Sign out error:', error)
      toast.error('Failed to sign out')
    }
  }

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
              <div className="space-y-1">
                <p className="text-lg font-bold text-white">{profile.games_played}</p>
                <p className="text-xs text-white/60">Games</p>
              </div>
              <div className="space-y-1">
                <p className="text-lg font-bold text-green-400">{profile.games_won}</p>
                <p className="text-xs text-white/60">Wins</p>
              </div>
              <div className="space-y-1">
                <p className="text-lg font-bold text-blue-400">{winRate}%</p>
                <p className="text-xs text-white/60">Win Rate</p>
              </div>
            </div>
            
            {(profile.longest_road_record > 0 || profile.largest_army_record > 0) && (
              <div className="flex justify-center space-x-2 mt-3">
                {profile.longest_road_record > 0 && (
                  <Badge className="bg-orange-500/20 border-orange-400/20 text-orange-300">
                    🛤️ {profile.longest_road_record}
                  </Badge>
                )}
                {profile.largest_army_record > 0 && (
                  <Badge className="bg-red-500/20 border-red-400/20 text-red-300">
                    ⚔️ {profile.largest_army_record}
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Menu Items */}
          <div className="p-1">
            <DropdownMenuItem 
              className="cursor-pointer text-white hover:bg-white/10 focus:bg-white/10"
              onClick={() => {
                setIsOpen(false)
                toast.info('Profile editing coming soon!')
              }}
            >
              <User className="w-4 h-4 mr-3" />
              Edit Profile
            </DropdownMenuItem>
            
            <DropdownMenuItem 
              className="cursor-pointer text-white hover:bg-white/10 focus:bg-white/10"
              onClick={() => {
                setIsOpen(false)
                toast.info('Leaderboard coming soon!')
              }}
            >
              <Trophy className="w-4 h-4 mr-3" />
              Leaderboard
            </DropdownMenuItem>
            
            <DropdownMenuItem 
              className="cursor-pointer text-white hover:bg-white/10 focus:bg-white/10"
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
              className="cursor-pointer text-red-300 hover:bg-red-500/10 focus:bg-red-500/10"
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
    </div>
  )
} 