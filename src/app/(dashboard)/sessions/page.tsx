'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'

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
  playerCount: number
  isArchived?: boolean
}

export default function SessionsPage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isStarting, setIsStarting] = useState(false)
  const [filter, setFilter] = useState<'all' | 'active' | 'closed'>('all')
  const [showArchived, setShowArchived] = useState(false)

  useEffect(() => {
    fetchSessions()
  }, [showArchived])

  const fetchSessions = async () => {
    try {
      const url = showArchived ? '/api/sessions?includeArchived=true' : '/api/sessions'
      const res = await fetch(url)
      const data = await res.json()
      setSessions(data.sessions || [])
    } catch (error) {
      console.error('Failed to fetch sessions:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const startSession = async () => {
    setIsStarting(true)
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (res.ok) {
        const data = await res.json()
        router.push(`/sessions/${data.session.id}`)
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to start session')
      }
    } catch (error) {
      console.error('Failed to start session:', error)
    } finally {
      setIsStarting(false)
    }
  }

  const filteredSessions = sessions.filter((s) => {
    if (filter === 'active') return s.status === 'ACTIVE'
    if (filter === 'closed') return s.status === 'CLOSED'
    return true
  })

  const hasActiveSession = sessions.some((s) => s.status === 'ACTIVE')

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-100">Sessions</h1>

        {!hasActiveSession && (
          <Button
            onClick={startSession}
            isLoading={isStarting}
            className="w-full sm:w-auto"
          >
            Start New Session
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex gap-2">
          {(['all', 'active', 'closed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-gray-900"
          />
          Show archived
        </label>
      </div>

      {/* Sessions List */}
      {filteredSessions.length === 0 ? (
        <Card>
          <p className="text-center text-gray-400 py-8">
            No sessions found. Start a new game!
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredSessions.map((session) => (
            <Link key={session.id} href={`/sessions/${session.id}`}>
              <Card className="card-hover cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col gap-1">
                      {session.status === 'ACTIVE' && (
                        <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium w-fit">
                          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse-live" />
                          Live
                        </span>
                      )}
                      {session.isArchived && (
                        <span className="px-2 py-1 rounded-full bg-gray-600/50 text-gray-400 text-xs font-medium w-fit">
                          Archived
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-100">
                        {new Date(session.date).toLocaleDateString('en-US', {
                          weekday: 'long',
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                      <p className="text-sm text-gray-400">
                        {session.playerCount} players • Hosted by {session.host.name}
                      </p>
                    </div>
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
  )
}
