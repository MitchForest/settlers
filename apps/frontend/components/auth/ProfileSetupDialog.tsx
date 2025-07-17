'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Check, User, RefreshCw } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { upsertUserProfile, isUsernameAvailable } from '@/lib/supabase'
import { toast } from 'sonner'

// Avatar emojis for selection
const AVATAR_EMOJIS = [
  '🧙‍♂️', '🧙‍♀️', '👨‍🌾', '👩‍🌾', '👨‍🏭', '👩‍🏭', '👨‍💼', '👩‍💼',
  '👨‍🔬', '👩‍🔬', '👨‍🎨', '👩‍🎨', '👨‍🍳', '👩‍🍳', '👨‍⚕️', '👩‍⚕️',
  '🤴', '👸', '👨‍🚀', '👩‍🚀', '👨‍✈️', '👩‍✈️', '🕵️‍♂️', '🕵️‍♀️',
  '👨‍🦱', '👩‍🦱', '👨‍🦰', '👩‍🦰', '👨‍🦳', '👩‍🦳', '👨‍🦲', '👩‍🦲'
]

interface ProfileSetupDialogProps {
  open: boolean
  onComplete: () => void
}

export function ProfileSetupDialog({ open, onComplete }: ProfileSetupDialogProps) {
  const [selectedAvatar, setSelectedAvatar] = useState('🧙‍♂️')
  const [username, setUsername] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [usernameError, setUsernameError] = useState('')
  const { user, refreshProfile } = useAuth()

  const validateUsername = async (value: string) => {
    if (!value.trim()) {
      setUsernameError('Username is required')
      return false
    }

    if (value.length < 3) {
      setUsernameError('Username must be at least 3 characters')
      return false
    }

    if (value.length > 20) {
      setUsernameError('Username must be 20 characters or less')
      return false
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
      setUsernameError('Username can only contain letters, numbers, - and _')
      return false
    }

    // Check if username is available
    const available = await isUsernameAvailable(value)
    if (!available) {
      setUsernameError('Username is already taken')
      return false
    }

    setUsernameError('')
    return true
  }

  const handleUsernameChange = (value: string) => {
    setUsername(value)
    setUsernameError('')
  }

  const handleCreateProfile = async () => {
    if (!user) {
      toast.error('No user session found')
      return
    }

    const isValid = await validateUsername(username.trim())
    if (!isValid) {
      return
    }

    setIsLoading(true)
    try {
      await upsertUserProfile({
        id: user.id,
        username: username.trim(),
        avatar_emoji: selectedAvatar,
        display_name: username.trim(),
        is_public: true,
        preferred_player_count: 4
      })

      await refreshProfile()
      toast.success('Profile created successfully!')
      onComplete()
    } catch (error) {
      console.error('Error creating profile:', error)
      toast.error('Failed to create profile. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const isFormValid = username.trim().length >= 3 && !usernameError

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-md bg-black/30 backdrop-blur-sm border border-white/20 text-white"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle className="text-white text-xl font-semibold text-center">
            🎭 Create Your Player Profile
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-purple-500/20 rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-purple-400" />
            </div>
            <p className="text-white/80 text-sm">
              Choose your avatar and username to get started
            </p>
          </div>

          {/* Avatar Picker */}
          <div className="space-y-3">
            <Label className="text-white/80">Choose Your Avatar</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start bg-white/5 border-white/20 text-white hover:bg-white/10 hover:border-white/30"
                  disabled={isLoading}
                >
                  <span className="text-3xl mr-3">{selectedAvatar}</span>
                  <span>Choose your avatar</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 bg-black/90 backdrop-blur-sm border border-white/20">
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-white">Choose Avatar</h4>
                  <div className="grid grid-cols-8 gap-2">
                    {AVATAR_EMOJIS.map((emoji) => (
                      <Button
                        key={emoji}
                        variant="ghost"
                        size="sm"
                        className={`w-10 h-10 p-0 text-xl transition-all ${
                          selectedAvatar === emoji 
                            ? 'bg-white/20 border border-white/40' 
                            : 'hover:bg-white/10'
                        }`}
                        onClick={() => setSelectedAvatar(emoji)}
                      >
                        {emoji}
                      </Button>
                    ))}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Username Input */}
          <div className="space-y-3">
            <Label htmlFor="username" className="text-white/80">Username</Label>
            <Input 
              id="username"
              value={username}
              onChange={(e) => handleUsernameChange(e.target.value)}
              onBlur={() => username.trim() && validateUsername(username.trim())}
              placeholder="Enter your username"
              disabled={isLoading}
              maxLength={20}
              className={`bg-white/5 border-white/20 text-white placeholder:text-white/50 focus:bg-white/10 focus:border-white/40 ${
                usernameError ? 'border-red-400 focus:border-red-400' : ''
              }`}
            />
            {usernameError && (
              <p className="text-red-400 text-sm">{usernameError}</p>
            )}
            <p className="text-white/60 text-xs">
              3-20 characters, letters, numbers, - and _ only
            </p>
          </div>

          {/* Create Profile Button */}
          <Button 
            onClick={handleCreateProfile}
            disabled={!isFormValid || isLoading}
            className="w-full bg-white/20 text-white border border-white/40 hover:bg-white/30 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Creating Profile...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Create Profile & Continue
              </>
            )}
          </Button>

          <div className="text-center text-xs text-white/60">
            You can change these settings later in your profile
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 