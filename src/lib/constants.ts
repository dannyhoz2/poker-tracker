export const BUY_IN_AMOUNT = 10 // Fixed $10 buy-in

export const SESSION_STATUS = {
  ACTIVE: 'ACTIVE',
  CLOSED: 'CLOSED',
} as const

export const USER_ROLE = {
  ADMIN: 'ADMIN',
  PLAYER: 'PLAYER',
} as const

export const PLAYER_TYPE = {
  TEAM: 'TEAM',
  GUEST: 'GUEST',
  PIGGY_BANK: 'PIGGY_BANK',
} as const

export const PIGGY_BANK_CONTRIBUTION = 1 // $1 per team player per session

export const INVITATION_STATUS = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  EXPIRED: 'EXPIRED',
} as const

export const INVITATION_EXPIRY_DAYS = 7

// Special hands that earn an asterisk (*) - ordered by strength (highest first)
export const SPECIAL_HAND_TYPE = {
  ROYAL_FLUSH: 'ROYAL_FLUSH',
  STRAIGHT_FLUSH: 'STRAIGHT_FLUSH',
  FOUR_OF_A_KIND_ACES: 'FOUR_OF_A_KIND_ACES',
  FOUR_OF_A_KIND_KINGS: 'FOUR_OF_A_KIND_KINGS',
  FOUR_OF_A_KIND_QUEENS: 'FOUR_OF_A_KIND_QUEENS',
  FOUR_OF_A_KIND_JACKS: 'FOUR_OF_A_KIND_JACKS',
} as const

// Hand strength ranking (higher = stronger)
export const HAND_STRENGTH: Record<string, number> = {
  FOUR_OF_A_KIND_JACKS: 1,
  FOUR_OF_A_KIND_QUEENS: 2,
  FOUR_OF_A_KIND_KINGS: 3,
  FOUR_OF_A_KIND_ACES: 4,
  STRAIGHT_FLUSH: 5,
  ROYAL_FLUSH: 6,
}

export const SPECIAL_HAND_LABELS: Record<string, string> = {
  FOUR_OF_A_KIND_JACKS: 'Four Jacks',
  FOUR_OF_A_KIND_QUEENS: 'Four Queens',
  FOUR_OF_A_KIND_KINGS: 'Four Kings',
  FOUR_OF_A_KIND_ACES: 'Four Aces',
  STRAIGHT_FLUSH: 'Straight Flush',
  ROYAL_FLUSH: 'Royal Flush',
}
