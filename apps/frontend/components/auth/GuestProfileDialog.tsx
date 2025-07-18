'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  User, 
  Crown, 
  Trophy, 
  Users,
  Heart,
  MessageSquare,
  ChevronRight,
  Sparkles
} from 'lucide-react'
import { componentStyles, designSystem, ds } from '@/lib/design-system'
import { toast } from 'sonner'
import { 
  getGuestSession, 
  updateGuestSession, 
  generateThematicName,
  getSessionDuration,
  prepareUpgradeData,
  type GuestSession,
  type UpgradeData
} from '@/lib/guest-session'

interface GuestProfileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpgradeClick?: () => void
}

const AVATAR_EMOJIS = [
  '🧙‍♂️', '🧙‍♀️', '🧌', '🦹‍♂️', '🦹‍♀️', '🥷', 
  '🧚‍♂️', '🧚‍♀️', '🧞‍♂️', '🧞‍♀️', '🤖', '👑',
  '🎭', '🎨', '🎸', '🎯', '🏆', '⚡', '🔥', '🌟'
]

function ProfileTab({ session, onSessionUpdate }: { 
  session: GuestSession
  onSessionUpdate: (session: GuestSession) => void 
}) {
  const [name, setName] = useState(session.name)
  const [selectedAvatar, setSelectedAvatar] = useState(session.avatarEmoji)
  const [isEditing, setIsEditing] = useState(false)

  const handleSave = () => {
    const trimmedName = name.trim()
    
    if (!trimmedName) {
      toast.error('Name cannot be empty')
      return
    }

    if (trimmedName.length < 2) {
      toast.error('Name must be at least 2 characters long')
      return
    }

    if (trimmedName.length > 20) {
      toast.error('Name must be 20 characters or less')
      return
    }

    // Check for inappropriate characters
    if (!/^[a-zA-Z0-9\s\-_]+$/.test(trimmedName)) {
      toast.error('Name can only contain letters, numbers, spaces, hyphens, and underscores')
      return
    }

    try {
      const updatedSession = updateGuestSession({
        name: trimmedName,
        avatarEmoji: selectedAvatar
      })
      
      onSessionUpdate(updatedSession)
      setIsEditing(false)
      toast.success('Profile updated!')
    } catch (err) {
      console.error('Error updating guest profile:', err)
      toast.error('Failed to update profile. Please try again.')
    }
  }

  const handleRandomName = () => {
    const newName = generateThematicName()
    setName(newName)
  }

  const sessionDays = getSessionDuration()

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="text-center space-y-4">
        <div className="relative inline-block">
          <span className="text-6xl">{selectedAvatar}</span>
          <Badge 
            variant="secondary" 
            className="absolute -bottom-1 -right-1 bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs"
          >
            Guest
          </Badge>
        </div>
        
        <div>
          <h2 className="text-xl font-bold text-white">{session.name}</h2>
          <p className="text-sm text-white/60">
            Playing as guest • {sessionDays} {sessionDays === 1 ? 'day' : 'days'} active
          </p>
        </div>
      </div>

      {/* Edit Profile */}
      <Card className={componentStyles.glassCard}>
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <User className="w-4 h-4" />
            Customize Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isEditing ? (
            <>
              <div className="space-y-2">
                <Label className="text-white/80">Display Name</Label>
                <div className="flex gap-2">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={componentStyles.input}
                    placeholder="Enter your name"
                    maxLength={20}
                  />
                  <Button
                    onClick={handleRandomName}
                    variant="outline"
                    size="sm"
                    className="px-3"
                  >
                    <Sparkles className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-white/80">Avatar</Label>
                <div className="grid grid-cols-8 gap-2">
                  {AVATAR_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => setSelectedAvatar(emoji)}
                      className={ds(
                        'w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-all',
                        selectedAvatar === emoji
                          ? 'bg-blue-500/30 ring-2 ring-blue-500'
                          : 'bg-white/10 hover:bg-white/20'
                      )}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSave} className={componentStyles.buttonPrimary}>
                  Save Changes
                </Button>
                <Button 
                  onClick={() => {
                    setName(session.name)
                    setSelectedAvatar(session.avatarEmoji)
                    setIsEditing(false)
                  }}
                  variant="outline"
                >
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{session.avatarEmoji}</span>
                <div>
                  <p className="text-white font-medium">{session.name}</p>
                  <p className="text-sm text-white/60">Guest Player</p>
                </div>
              </div>
              <Button onClick={() => setIsEditing(true)} variant="outline" size="sm">
                Edit
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Session Stats */}
      <Card className={componentStyles.glassCard}>
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Trophy className="w-4 h-4" />
            Session Stats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">{session.stats.gamesJoined}</div>
              <div className="text-xs text-white/60">Games Joined</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">{session.stats.gamesCompleted}</div>
              <div className="text-xs text-white/60">Games Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400">
                {session.stats.winRate > 0 ? `${Math.round(session.stats.winRate)}%` : '-'}
              </div>
              <div className="text-xs text-white/60">Win Rate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-400">
                {Math.round(session.stats.totalPlayTime / 60) || 0}h
              </div>
              <div className="text-xs text-white/60">Play Time</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function UpgradeTab({ upgradeData, onUpgradeClick }: { 
  upgradeData: UpgradeData
  onUpgradeClick?: () => void 
}) {
  const features = [
    {
      icon: Heart,
      title: 'Friends System',
      description: 'Add friends, send game invites, and see who&apos;s online',
      highlight: true
    },
    {
      icon: MessageSquare,
      title: 'Game History',
      description: 'Permanent record of all your games and achievements',
      highlight: true
    },
    {
      icon: Crown,
      title: 'Profile Customization',
      description: 'Custom avatars, themes, and personal settings',
      highlight: false
    },
    {
      icon: Users,
      title: 'Private Games',
      description: 'Create private games for you and your friends',
      highlight: false
    }
  ]

  return (
    <div className="space-y-6">
      {/* Upgrade Hero */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
          <Crown className="w-8 h-8 text-white" />
        </div>
        
        <div>
          <h2 className="text-xl font-bold text-white">Upgrade to Full Account</h2>
          <p className="text-sm text-white/60">
            Unlock social features and preserve your progress forever
          </p>
        </div>
      </div>

      {/* Your Experience */}
      <Card className={componentStyles.glassCard}>
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Trophy className="w-4 h-4" />
            Your Experience So Far
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-white/80">Games Played</span>
            <Badge variant="secondary" className="bg-blue-500/20 text-blue-300 border-blue-500/30">
              {upgradeData.gameExperience.gamesPlayed}
            </Badge>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-white/80">Hours Played</span>
            <Badge variant="secondary" className="bg-green-500/20 text-green-300 border-green-500/30">
              {upgradeData.gameExperience.hoursPlayed}h
            </Badge>
          </div>
          
          {upgradeData.gameExperience.winRate > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-white/80">Win Rate</span>
              <Badge variant="secondary" className="bg-purple-500/20 text-purple-300 border-purple-500/30">
                {Math.round(upgradeData.gameExperience.winRate)}%
              </Badge>
            </div>
          )}

          <div className="pt-2 border-t border-white/10">
            <p className="text-xs text-white/60">
              💡 Create an account to preserve your progress and unlock social features!
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Features */}
      <div className="space-y-3">
        <h3 className="font-semibold text-white">What You&apos;ll Get</h3>
        {features.map((feature, index) => (
          <Card key={index} className={ds(
            componentStyles.glassCard,
            feature.highlight && 'ring-1 ring-blue-500/50 bg-blue-500/5'
          )}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={ds(
                  'w-8 h-8 rounded-lg flex items-center justify-center',
                  feature.highlight 
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'bg-white/10 text-white/70'
                )}>
                  <feature.icon className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-white">{feature.title}</h4>
                    {feature.highlight && (
                      <Badge variant="secondary" className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">
                        Popular
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-white/60">{feature.description}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-white/40" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* CTA */}
      <Button 
        onClick={onUpgradeClick}
        className={ds(componentStyles.buttonPrimary, 'w-full py-3')}
      >
        <Crown className="w-4 h-4 mr-2" />
        Create Free Account
      </Button>

      <p className="text-xs text-center text-white/50">
        100% free • No credit card required • Keep playing while signed up
      </p>
    </div>
  )
}

export function GuestProfileDialog({ open, onOpenChange, onUpgradeClick }: GuestProfileDialogProps) {
  const [session, setSession] = useState<GuestSession | null>(null)
  const [upgradeData, setUpgradeData] = useState<UpgradeData | null>(null)

  // Load session data when dialog opens
  useEffect(() => {
    if (open) {
      const currentSession = getGuestSession()
      const upgradeInfo = prepareUpgradeData()
      setSession(currentSession)
      setUpgradeData(upgradeInfo)
    }
  }, [open])

  const handleSessionUpdate = (updatedSession: GuestSession) => {
    setSession(updatedSession)
    // Also update upgrade data
    setUpgradeData(prepareUpgradeData())
  }

  if (!session || !upgradeData) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={ds(
        componentStyles.glassCard,
        'max-w-lg max-h-[85vh] overflow-hidden flex flex-col'
      )}>
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className={ds(designSystem.text.heading, 'text-xl')}>
            Guest Profile
          </DialogTitle>
          <DialogDescription className={designSystem.text.muted}>
            Customize your guest experience and explore upgrade benefits
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="profile" className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
              <TabsTrigger value="profile" className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Profile
              </TabsTrigger>
              <TabsTrigger value="upgrade" className="flex items-center gap-2">
                <Crown className="w-4 h-4" />
                Upgrade
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto mt-4">
              <TabsContent value="profile" className="mt-0">
                <ProfileTab 
                  session={session} 
                  onSessionUpdate={handleSessionUpdate}
                />
              </TabsContent>

              <TabsContent value="upgrade" className="mt-0">
                <UpgradeTab 
                  upgradeData={upgradeData}
                  onUpgradeClick={() => {
                    onUpgradeClick?.()
                    onOpenChange(false)
                  }}
                />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
} 