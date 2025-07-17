'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Check, RefreshCw } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { upsertUserProfile, isUsernameAvailable } from '@/lib/supabase'
import { AVATAR_EMOJIS } from '@/lib/avatar-constants'
import { componentStyles, designSystem, ds } from '@/lib/design-system'
import { toast } from 'sonner'

interface EditProfileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditProfileDialog({ open, onOpenChange }: EditProfileDialogProps) {
  const { user, profile, refreshProfile } = useAuth()
  
  // Initialize with current profile values
  const [selectedAvatar, setSelectedAvatar] = useState('')
  const [username, setUsername] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [usernameError, setUsernameError] = useState('')
  const [hasChanges, setHasChanges] = useState(false)

  // Update state when profile changes or dialog opens
  useEffect(() => {
    if (profile && open) {
      setSelectedAvatar(profile.avatar_emoji || '🧙‍♂️')
      setUsername(profile.username || '')
      setUsernameError('')
      setHasChanges(false)
    }
  }, [profile, open])

  // Check for changes
  useEffect(() => {
    if (profile) {
      const avatarChanged = selectedAvatar !== (profile.avatar_emoji || '🧙‍♂️')
      const usernameChanged = username !== (profile.username || '')
      setHasChanges(avatarChanged || usernameChanged)
    }
  }, [selectedAvatar, username, profile])

  const validateUsername = async (value: string): Promise<boolean> => {
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
      setUsernameError('Username can only contain letters, numbers, hyphens, and underscores')
      return false
    }

    // Only check availability if username actually changed
    if (profile && value !== profile.username) {
      const available = await isUsernameAvailable(value)
      if (!available) {
        setUsernameError('This username is already taken')
        return false
      }
    }

    setUsernameError('')
    return true
  }

  const handleSave = async () => {
    if (!user || !profile) return

    const isValid = await validateUsername(username)
    if (!isValid) return

    setIsLoading(true)
    try {
      await upsertUserProfile({
        id: user.id,
        username: username.trim(),
        avatar_emoji: selectedAvatar,
        display_name: username.trim()
      })

      await refreshProfile()
      onOpenChange(false)
      toast.success('Profile updated successfully!')
    } catch (error) {
      console.error('Profile update error:', error)
      toast.error('Failed to update profile')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    if (profile) {
      setSelectedAvatar(profile.avatar_emoji || '🧙‍♂️')
      setUsername(profile.username || '')
      setUsernameError('')
      setHasChanges(false)
    }
    onOpenChange(false)
  }

  if (!user || !profile) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={ds(componentStyles.glassCard, 'sm:max-w-md')}>
        <DialogHeader>
          <DialogTitle className={ds(designSystem.text.heading, 'text-xl')}>
            Edit Profile
          </DialogTitle>
          <DialogDescription className={designSystem.text.muted}>
            Update your avatar and username
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Avatar Selection */}
          <div className="space-y-2">
            <Label className={designSystem.text.body}>Avatar</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button className={ds(
                  componentStyles.buttonPrimary,
                  'w-full justify-start'
                )}>
                  <span className="text-xl mr-3">{selectedAvatar}</span>
                  Choose Avatar
                </Button>
              </PopoverTrigger>
              <PopoverContent className={ds(
                componentStyles.glassCard,
                'w-80 p-4 max-h-96'
              )}>
                <div className="space-y-3">
                  <h4 className={ds(designSystem.text.body, 'font-medium')}>Choose Avatar</h4>
                  <div className="max-h-72 overflow-y-auto pr-2 -mr-2">
                    <div className="grid grid-cols-8 gap-2">
                      {AVATAR_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => setSelectedAvatar(emoji)}
                          className={ds(
                            componentStyles.avatarButton,
                            selectedAvatar === emoji 
                              ? ds(designSystem.accents.blue.subtle, designSystem.accents.blue.hover)
                              : ds(designSystem.interactive.primary.base, designSystem.interactive.primary.hover)
                          )}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Username Input */}
          <div className="space-y-2">
            <Label className={designSystem.text.body}>Username</Label>
            <div className="relative">
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className={ds(
                  componentStyles.input,
                  usernameError ? 'border-red-400/50 focus:border-red-400' : ''
                )}
                maxLength={20}
                disabled={isLoading}
              />
              {isLoading && (
                <RefreshCw className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/50 animate-spin" />
              )}
            </div>
            {usernameError && (
              <p className="text-red-400 text-sm">{usernameError}</p>
            )}
            <p className={ds(designSystem.text.muted, 'text-xs')}>
              3-20 characters, letters, numbers, hyphens, and underscores only
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-2">
            <Button
              onClick={handleCancel}
              disabled={isLoading}
              className={ds(componentStyles.buttonPrimary, 'flex-1')}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isLoading || !hasChanges || !!usernameError || !username.trim()}
              className={ds(componentStyles.buttonSecondary, 'flex-1')}
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 