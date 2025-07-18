import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { Button } from '@/components/ui/button'

describe('Button Component', () => {
  it('renders button with text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument()
  })

  it('calls onClick handler when clicked', async () => {
    const handleClick = vi.fn()
    const user = userEvent.setup()
    
    render(<Button onClick={handleClick}>Click me</Button>)
    
    await user.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledOnce()
  })

  it('renders disabled button', () => {
    render(<Button disabled>Disabled</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('applies variant classes correctly', () => {
    render(<Button variant="destructive">Delete</Button>)
    const button = screen.getByRole('button')
    // Check for actual classes applied by the destructive variant
    expect(button).toHaveClass('bg-destructive')
    expect(button).toHaveClass('text-white')
    expect(button).toHaveClass('hover:bg-destructive/90')
  })
}) 