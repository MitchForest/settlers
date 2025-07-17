// Shared avatar emojis for selection across the application
export const AVATAR_EMOJIS = [
  // Classic professions
  '🧙‍♂️', '🧙‍♀️', '👨‍🌾', '👩‍🌾', '👨‍🏭', '👩‍🏭', '👨‍💼', '👩‍💼',
  '👨‍🔬', '👩‍🔬', '👨‍🎨', '👩‍🎨', '👨‍🍳', '👩‍🍳', '👨‍⚕️', '👩‍⚕️',
  '🤴', '👸', '👨‍🚀', '👩‍🚀', '👨‍✈️', '👩‍✈️', '🕵️‍♂️', '🕵️‍♀️',
  '👨‍🦱', '👩‍🦱', '👨‍🦰', '👩‍🦰', '👨‍🦳', '👩‍🦳', '👨‍🦲', '👩‍🦲',
  
  // Fun humanoid characters
  '🧟‍♂️', '🧟‍♀️', '🧛‍♂️', '🧛‍♀️', '🧚‍♂️', '🧚‍♀️', '🧜‍♂️', '🧜‍♀️',
  '🧞‍♂️', '🧞‍♀️', '🤖', '👽', '👹', '👺', '🤡', '💀',
  '🎅', '🤶', '🧝‍♂️', '🧝‍♀️', '🦸‍♂️', '🦸‍♀️', '🦹‍♂️', '🦹‍♀️',
  
  // Forward-facing animals
  '🐱', '🐶', '🐺', '🦊', '🐻', '🐼', '🐨', '🐸',
  '🐯', '🦁', '🐷', '🐭', '🐹', '🐰', '🦝', '🦔'
] as const

// Type for avatar emoji validation
export type AvatarEmoji = typeof AVATAR_EMOJIS[number] 