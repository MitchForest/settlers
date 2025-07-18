'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { RefreshCw } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { upsertUserProfile } from '@/lib/supabase'
import { AVATAR_EMOJIS } from '@/lib/avatar-constants'
// Removed unused imports: componentStyles, designSystem, ds
import { toast } from 'sonner'

interface EditProfileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EditProfileDialog({ open, onOpenChange }: EditProfileDialogProps) {
  const { user, profile, refreshProfile } = useAuth()
  
  // Initialize with current profile values
  const [selectedAvatar, setSelectedAvatar] = useState('')
  const [name, setName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [nameError, setNameError] = useState('')
  const [hasChanges, setHasChanges] = useState(false)

  // Update state when profile changes or dialog opens
  useEffect(() => {
    if (profile && open) {
      setSelectedAvatar(profile.avatarEmoji || '🧙‍♂️')
      setName(profile.name || '')
      setNameError('')
      setHasChanges(false)
    }
  }, [profile, open])

  // Check for changes
  useEffect(() => {
    if (profile) {
      const avatarChanged = selectedAvatar !== (profile.avatarEmoji || '🧙‍♂️')
      const nameChanged = name !== (profile.name || '')
      setHasChanges(avatarChanged || nameChanged)
    }
  }, [selectedAvatar, name, profile])

  const validateName = async (value: string): Promise<boolean> => {
    if (!value.trim()) {
      setNameError('Name is required')
      return false
    }

    if (value.length < 2) {
      setNameError('Name must be at least 2 characters')
      return false
    }

    if (value.length > 50) {
      setNameError('Name must be 50 characters or less')
      return false
    }

    setNameError('')
    return true
  }

  const handleSave = async () => {
    if (!user || !profile) return

    const isValid = await validateName(name)
    if (!isValid) return

    setIsLoading(true)
    try {
      await upsertUserProfile({
        id: user.id,
        name: name.trim(),
        avatarEmoji: selectedAvatar
      })

      await refreshProfile()
      onOpenChange(false)
      toast.success('Profile updated successfully!')
    } catch (error) {
      console.error('Error updating profile:', error)
      toast.error('Failed to update profile. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleNameChange = (value: string) => {
    setName(value)
    if (nameError && value.trim()) {
      setNameError('')
    }
  }

  if (!user || !profile) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>
            Update your display name and avatar
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Avatar Selection */}
          <div>
            <Label className="text-sm font-medium">Avatar</Label>
            <div className="mt-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start h-12"
                  >
                    <span className="text-2xl mr-3">{selectedAvatar}</span>
                    Choose Avatar
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-3">
                  <div className="grid grid-cols-6 gap-2">
                    {AVATAR_EMOJIS.map((emoji) => (
                      <Button
                        key={emoji}
                        variant="ghost"
                        className={`h-12 w-12 p-0 text-2xl hover:bg-muted ${
                          selectedAvatar === emoji ? 'bg-primary/10 ring-2 ring-primary' : ''
                        }`}
                        onClick={() => setSelectedAvatar(emoji)}
                      >
                        {emoji}
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Name Input */}
          <div>
            <Label htmlFor="name" className="text-sm font-medium">
              Display Name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Enter your display name"
              className={`mt-1 ${nameError ? 'border-red-500' : ''}`}
              disabled={isLoading}
            />
            {nameError && (
              <p className="text-sm text-red-500 mt-1">{nameError}</p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || isLoading || !!nameError}
              className="flex-1"
            >
              {isLoading && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 