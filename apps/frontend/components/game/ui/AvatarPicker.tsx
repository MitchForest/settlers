'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { AVATAR_EMOJIS } from '@/lib/avatar-constants'

interface AvatarPickerProps {
  currentAvatar: string
  currentName: string
  onAvatarChange: (emoji: string) => void
  onNameChange: (name: string) => void
  disabled?: boolean
}

export function AvatarPicker({ 
  currentAvatar, 
  currentName, 
  onAvatarChange, 
  onNameChange,
  disabled = false 
}: AvatarPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [tempName, setTempName] = useState(currentName)

  const handleNameSubmit = () => {
    if (tempName.trim() && tempName !== currentName) {
      onNameChange(tempName.trim())
    }
  }

  const handleEmojiSelect = (emoji: string) => {
    onAvatarChange(emoji)
    setIsOpen(false)
  }

  return (
    <div className="flex items-center space-x-2">
      {/* Avatar Display/Picker */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="w-10 h-10 p-0 text-xl hover:bg-white/10"
            disabled={disabled}
          >
            {currentAvatar}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3">
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Choose Avatar</h4>
            <div className="grid grid-cols-8 gap-1">
              {AVATAR_EMOJIS.map((emoji) => (
                <Button
                  key={emoji}
                  variant="ghost"
                  size="sm"
                  className="w-8 h-8 p-0 text-lg hover:bg-gray-100"
                  onClick={() => handleEmojiSelect(emoji)}
                >
                  {emoji}
                </Button>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Name Display/Editor */}
      <div className="flex-1 min-w-0">
        <Input
          value={tempName}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTempName(e.target.value)}
          onBlur={handleNameSubmit}
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter') {
              handleNameSubmit()
              e.currentTarget.blur()
            }
            if (e.key === 'Escape') {
              setTempName(currentName)
              e.currentTarget.blur()
            }
          }}
          className="bg-transparent border-none text-white placeholder:text-white/50 text-sm font-medium focus:bg-white/10 rounded px-2 py-1"
          placeholder="Player Name"
          disabled={disabled}
          maxLength={20}
        />
      </div>
    </div>
  )
}

interface PlayerAvatarProps {
  avatar: string
  name: string
  playerColor: number
  isCurrentTurn?: boolean
  className?: string
}

export function PlayerAvatar({ 
  avatar, 
  name, 
  playerColor, 
  isCurrentTurn = false,
  className = "" 
}: PlayerAvatarProps) {
  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className={`relative ${isCurrentTurn ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-transparent rounded-full' : ''}`}>
        <div 
          className="w-8 h-8 rounded-full flex items-center justify-center text-lg border-2 border-white/30"
          style={{ backgroundColor: `var(--player-${playerColor})` }}
        >
          {avatar}
        </div>
        {isCurrentTurn && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full border border-gray-800" />
        )}
      </div>
      <span className="hidden lg:block text-sm font-medium text-white truncate max-w-24">
        {name}
      </span>
    </div>
  )
} 