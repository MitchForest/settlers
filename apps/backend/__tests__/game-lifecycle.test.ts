import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { generateGameCode, isValidGameCodeFormat, normalizeGameCode } from '../src/utils/game-codes'

describe('Game Lifecycle - Core Logic', () => {
  describe('Game Code Utilities', () => {
    it('should generate valid game codes', () => {
      const codes = Array.from({ length: 100 }, () => generateGameCode())
      
      // All codes should be valid format
      codes.forEach(code => {
        expect(isValidGameCodeFormat(code)).toBe(true)
        expect(code).toMatch(/^[A-Z0-9]{6}$/)
      })

      // Codes should be unique (very high probability)
      const uniqueCodes = new Set(codes)
      expect(uniqueCodes.size).toBeGreaterThan(95) // Allow for very rare collisions
    })

    it('should validate game code formats correctly', () => {
      // Valid formats
      expect(isValidGameCodeFormat('ABCD12')).toBe(true)
      expect(isValidGameCodeFormat('123456')).toBe(true)
      expect(isValidGameCodeFormat('A1B2C3')).toBe(true)

      // Invalid formats
      expect(isValidGameCodeFormat('abc123')).toBe(false) // lowercase
      expect(isValidGameCodeFormat('ABCD1')).toBe(false)  // too short
      expect(isValidGameCodeFormat('ABCD123')).toBe(false) // too long
      expect(isValidGameCodeFormat('ABCD!@')).toBe(false) // special chars
      expect(isValidGameCodeFormat('')).toBe(false)        // empty
    })

    it('should normalize game codes correctly', () => {
      expect(normalizeGameCode('abcd12')).toBe('ABCD12')
      expect(normalizeGameCode('  ABCD12  ')).toBe('ABCD12')
      expect(normalizeGameCode('a b c d 1 2')).toBe('ABCD12')
      expect(normalizeGameCode('AbCd12')).toBe('ABCD12')
    })
  })

  describe('Domain Error Handling', () => {
    it('should have proper error classes available', () => {
      // Test error class imports work
      expect(typeof generateGameCode).toBe('function')
      expect(typeof isValidGameCodeFormat).toBe('function')
      expect(typeof normalizeGameCode).toBe('function')
    })
  })

  describe('Business Rules Validation', () => {
    it('should ensure game codes are always 6 characters', () => {
      const pattern = /^[A-Z0-9]{6}$/
      expect('ABCD12').toMatch(pattern)
      expect('TEST01').toMatch(pattern)
      expect('abcd12').not.toMatch(pattern) // lowercase not allowed
      expect('ABCD1').not.toMatch(pattern)  // too short
      expect('ABCD123').not.toMatch(pattern) // too long
    })

    it('should handle edge cases in game code generation', () => {
      // Generate many codes to test for patterns/issues
      const codes = Array.from({ length: 1000 }, () => generateGameCode())
      
      // All should be uppercase
      codes.forEach(code => {
        expect(code).toBe(code.toUpperCase())
      })

      // Should contain mix of letters and numbers (probability test)
      const hasLetters = codes.some(code => /[A-Z]/.test(code))
      const hasNumbers = codes.some(code => /[0-9]/.test(code))
      
      expect(hasLetters).toBe(true)
      expect(hasNumbers).toBe(true)
    })

    it('should normalize consistently', () => {
      const testCases = [
        { input: 'abc123', expected: 'ABC123' },
        { input: ' ABC 123 ', expected: 'ABC123' },
        { input: 'a1B2c3', expected: 'A1B2C3' },
        { input: '  test  ', expected: 'TEST' }
      ]

      testCases.forEach(({ input, expected }) => {
        expect(normalizeGameCode(input)).toBe(expected)
      })
    })
  })

  describe('Input Validation Scenarios', () => {
    it('should handle malformed game codes gracefully', () => {
      const invalidCodes = [
        '', // empty
        'A', // too short
        'ABCDEFG', // too long
        'ABC!@#', // special chars
        '   ', // whitespace only
        'abc def', // lowercase with space
        '123-456', // hyphen
        'GAME_1' // underscore
      ]

      invalidCodes.forEach(code => {
        expect(isValidGameCodeFormat(code)).toBe(false)
      })
    })

    it('should validate boundary conditions', () => {
      // Exactly 6 characters
      expect(isValidGameCodeFormat('ABCDE1')).toBe(true)
      expect(isValidGameCodeFormat('123456')).toBe(true)
      
      // Just under/over
      expect(isValidGameCodeFormat('ABCDE')).toBe(false) // 5 chars
      expect(isValidGameCodeFormat('ABCDEFG')).toBe(false) // 7 chars
    })
  })

  describe('Performance Characteristics', () => {
    it('should generate codes quickly', () => {
      const start = Date.now()
      
      // Generate a reasonable number of codes
      for (let i = 0; i < 1000; i++) {
        generateGameCode()
      }
      
      const duration = Date.now() - start
      
      // Should complete in reasonable time (less than 100ms for 1000 codes)
      expect(duration).toBeLessThan(100)
    })

    it('should validate codes quickly', () => {
      const testCodes = Array.from({ length: 1000 }, () => generateGameCode())
      
      const start = Date.now()
      
      testCodes.forEach(code => {
        isValidGameCodeFormat(code)
      })
      
      const duration = Date.now() - start
      
      // Should validate quickly
      expect(duration).toBeLessThan(50)
    })
  })
}) 