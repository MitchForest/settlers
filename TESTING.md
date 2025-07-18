# Testing Strategy - Settlers

This document outlines the comprehensive testing strategy for the Settlers monorepo, ensuring consistent testing practices across all packages and applications.

## 🏗️ **Testing Architecture Overview**

```
settlers/
├── apps/
│   ├── frontend/          # React component & integration tests (Vitest + RTL)
│   ├── backend/           # API & database tests (Vitest)
│   └── e2e/              # End-to-end tests (Playwright)
└── packages/
    └── core/             # Game logic & AI tests (Vitest)
```

## 🧪 **Testing Frameworks & Tools**

| Layer | Framework | Purpose | Location |
|-------|-----------|---------|----------|
| **Unit Tests** | Vitest | Fast isolated testing | All packages |
| **Integration Tests** | Vitest | Component/API testing | Frontend/Backend |
| **E2E Tests** | Playwright | Full user flows | Dedicated e2e app |
| **Component Tests** | React Testing Library | React component testing | Frontend |
| **Database Tests** | Vitest + Test DB | Database operations | Backend |

## 🎯 **Testing Standards**

### **Naming Conventions**
- Test files: `*.test.ts`, `*.test.tsx`, `*.spec.ts`
- Test directories: `__tests__/` or `tests/`
- E2E tests: `*.spec.ts` in `apps/e2e/tests/`

### **Test Structure (AAA Pattern)**
```typescript
describe('Component/Feature Name', () => {
  it('should do something specific', () => {
    // Arrange - Set up test data
    const input = setupTestData()
    
    // Act - Execute the behavior
    const result = executeAction(input)
    
    // Assert - Verify the outcome
    expect(result).toBe(expectedValue)
  })
})
```

## 📦 **Package-Specific Testing**

### **Frontend (`apps/frontend`)**

**Tech Stack:**
- Vitest + React Testing Library + jsdom
- Mock Next.js router, Image components
- Component testing with user interactions

**Running Tests:**
```bash
cd apps/frontend
bun run test           # Run once
bun run test:watch     # Watch mode
bun run test:ui        # Interactive UI
```

**Test Categories:**
- **Component Tests**: UI components, user interactions
- **Hook Tests**: Custom React hooks
- **Integration Tests**: Page components with API calls
- **Utility Tests**: Helper functions, calculations

**Example:**
```typescript
// apps/frontend/src/__tests__/components/Button.test.tsx
import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { Button } from '@/components/ui/button'

test('calls onClick when clicked', async () => {
  const handleClick = vi.fn()
  const user = userEvent.setup()
  
  render(<Button onClick={handleClick}>Click me</Button>)
  await user.click(screen.getByRole('button'))
  
  expect(handleClick).toHaveBeenCalledOnce()
})
```

### **Backend (`apps/backend`)**

**Tech Stack:**
- Vitest for test runner
- Test database isolation
- Event store testing
- API endpoint testing

**Running Tests:**
```bash
cd apps/backend
bun run test           # Run once
bun run test:watch     # Watch mode
```

**Test Categories:**
- **Unit Tests**: Service functions, utilities
- **Integration Tests**: API endpoints, database operations
- **Event Store Tests**: Event sourcing, projections
- **WebSocket Tests**: Real-time communication

**Database Testing:**
```typescript
// Separate test database
process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/settlers_test'

beforeEach(async () => {
  await cleanupTestData()
})
```

### **Core Package (`packages/core`)**

**Tech Stack:**
- Vitest for fast testing
- Comprehensive game logic coverage
- AI behavior testing
- Performance benchmarks

**Running Tests:**
```bash
cd packages/core
bun run test           # Run once
bun run test --watch   # Watch mode
```

**Test Categories:**
- **Game Engine Tests**: State management, rule validation
- **AI Tests**: Decision making, performance
- **Integration Tests**: Full game simulations
- **Performance Tests**: Benchmarking AI speed

**Example:**
```typescript
// packages/core/src/ai/__tests__/auto-player.test.ts
test('AI makes valid moves', () => {
  const gameFlow = GameFlowManager.createGame({
    playerNames: ['AI Player', 'Human'],
    gameId: 'test-game'
  })
  
  const autoPlayer = createAutoPlayer(gameFlow, 'ai-player-1')
  expect(autoPlayer.canAct()).toBe(true)
})
```

## 🌐 **End-to-End Testing (`apps/e2e`)**

**Tech Stack:**
- Playwright for cross-browser testing
- Automatic server orchestration
- Multiple viewport testing
- Visual regression testing

**Running E2E Tests:**
```bash
cd apps/e2e
bun run test           # All browsers
bun run test:headed    # With browser UI
bun run test:ui        # Interactive mode
bun run test:debug     # Debug mode
```

**Test Scenarios:**
- **User Flows**: Registration → Game Creation → Playing
- **Multi-player**: Game joining, real-time sync
- **Cross-browser**: Chrome, Firefox, Safari, Mobile
- **Performance**: Load times, WebSocket reliability

**Example:**
```typescript
// apps/e2e/tests/game-flow.spec.ts
test('complete game flow', async ({ page }) => {
  await page.goto('/')
  await page.click('[data-testid="create-game-button"]')
  await expect(page).toHaveURL(/\/lobby\//)
})
```

## 🚀 **Running Tests**

### **Individual Packages**
```bash
# Frontend tests
cd apps/frontend && bun run test

# Backend tests  
cd apps/backend && bun run test

# Core package tests
cd packages/core && bun run test

# E2E tests
cd apps/e2e && bun run test
```

### **Monorepo Level**
```bash
# Run all tests
bun run test

# Run specific test types
turbo run test --filter=@settlers/frontend
turbo run test --filter=@settlers/backend
turbo run test --filter=@settlers/core

# E2E tests (requires running servers)
cd apps/e2e && bun run test
```

## 🔄 **CI/CD Integration**

### **GitHub Actions Pipeline**
```yaml
name: Test Suite
on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun run test

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: cd apps/e2e && bun run test
```

## 📊 **Test Coverage**

### **Coverage Targets**
- **Core Package**: >95% (critical game logic)
- **Backend APIs**: >90% (business logic)
- **Frontend Components**: >80% (UI components)
- **E2E Critical Paths**: 100% (user journeys)

### **Coverage Reports**
```bash
# Generate coverage
cd packages/core && bun run test --coverage
cd apps/backend && bun run test --coverage
cd apps/frontend && bun run test --coverage
```

## 🛠️ **Testing Utilities**

### **Shared Test Helpers**
```typescript
// Backend test helpers
export async function createTestUser(overrides = {}) {
  return await db.insert(userProfiles).values({
    id: generateTestUUID(),
    email: `test_${Date.now()}@example.com`,
    ...overrides
  })
}

// Frontend test helpers
export function renderWithProviders(component: ReactElement) {
  return render(component, {
    wrapper: ({ children }) => (
      <AuthProvider>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </AuthProvider>
    )
  })
}

// Core test helpers
export function createTestGameState(overrides = {}) {
  return GameFlowManager.createGame({
    playerNames: ['Player 1', 'Player 2'],
    gameId: 'test-game',
    ...overrides
  })
}
```

## 🐛 **Debugging Tests**

### **Frontend Debug**
```bash
# Interactive debugging
cd apps/frontend && bun run test:ui

# Debug specific test
cd apps/frontend && bun run test --run ComponentName.test.tsx
```

### **Backend Debug**
```bash
# Verbose output
cd apps/backend && bun run test --reporter=verbose

# Single test file
cd apps/backend && bun run test event-store.test.ts
```

### **E2E Debug**
```bash
# Visual debugging
cd apps/e2e && bun run test:debug

# Headed mode
cd apps/e2e && bun run test:headed
```

## 📈 **Performance Testing**

### **AI Performance Benchmarks**
```typescript
// packages/core/src/ai/__tests__/performance.test.ts
test('AI decision time under 100ms', async () => {
  const start = performance.now()
  await autoPlayer.executeTurn()
  const duration = performance.now() - start
  
  expect(duration).toBeLessThan(100)
})
```

### **Load Testing**
- Use Playwright for concurrent user simulation
- Test WebSocket connection limits
- Database performance under load

## 🔒 **Security Testing**

### **Input Validation**
- SQL injection prevention
- XSS protection in React components
- API input sanitization

### **Authentication Testing**
- Session management
- Guest user limitations
- Access control validation

## 📋 **Best Practices**

### **✅ Do's**
- Write tests before fixing bugs (TDD for bug fixes)
- Use descriptive test names
- Keep tests focused and atomic
- Mock external dependencies
- Test edge cases and error conditions
- Use data-testid attributes for E2E
- Clean up test data after each test

### **❌ Don'ts**
- Don't test implementation details
- Don't share state between tests
- Don't skip tests without good reason
- Don't commit broken tests
- Don't test external library functionality
- Don't use production data in tests

## 🚨 **Troubleshooting**

### **Common Issues**
1. **Database connection errors**: Check TEST_DATABASE_URL
2. **Frontend mock failures**: Verify Next.js mocks in setup
3. **E2E timeouts**: Increase timeout or check server startup
4. **Race conditions**: Use proper async/await patterns

### **Getting Help**
- Check test logs for detailed error messages
- Use test debugger for step-by-step execution
- Review existing test patterns for similar functionality
- Consult framework documentation for advanced features

---

This testing strategy ensures comprehensive coverage across all layers of the Settlers application while maintaining consistency and reliability. Regular updates to this document will reflect evolving testing practices and new requirements. 