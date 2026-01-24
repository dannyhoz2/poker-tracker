'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useEffect, useState } from 'react'

interface User {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'PLAYER'
}

interface AuthState {
  user: User | null
  isLoading: boolean
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  logout: () => void
  _hasHydrated: boolean
  setHasHydrated: (state: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isLoading: true,
      _hasHydrated: false,
      setUser: (user) => set({ user, isLoading: false }),
      setLoading: (isLoading) => set({ isLoading }),
      logout: () => set({ user: null, isLoading: false }),
      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)

// Hook that handles hydration properly
export const useAuth = () => {
  const store = useAuthStore()
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setIsHydrated(true)
  }, [])

  return {
    ...store,
    isLoading: !isHydrated || store.isLoading,
  }
}

export async function fetchCurrentUser() {
  try {
    const res = await fetch('/api/auth/me')
    if (res.ok) {
      const data = await res.json()
      return data.user
    }
    return null
  } catch {
    return null
  }
}
