export interface User {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'PLAYER'
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Session {
  id: string
  date: Date
  status: 'ACTIVE' | 'CLOSED'
  hostId: string
  totalPot: number
  notes?: string | null
  closedAt?: Date | null
  createdAt: Date
  updatedAt: Date
  host?: User
  players?: SessionPlayer[]
}

export interface SessionPlayer {
  id: string
  sessionId: string
  userId: string
  buyInCount: number
  cashOut?: number | null
  joinedAt: Date
  leftAt?: Date | null
  createdAt: Date
  updatedAt: Date
  user?: User
  session?: Session
}

export interface Invitation {
  id: string
  email: string
  name: string
  token: string
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED'
  expiresAt: Date
  invitedById: string
  createdAt: Date
  updatedAt: Date
  invitedBy?: User
}

export interface PlayerStats {
  userId: string
  userName: string
  totalBuyIns: number
  totalCashOut: number
  netGainLoss: number
  sessionsPlayed: number
  totalSessions: number
  avgGainLoss: number
  winRate: number
  attendanceRate: number
  biggestWin: number
  biggestLoss: number
}

export interface SessionSummary {
  id: string
  date: Date
  playerCount: number
  totalPot: number
  hostName: string
  status: 'ACTIVE' | 'CLOSED'
}

export type WebSocketEvent =
  | { type: 'SESSION_UPDATED'; data: Session }
  | { type: 'PLAYER_JOINED'; data: SessionPlayer }
  | { type: 'PLAYER_LEFT'; data: SessionPlayer }
  | { type: 'BUY_IN_ADDED'; data: SessionPlayer }
  | { type: 'CASH_OUT_RECORDED'; data: SessionPlayer }
  | { type: 'SESSION_CLOSED'; data: Session }

export type SpecialHandType =
  | 'FOUR_OF_A_KIND_JACKS'
  | 'FOUR_OF_A_KIND_QUEENS'
  | 'FOUR_OF_A_KIND_KINGS'
  | 'FOUR_OF_A_KIND_ACES'
  | 'STRAIGHT_FLUSH'
  | 'ROYAL_FLUSH'

export interface SpecialHand {
  id: string
  sessionId: string
  playerId: string
  handType: SpecialHandType
  cards: string
  description?: string | null
  createdAt: Date
  player?: User
  session?: Session
}

export interface AsteriskStats {
  playerId: string
  playerName: string
  totalAsterisks: number
  hands: {
    handType: SpecialHandType
    count: number
    bestStrength: number
  }[]
  strongestHand: SpecialHandType
  strongestHandStrength: number
}
