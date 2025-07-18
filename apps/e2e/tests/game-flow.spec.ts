import { test, expect } from '@playwright/test'

test.describe('Game Flow E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Start fresh for each test
    await page.goto('/')
  })

  test('should show system status on homepage', async ({ page }) => {
    // Wait for page to load
    await page.waitForLoadState('networkidle')
    
    // Check that the page loads correctly
    await expect(page).toHaveTitle(/Settlers/)
    
    // Check system status indicators
    await expect(page.locator('[data-testid="api-status"]')).toBeVisible()
    await expect(page.locator('[data-testid="db-status"]')).toBeVisible()
  })

  test('should create a game as guest', async ({ page }) => {
    // Click create game button
    await page.click('[data-testid="create-game-button"]')
    
    // If not authenticated, should show magic link dialog
    await expect(page.locator('[data-testid="magic-link-dialog"]')).toBeVisible()
    
    // Continue as guest
    await page.click('[data-testid="continue-as-guest"]')
    
    // Fill guest profile
    await page.fill('[data-testid="guest-name-input"]', 'Test Player')
    await page.click('[data-testid="guest-avatar-👤"]')
    await page.click('[data-testid="continue-guest"]')
    
    // Now should show create game dialog
    await expect(page.locator('[data-testid="create-game-dialog"]')).toBeVisible()
    
    // Create game
    await page.click('[data-testid="create-game-submit"]')
    
    // Should navigate to lobby
    await expect(page).toHaveURL(/\/lobby\//)
    
    // Should see game code
    await expect(page.locator('[data-testid="game-code"]')).toBeVisible()
    
    // Should see player in lobby
    await expect(page.locator('[data-testid="player-list"]')).toContainText('Test Player')
  })

  test('should join a game with game code', async ({ page }) => {
    // First create a game in another context to get a game code
    const gameCode = await createTestGame(page)
    
    // Navigate back to home
    await page.goto('/')
    
    // Click join game
    await page.click('[data-testid="join-game-button"]')
    
    // Enter game code
    await page.fill('[data-testid="game-code-input"]', gameCode)
    await page.click('[data-testid="join-game-submit"]')
    
    // Should navigate to lobby
    await expect(page).toHaveURL(/\/lobby\//)
    await expect(page.locator('[data-testid="game-code"]')).toContainText(gameCode)
  })

  test('should start a game with AI players', async ({ page }) => {
    // Create a game
    await createTestGameAsGuest(page, 'Host Player')
    
    // Add AI players
    await page.click('[data-testid="add-ai-button"]')
    await expect(page.locator('[data-testid="player-list"]')).toContainText('AI Player')
    
    // Start game when enough players
    await page.click('[data-testid="start-game-button"]')
    
    // Should navigate to game
    await expect(page).toHaveURL(/\/game\//)
    
    // Should see game board
    await expect(page.locator('[data-testid="game-board"]')).toBeVisible()
    
    // Should see player dashboard
    await expect(page.locator('[data-testid="player-dashboard"]')).toBeVisible()
  })

  test('should handle WebSocket connection', async ({ page }) => {
    // Create and join a game
    await createTestGameAsGuest(page, 'WebSocket Test')
    
    // Check connection status
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('Connected')
    
    // Simulate network interruption
    await page.context().setOffline(true)
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('Disconnected')
    
    // Restore connection
    await page.context().setOffline(false)
    await expect(page.locator('[data-testid="connection-status"]')).toContainText('Connected')
  })
})

// Helper functions
async function createTestGame(page: any): Promise<string> {
  await page.goto('/')
  await page.click('[data-testid="create-game-button"]')
  await page.click('[data-testid="continue-as-guest"]')
  await page.fill('[data-testid="guest-name-input"]', 'Test Host')
  await page.click('[data-testid="guest-avatar-👑"]')
  await page.click('[data-testid="continue-guest"]')
  await page.click('[data-testid="create-game-submit"]')
  
  // Extract game code from URL or page
  const gameCodeElement = page.locator('[data-testid="game-code"]')
  return await gameCodeElement.textContent()
}

async function createTestGameAsGuest(page: any, playerName: string) {
  await page.goto('/')
  await page.click('[data-testid="create-game-button"]')
  await page.click('[data-testid="continue-as-guest"]')
  await page.fill('[data-testid="guest-name-input"]', playerName)
  await page.click('[data-testid="guest-avatar-👤"]')
  await page.click('[data-testid="continue-guest"]')
  await page.click('[data-testid="create-game-submit"]')
} 