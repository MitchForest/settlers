const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export async function testConnection() {
  try {
    const response = await fetch(`${API_URL}/api/test`)
    const data = await response.json()
    return data
  } catch (error) {
    console.error('API connection failed:', error)
    throw error
  }
}

export async function healthCheck() {
  try {
    const response = await fetch(`${API_URL}/health`)
    const data = await response.json()
    return data
  } catch (error) {
    console.error('Health check failed:', error)
    throw error
  }
} 