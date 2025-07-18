'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { User, Settings, LogOut, Edit } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { EditProfileDialog } from './EditProfileDialog'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

export function UserAvatarMenu() {
  const { user, profile, isGuest } = useAuth()
  const [showEditProfile, setShowEditProfile] = useState(false)

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
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-white">-</p>
                <p className="text-xs text-white/60">Games Played</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-400">-</p>
                <p className="text-xs text-white/60">Games Won</p>
              </div>
            </div>
            <div className="mt-3 text-center">
              <p className="text-xs text-white/60">
                Game statistics will be available soon
              </p>
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