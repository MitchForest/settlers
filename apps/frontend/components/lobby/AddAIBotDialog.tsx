'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { Bot, Zap, Shield, DollarSign } from 'lucide-react'
import { ds, componentStyles, designSystem } from '@/lib/design-system'

interface AddAIBotDialogProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (difficulty: 'easy' | 'medium' | 'hard', personality: 'aggressive' | 'balanced' | 'defensive' | 'economic') => void
  isLoading?: boolean
}

export function AddAIBotDialog({ isOpen, onClose, onAdd, isLoading = false }: AddAIBotDialogProps) {
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [personality, setPersonality] = useState<'aggressive' | 'balanced' | 'defensive' | 'economic'>('balanced')

  const handleAdd = () => {
    onAdd(difficulty, personality)
    // Dialog will close when parent receives success response
  }

  const difficultyOptions = [
    {
      value: 'easy',
      label: 'Easy',
      description: 'Makes simple moves, good for beginners',
      icon: '🟢',
      color: designSystem.accents.green.subtle
    },
    {
      value: 'medium', 
      label: 'Medium',
      description: 'Balanced strategy, competitive gameplay',
      icon: '🟡',
      color: designSystem.accents.orange.subtle
    },
    {
      value: 'hard',
      label: 'Hard',
      description: 'Advanced tactics, challenging opponent',
      icon: '🔴',
      color: designSystem.accents.red.subtle
    }
  ]

  const personalityOptions = [
    {
      value: 'balanced',
      label: 'Balanced',
      description: 'Well-rounded playstyle',
      icon: <Shield className="h-4 w-4" />,
      color: designSystem.accents.blue.subtle
    },
    {
      value: 'aggressive',
      label: 'Aggressive', 
      description: 'Expansion and blocking focused',
      icon: <Zap className="h-4 w-4" />,
      color: designSystem.accents.red.subtle
    },
    {
      value: 'defensive',
      label: 'Defensive',
      description: 'Resource building and safety',
      icon: <Shield className="h-4 w-4" />,
      color: designSystem.accents.green.subtle
    },
    {
      value: 'economic',
      label: 'Economic',
      description: 'Trading and efficiency focused', 
      icon: <DollarSign className="h-4 w-4" />,
      color: designSystem.accents.purple.subtle
    }
  ]

  const selectedDifficulty = difficultyOptions.find(d => d.value === difficulty)
  const selectedPersonality = personalityOptions.find(p => p.value === personality)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={ds(
        componentStyles.glassCard,
        'sm:max-w-md border-white/30'
      )}>
        <DialogHeader>
          <DialogTitle className={ds(
            designSystem.text.heading,
            'text-xl flex items-center gap-2'
          )}>
            <Bot className="h-5 w-5 text-blue-400" />
            Add AI Bot
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Difficulty Selection */}
          <div className="space-y-3">
            <Label className={ds(designSystem.text.body, 'text-sm font-medium')}>
              Difficulty Level
            </Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className={ds(
                    componentStyles.input,
                    'h-12 justify-between'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span>{selectedDifficulty?.icon}</span>
                    <span>{selectedDifficulty?.label || 'Select difficulty...'}</span>
                  </div>
                  <span className="text-white/40">▼</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className={ds(
                designSystem.glass.primary,
                'border-white/30 w-80'
              )}>
                {difficultyOptions.map((option) => (
                  <DropdownMenuItem 
                    key={option.value}
                    onClick={() => setDifficulty(option.value as 'easy' | 'medium' | 'hard')}
                    className={componentStyles.dropdownItem}
                  >
                    <div className="flex items-center gap-3 w-full">
                      <span className="text-lg">{option.icon}</span>
                      <div className="flex-1">
                        <div className="font-medium">{option.label}</div>
                        <div className={ds(designSystem.text.muted, 'text-xs')}>
                          {option.description}
                        </div>
                      </div>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            
            {selectedDifficulty && (
              <div className={ds(
                selectedDifficulty.color,
                'rounded-md p-3 text-sm'
              )}>
                <div className="flex items-center gap-2">
                  <span>{selectedDifficulty.icon}</span>
                  <span className="font-medium">{selectedDifficulty.label}</span>
                </div>
                <div className="mt-1 opacity-90">
                  {selectedDifficulty.description}
                </div>
              </div>
            )}
          </div>

          {/* Personality Selection */}
          <div className="space-y-3">
            <Label className={ds(designSystem.text.body, 'text-sm font-medium')}>
              AI Personality
            </Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className={ds(
                    componentStyles.input,
                    'h-12 justify-between'
                  )}
                >
                  <div className="flex items-center gap-2">
                    {selectedPersonality?.icon}
                    <span>{selectedPersonality?.label || 'Select personality...'}</span>
                  </div>
                  <span className="text-white/40">▼</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className={ds(
                designSystem.glass.primary,
                'border-white/30 w-80'
              )}>
                {personalityOptions.map((option) => (
                  <DropdownMenuItem 
                    key={option.value}
                    onClick={() => setPersonality(option.value as 'aggressive' | 'balanced' | 'defensive' | 'economic')}
                    className={componentStyles.dropdownItem}
                  >
                    <div className="flex items-center gap-3 w-full">
                      <div className="text-white/80">{option.icon}</div>
                      <div className="flex-1">
                        <div className="font-medium">{option.label}</div>
                        <div className={ds(designSystem.text.muted, 'text-xs')}>
                          {option.description}
                        </div>
                      </div>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {selectedPersonality && (
              <div className={ds(
                selectedPersonality.color,
                'rounded-md p-3 text-sm'
              )}>
                <div className="flex items-center gap-2">
                  {selectedPersonality.icon}
                  <span className="font-medium">{selectedPersonality.label}</span>
                </div>
                <div className="mt-1 opacity-90">
                  {selectedPersonality.description}
                </div>
              </div>
            )}
          </div>

          {/* Preview */}
          <div className={ds(
            designSystem.glass.secondary,
            'rounded-lg p-4 border-white/10'
          )}>
            <div className={ds(designSystem.text.muted, 'text-xs mb-2')}>
              Preview:
            </div>
            <div className="flex items-center gap-3">
              <div className={ds(
                componentStyles.avatarButton,
                'bg-gradient-to-br from-blue-500/20 to-purple-500/20 border-white/20'
              )}>
                🤖
              </div>
              <div>
                <div className={ds(designSystem.text.body, 'font-medium')}>
                  CleverBuilder247
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-xs">
                    🤖 {selectedDifficulty?.label} AI
                  </Badge>
                  <Badge variant="outline" className="text-xs border-white/20">
                    {selectedPersonality?.label}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isLoading}
            className={ds(
              componentStyles.buttonSecondary,
              'border-white/10'
            )}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            disabled={isLoading}
            className={ds(
              componentStyles.buttonPrimary,
              'bg-gradient-to-r from-blue-500/20 to-purple-500/20',
              'hover:from-blue-500/30 hover:to-purple-500/30',
              'border-blue-400/30'
            )}
          >
            {isLoading ? (
              <>
                <div className="animate-spin mr-2">⚡</div>
                Adding Bot...
              </>
            ) : (
              <>
                <Bot className="h-4 w-4 mr-2" />
                Add AI Bot
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 