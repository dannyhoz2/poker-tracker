'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuthStore } from '@/hooks/useAuth'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Card from '@/components/ui/Card'

function RegisterForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isVerifying, setIsVerifying] = useState(!!token)
  const [inviteValid, setInviteValid] = useState(false)
  const setUser = useAuthStore((state) => state.setUser)
  const router = useRouter()

  useEffect(() => {
    if (token) {
      verifyInvite()
    } else {
      checkFirstUser()
    }
  }, [token])

  const checkFirstUser = async () => {
    try {
      const res = await fetch('/api/users')
      if (res.status === 401) {
        // No users exist, allow registration
        setInviteValid(true)
        setIsVerifying(false)
      } else {
        setError('Registration requires an invitation')
        setIsVerifying(false)
      }
    } catch {
      setError('Failed to check registration status')
      setIsVerifying(false)
    }
  }

  const verifyInvite = async () => {
    try {
      const res = await fetch(`/api/invitations/verify?token=${token}`)
      const data = await res.json()

      if (data.valid) {
        setInviteValid(true)
        setEmail(data.invitation.email)
        setName(data.invitation.name)
      } else {
        setError(data.error || 'Invalid invitation')
      }
    } catch {
      setError('Failed to verify invitation')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setIsLoading(true)

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, inviteToken: token }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Registration failed')
      }

      setUser(data.user)
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setIsLoading(false)
    }
  }

  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500" />
          <p className="text-gray-400">Verifying invitation...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <div className="text-center mb-8">
          <span className="text-5xl">🃏</span>
          <h1 className="mt-4 text-2xl font-bold text-gray-100">
            Join Poker Night
          </h1>
          <p className="mt-2 text-gray-400">Create your account</p>
        </div>

        {!inviteValid ? (
          <div className="text-center">
            <p className="text-red-400 mb-4">{error}</p>
            <Link href="/login" className="text-emerald-400 hover:underline">
              Back to login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            <Input
              id="name"
              type="text"
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              required
            />

            <Input
              id="email"
              type="email"
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              disabled={!!token}
            />

            <Input
              id="password"
              type="password"
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              required
            />

            <Input
              id="confirmPassword"
              type="password"
              label="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              required
            />

            <Button
              type="submit"
              className="w-full"
              size="lg"
              isLoading={isLoading}
            >
              Create Account
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-gray-400">
          Already have an account?{' '}
          <Link href="/login" className="text-emerald-400 hover:underline">
            Sign in
          </Link>
        </p>
      </Card>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500" />
      </div>
    }>
      <RegisterForm />
    </Suspense>
  )
}
