'use client'

import { create } from 'zustand'
import type { Session, SessionPlayer } from '@/types'

interface SessionState {
  activeSession: Session | null
  isLoading: boolean
  error: string | null
  setActiveSession: (session: Session | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  updatePlayer: (player: SessionPlayer) => void
  addPlayer: (player: SessionPlayer) => void
  removePlayer: (playerId: string) => void
}

export const useSession = create<SessionState>((set, get) => ({
  activeSession: null,
  isLoading: false,
  error: null,
  setActiveSession: (session) => set({ activeSession: session, error: null }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  updatePlayer: (player) => {
    const session = get().activeSession
    if (!session) return

    set({
      activeSession: {
        ...session,
        players: session.players?.map((p) =>
          p.id === player.id ? player : p
        ),
      },
    })
  },
  addPlayer: (player) => {
    const session = get().activeSession
    if (!session) return

    set({
      activeSession: {
        ...session,
        players: [...(session.players || []), player],
      },
    })
  },
  removePlayer: (playerId) => {
    const session = get().activeSession
    if (!session) return

    set({
      activeSession: {
        ...session,
        players: session.players?.filter((p) => p.id !== playerId),
      },
    })
  },
}))
