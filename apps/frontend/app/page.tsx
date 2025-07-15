'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { testConnection, healthCheck } from '@/lib/api'
import { toast } from 'sonner'
import { ThemeToggle } from '@/components/theme-toggle'

export default function Home() {
  const [apiStatus, setApiStatus] = useState<'testing' | 'connected' | 'failed'>('testing')
  const [dbStatus, setDbStatus] = useState<'unknown' | 'connected' | 'failed'>('unknown')

  useEffect(() => {
    checkSystemStatus()
  }, [])

  const checkSystemStatus = async () => {
    try {
      // Test API connection
      await testConnection()
      setApiStatus('connected')
      
      // Test health endpoint
      const health = await healthCheck()
      setDbStatus(health.database ? 'connected' : 'failed')
      
      toast.success('System status checked')
    } catch {
      setApiStatus('failed')
      toast.error('Failed to connect to backend')
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge className="status-connected">✓ Connected</Badge>
      case 'failed':
      case 'error':
        return <Badge className="status-disconnected">✗ Failed</Badge>
      case 'testing':
        return <Badge className="status-testing">⟳ Testing...</Badge>
      default:
        return <Badge className="status-unknown">⚠ Unknown</Badge>
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-white">
            Settlers
          </h1>
          <ThemeToggle />
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                System Status
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={checkSystemStatus}
                  disabled={apiStatus === 'testing'}
                >
                  Refresh
                </Button>
              </CardTitle>
              <CardDescription>
                Backend connectivity and health
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span>API Server</span>
                {getStatusBadge(apiStatus)}
              </div>
              <div className="flex justify-between items-center">
                <span>Database</span>
                {getStatusBadge(dbStatus)}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
