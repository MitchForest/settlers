// Design System for Settlers Game
// Glass-morphism with consistent hover states and beautiful interactions

export const designSystem = {
  // Base glass containers
  glass: {
    primary: 'bg-black/30 backdrop-blur-sm border border-white/20',
    secondary: 'bg-black/20 backdrop-blur-sm border border-white/10',
    tertiary: 'bg-black/10 backdrop-blur-sm border border-white/5',
  },

  // Interactive elements with beautiful hover states
  interactive: {
    // Primary interactive elements (buttons, menu items)
    primary: {
      base: 'bg-white/5 border border-white/20 text-white transition-all duration-200',
      hover: 'hover:bg-white/15 hover:border-white/40 hover:shadow-lg hover:scale-[1.02]',
      active: 'active:scale-[0.98]',
      focus: 'focus:bg-white/15 focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/20',
      disabled: 'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100',
    },
    
    // Secondary interactive elements
    secondary: {
      base: 'bg-white/10 border border-white/30 text-white transition-all duration-200',
      hover: 'hover:bg-white/20 hover:border-white/50 hover:shadow-xl hover:scale-[1.02]',
      active: 'active:scale-[0.98]',
      focus: 'focus:bg-white/20 focus:border-white/50 focus:outline-none focus:ring-2 focus:ring-white/30',
      disabled: 'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100',
    },

    // Subtle interactive elements (dropdowns, selections)
    subtle: {
      base: 'text-white/90 transition-all duration-200 rounded-md',
      hover: 'hover:bg-white/10 hover:text-white hover:shadow-md',
      active: 'active:bg-white/15',
      focus: 'focus:bg-white/10 focus:text-white focus:outline-none',
    },

    // Destructive actions (delete, sign out)
    destructive: {
      base: 'text-red-300 transition-all duration-200 rounded-md',
      hover: 'hover:bg-red-500/20 hover:text-red-200 hover:border-red-400/30 hover:shadow-md',
      active: 'active:bg-red-500/30',
      focus: 'focus:bg-red-500/20 focus:text-red-200 focus:outline-none focus:ring-2 focus:ring-red-400/30',
    },
  },

  // Input styles
  input: {
    base: 'bg-black/20 border border-white/20 text-white placeholder-white/50 transition-all duration-200',
    hover: 'hover:border-white/40 hover:bg-black/30',
    focus: 'focus:border-white/60 focus:bg-black/40 focus:outline-none focus:ring-2 focus:ring-white/20',
  },

  // Accent colors for different states
  accents: {
    blue: {
      subtle: 'bg-blue-500/10 border-blue-400/20 text-blue-300',
      hover: 'hover:bg-blue-500/20 hover:border-blue-400/40 hover:text-blue-200',
    },
    green: {
      subtle: 'bg-green-500/10 border-green-400/20 text-green-300',
      hover: 'hover:bg-green-500/20 hover:border-green-400/40 hover:text-green-200',
    },
    purple: {
      subtle: 'bg-purple-500/10 border-purple-400/20 text-purple-300',
      hover: 'hover:bg-purple-500/20 hover:border-purple-400/40 hover:text-purple-200',
    },
    orange: {
      subtle: 'bg-orange-500/10 border-orange-400/20 text-orange-300',
      hover: 'hover:bg-orange-500/20 hover:border-orange-400/40 hover:text-orange-200',
    },
    red: {
      subtle: 'bg-red-500/10 border-red-400/20 text-red-300',
      hover: 'hover:bg-red-500/20 hover:border-red-400/40 hover:text-red-200',
    },
  },

  // Spacing and layout
  spacing: {
    dialog: 'p-6',
    card: 'p-4',
    section: 'p-3',
    item: 'px-3 py-2',
  },

  // Animation and transitions
  animation: {
    fast: 'transition-all duration-150',
    normal: 'transition-all duration-200',
    slow: 'transition-all duration-300',
    bounce: 'hover:scale-[1.02] active:scale-[0.98] transition-transform duration-150',
    glow: 'hover:shadow-lg hover:shadow-white/10',
  },

  // Typography
  text: {
    heading: 'text-white font-bold',
    body: 'text-white/90',
    muted: 'text-white/60',
    accent: 'text-white',
  },
} as const

// Utility function to combine design system classes
export function ds(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

// Pre-built component styles
export const componentStyles = {
  // Dropdown menu item
  dropdownItem: ds(
    designSystem.interactive.subtle.base,
    designSystem.interactive.subtle.hover,
    designSystem.interactive.subtle.focus,
    'cursor-pointer px-3 py-2 mx-1 flex items-center'
  ),

  // Dropdown menu item (destructive)
  dropdownItemDestructive: ds(
    designSystem.interactive.destructive.base,
    designSystem.interactive.destructive.hover,
    designSystem.interactive.destructive.focus,
    'cursor-pointer px-3 py-2 mx-1 flex items-center'
  ),

  // Button primary
  buttonPrimary: ds(
    designSystem.interactive.primary.base,
    designSystem.interactive.primary.hover,
    designSystem.interactive.primary.active,
    designSystem.interactive.primary.focus,
    designSystem.interactive.primary.disabled,
    'px-4 py-2 rounded-md font-medium',
    designSystem.animation.bounce
  ),

  // Button secondary
  buttonSecondary: ds(
    designSystem.interactive.secondary.base,
    designSystem.interactive.secondary.hover,
    designSystem.interactive.secondary.active,
    designSystem.interactive.secondary.focus,
    designSystem.interactive.secondary.disabled,
    'px-4 py-2 rounded-md font-medium',
    designSystem.animation.bounce
  ),

  // Input field
  input: ds(
    designSystem.input.base,
    designSystem.input.hover,
    designSystem.input.focus,
    'px-3 py-2 rounded-md'
  ),

  // Glass card
  glassCard: ds(
    designSystem.glass.primary,
    'rounded-lg shadow-xl',
    designSystem.animation.normal
  ),

  // Avatar button
  avatarButton: ds(
    'w-10 h-10 rounded-md flex items-center justify-center text-lg border transition-all duration-200',
    'hover:scale-110 hover:shadow-lg hover:shadow-white/20',
    'active:scale-95'
  ),
} 