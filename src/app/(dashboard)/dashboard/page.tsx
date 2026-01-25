'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import { BUY_IN_AMOUNT } from '@/lib/constants'

interface User {
  id: string
  name: string
}

interface Session {
  id: string
  date: string
  status: 'ACTIVE' | 'CLOSED'
  host: { id: string; name: string }
  players: Array<{
    id: string
    buyInCount: number
    cashOut: number | null
    user: { id: string; name: string }
  }>
  totalPot: number
}

interface Stats {
  totalSessions: number
  playerStats: Array<{
    userId: string
    userName: string
    netGainLoss: number
    sessionsPlayed: number
  }>
}

export default function DashboardPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [activeSession, setActiveSession] = useState<Session | null>(null)
  const [recentSessions, setRecentSessions] = useState<Session[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [piggyBankTotal, setPiggyBankTotal] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isStarting, setIsStarting] = useState(false)
  const [isHostLocationModalOpen, setIsHostLocationModalOpen] = useState(false)
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [selectedHostLocation, setSelectedHostLocation] = useState<string>('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [activeRes, sessionsRes, statsRes, piggyBankRes] = await Promise.all([
        fetch('/api/sessions/active'),
        fetch('/api/sessions?status=CLOSED'),
        fetch('/api/stats'),
        fetch('/api/piggy-bank'),
      ])

      const activeData = await activeRes.json()
      const sessionsData = await sessionsRes.json()
      const statsData = await statsRes.json()
      const piggyBankData = await piggyBankRes.json()

      setActiveSession(activeData.session)
      setRecentSessions(sessionsData.sessions?.slice(0, 5) || [])
      setStats(statsData)
      setPiggyBankTotal(piggyBankData.total || 0)
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const openHostLocationModal = async () => {
    // Fetch users for host location selection
    try {
      const res = await fetch('/api/users')
      if (res.ok) {
        const data = await res.json()
        setAllUsers(data.users || [])
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    }
    setSelectedHostLocation('')
    setIsHostLocationModalOpen(true)
  }

  const startSession = async () => {
    setIsStarting(true)
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostLocationId: selectedHostLocation || null,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        setIsHostLocationModalOpen(false)
        router.push(`/sessions/${data.session.id}`)
      }
    } catch (error) {
      console.error('Failed to start session:', error)
    } finally {
      setIsStarting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500" />
      </div>
    )
  }

  const myStats = stats?.playerStats?.find((s) => s.userId === user?.id)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">
            Welcome back, {user?.name}!
          </h1>
          <p className="text-gray-400 mt-1">
            {activeSession
              ? 'There\'s an active session in progress'
              : 'Ready to start a new game?'}
          </p>
        </div>

        {!activeSession && (
          <Button
            onClick={openHostLocationModal}
            size="lg"
            className="w-full sm:w-auto"
          >
            Start New Session
          </Button>
        )}
      </div>

      {/* Active Session Banner */}
      {activeSession && (
        <Card className="bg-emerald-900/30 border-emerald-700">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse-live" />
                <span className="text-emerald-400 font-medium">Live Session</span>
              </div>
              <p className="text-gray-300 mt-1">
                Hosted by {activeSession.host.name} •{' '}
                {activeSession.players.length} players • ${activeSession.totalPot} pot
              </p>
            </div>
            <Link href={`/sessions/${activeSession.id}`}>
              <Button variant="success">View Session</Button>
            </Link>
          </div>
        </Card>
      )}

      {/* Piggy Bank Banner */}
      <Card className="bg-amber-900/30 border-amber-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🐷</span>
            <div>
              <h3 className="text-lg font-semibold text-amber-400">Piggy Bank</h3>
              <p className="text-sm text-gray-400">$1 from each team player per session</p>
            </div>
          </div>
          <p className="text-3xl font-bold text-amber-400">${piggyBankTotal}</p>
        </div>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
            Your YTD Earnings
          </h3>
          <p
            className={`mt-2 text-3xl font-bold ${
              (myStats?.netGainLoss ?? 0) >= 0
                ? 'text-emerald-400'
                : 'text-red-400'
            }`}
          >
            {(myStats?.netGainLoss ?? 0) >= 0 ? '+' : ''}$
            {myStats?.netGainLoss ?? 0}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {myStats?.sessionsPlayed ?? 0} sessions played
          </p>
        </Card>

        <Card>
          <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
            Total Sessions
          </h3>
          <p className="mt-2 text-3xl font-bold text-gray-100">
            {stats?.totalSessions ?? 0}
          </p>
          <p className="text-sm text-gray-500 mt-1">this year</p>
        </Card>

        <Card>
          <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
            Top Winner
          </h3>
          {stats?.playerStats?.[0] ? (
            <>
              <p className="mt-2 text-3xl font-bold text-emerald-400">
                +${stats.playerStats[0].netGainLoss}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {stats.playerStats[0].userName}
              </p>
            </>
          ) : (
            <p className="mt-2 text-gray-500">No data yet</p>
          )}
        </Card>
      </div>

      {/* Recent Sessions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-100">Recent Sessions</h2>
          <Link
            href="/sessions"
            className="text-emerald-400 hover:text-emerald-300 text-sm"
          >
            View all →
          </Link>
        </div>

        {recentSessions.length === 0 ? (
          <Card>
            <p className="text-center text-gray-400 py-8">
              No completed sessions yet. Start your first game!
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {recentSessions.map((session) => (
              <Link key={session.id} href={`/sessions/${session.id}`}>
                <Card className="card-hover cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-100">
                        {new Date(session.date).toLocaleDateString('en-US', {
                          weekday: 'long',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                      <p className="text-sm text-gray-400">
                        {session.players.length} players • Hosted by{' '}
                        {session.host.name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-emerald-400">
                        ${session.totalPot}
                      </p>
                      <p className="text-sm text-gray-500">total pot</p>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Host Location Selection Modal */}
      <Modal
        isOpen={isHostLocationModalOpen}
        onClose={() => setIsHostLocationModalOpen(false)}
        title="Start New Session"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Whose house are we playing at?
            </label>
            <select
              value={selectedHostLocation}
              onChange={(e) => setSelectedHostLocation(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Select host location...</option>
              {allUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}&apos;s house
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              onClick={() => setIsHostLocationModalOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={startSession}
              isLoading={isStarting}
              className="flex-1"
            >
              Start Session
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
