'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Check, User, RefreshCw } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { upsertUserProfile } from '@/lib/supabase'
import { AVATAR_EMOJIS } from '@/lib/avatar-constants'
import { toast } from 'sonner'

interface ProfileSetupDialogProps {
  open: boolean
  onComplete: () => void
}

export function ProfileSetupDialog({ open, onComplete }: ProfileSetupDialogProps) {
  const [selectedAvatar, setSelectedAvatar] = useState('🧙‍♂️')
  const [name, setName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [nameError, setNameError] = useState('')
  const { user, refreshProfile } = useAuth()

  const validateName = async (value: string) => {
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

  const handleSubmit = async () => {
    if (!user) return

    const isValid = await validateName(name)
    if (!isValid) return

    setIsLoading(true)
    try {
      await upsertUserProfile({
        id: user.id,
        name: name.trim(),
        avatarEmoji: selectedAvatar,
        email: user.email || ''
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

  const handleNameChange = (value: string) => {
    setName(value)
    if (nameError && value.trim()) {
      setNameError('')
    }
  }

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Set Up Your Profile
          </DialogTitle>
          <DialogDescription>
            Choose your display name and avatar to get started
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
              autoFocus
            />
            {nameError && (
              <p className="text-sm text-red-500 mt-1">{nameError}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              This is how other players will see you in games
            </p>
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || isLoading || !!nameError}
            className="w-full"
            size="lg"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Creating Profile...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Complete Setup
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
} 