'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Mail, ArrowRight, RefreshCw, Edit } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { toast } from 'sonner'

interface MagicLinkDialogProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  title?: string
  description?: string
}

export function MagicLinkDialog({ 
  open, 
  onClose, 
  onSuccess,
  title = "Join the Game!",
  description = "Enter your email to sign in and continue"
}: MagicLinkDialogProps) {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [sentToEmail, setSentToEmail] = useState('')
  const { signInWithMagicLink } = useAuth()

  const handleSendMagicLink = async () => {
    if (!email.trim()) {
      toast.error('Please enter your email address')
      return
    }

    if (!email.includes('@')) {
      toast.error('Please enter a valid email address')
      return
    }

    setIsLoading(true)
    try {
      const { error } = await signInWithMagicLink(email.trim())
      
      if (error) {
        console.error('Magic link error:', error)
        toast.error('Failed to send magic link. Please try again.')
      } else {
        setSentToEmail(email.trim())
        setEmailSent(true)
        toast.success('Magic link sent! Check your email.')
      }
    } catch (error) {
      console.error('Unexpected error:', error)
      toast.error('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleResendLink = async () => {
    setIsLoading(true)
    try {
      const { error } = await signInWithMagicLink(sentToEmail)
      
      if (error) {
        toast.error('Failed to resend magic link. Please try again.')
      } else {
        toast.success('Magic link resent! Check your email.')
      }
    } catch (error) {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleChangeEmail = () => {
    setEmailSent(false)
    setSentToEmail('')
    setEmail('')
  }

  const handleClose = () => {
    if (!isLoading) {
      setEmail('')
      setEmailSent(false)
      setSentToEmail('')
      onClose()
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !emailSent && !isLoading) {
      handleSendMagicLink()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-black/30 backdrop-blur-sm border border-white/20 text-white">
        <DialogHeader>
          <DialogTitle className="text-white text-xl font-semibold text-center">
            {emailSent ? '📧 Check Your Email!' : title}
          </DialogTitle>
        </DialogHeader>

        {!emailSent ? (
          /* Email Input Step */
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-blue-500/20 rounded-full flex items-center justify-center">
                <Mail className="w-8 h-8 text-blue-400" />
              </div>
              <p className="text-white/80 text-sm">
                {description}
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white/80">Email Address</Label>
                <Input 
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="your@email.com"
                  disabled={isLoading}
                  className="bg-white/5 border-white/20 text-white placeholder:text-white/50 focus:bg-white/10 focus:border-white/40"
                />
              </div>

              <Button 
                onClick={handleSendMagicLink}
                disabled={!email.trim() || isLoading}
                className="w-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 text-white border border-white/40 hover:border-white/60 hover:from-blue-500/30 hover:to-purple-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-lg"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Sending Magic Link...
                  </>
                ) : (
                  <>
                    Send Magic Link
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            </div>

            <div className="text-center">
              <Button 
                onClick={handleClose} 
                variant="ghost"
                disabled={isLoading}
                className="text-white/60 hover:text-white hover:bg-white/10"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          /* Email Sent Step */
          <div className="space-y-6">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-green-500/20 rounded-full flex items-center justify-center">
                <Mail className="w-8 h-8 text-green-400" />
              </div>
              
              <div className="space-y-2">
                <p className="text-white/90">
                  We sent a magic link to:
                </p>
                <p className="font-mono text-blue-300 bg-white/10 rounded px-3 py-2 border border-white/20">
                  {sentToEmail}
                </p>
                <p className="text-sm text-white/60">
                  Click the link in your email to sign in and continue to your game.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <Button 
                onClick={handleResendLink}
                disabled={isLoading}
                variant="outline"
                className="w-full bg-white/5 border-white/20 text-white hover:bg-white/10 hover:border-white/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 hover:shadow-lg disabled:hover:scale-100"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Resending...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Resend Link
                  </>
                )}
              </Button>

              <Button 
                onClick={handleChangeEmail}
                variant="ghost"
                disabled={isLoading}
                className="w-full text-white/60 hover:text-white hover:bg-white/10"
              >
                <Edit className="w-4 h-4 mr-2" />
                Change Email
              </Button>
            </div>

            <div className="text-center pt-4 border-t border-white/20">
              <Button 
                onClick={handleClose} 
                variant="ghost"
                disabled={isLoading}
                className="text-white/60 hover:text-white hover:bg-white/10"
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
} 