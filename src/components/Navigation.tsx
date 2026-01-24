'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'

export default function Navigation() {
  const { user, logout } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    logout()
    router.push('/login')
  }

  const navLinks = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/sessions', label: 'Sessions' },
    { href: '/stats', label: 'Statistics' },
  ]

  if (user?.role === 'ADMIN') {
    navLinks.push({ href: '/admin', label: 'Admin' })
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <nav className="bg-gray-800 border-b border-gray-700 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="text-2xl">🃏</span>
            <span className="font-bold text-lg text-emerald-400 hidden sm:block">
              Poker Night
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive(link.href)
                    ? 'bg-emerald-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-sm text-gray-400">
              {user?.name}
            </div>
            <button
              onClick={handleLogout}
              className="hidden md:block px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors"
            >
              Logout
            </button>

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 rounded-lg text-gray-400 hover:bg-gray-700 hover:text-white"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {isMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden border-t border-gray-700">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMenuOpen(false)}
                className={`block px-3 py-2 rounded-lg text-base font-medium ${
                  isActive(link.href)
                    ? 'bg-emerald-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <button
              onClick={handleLogout}
              className="w-full text-left px-3 py-2 rounded-lg text-base font-medium text-gray-300 hover:bg-gray-700 hover:text-white"
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </nav>
  )
}
