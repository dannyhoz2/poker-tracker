'use client'

import { useEffect, ReactNode, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth, useAuthStore, fetchCurrentUser } from '@/hooks/useAuth'

const publicPaths = ['/login', '/register']

export default function AuthProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const setUser = useAuthStore((state) => state.setUser)
  const router = useRouter()
  const pathname = usePathname()
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      const currentUser = await fetchCurrentUser()
      setUser(currentUser)
      setHasCheckedAuth(true)
    }

    checkAuth()
  }, [setUser])

  useEffect(() => {
    if (!hasCheckedAuth) return

    const isPublicPath = publicPaths.some(
      (path) => pathname === path || pathname.startsWith(path)
    )

    if (!user && !isPublicPath) {
      router.push('/login')
    } else if (user && isPublicPath) {
      router.push('/dashboard')
    }
  }, [user, hasCheckedAuth, pathname, router])

  if (!hasCheckedAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
