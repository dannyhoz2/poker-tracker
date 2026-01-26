'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'

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
  playerCount: number
  isArchived?: boolean
  specialHandsCount?: number
}

export default function SessionsPage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isStarting, setIsStarting] = useState(false)
  const [filter, setFilter] = useState<'all' | 'active' | 'closed'>('all')
  const [showArchived, setShowArchived] = useState(false)
  const [isNewSessionModalOpen, setIsNewSessionModalOpen] = useState(false)
  const [selectedHostLocationId, setSelectedHostLocationId] = useState('')

  useEffect(() => {
    fetchSessions()
    fetchUsers()
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

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users')
      const data = await res.json()
      setUsers(data.users || [])
    } catch (error) {
      console.error('Failed to fetch users:', error)
    }
  }

  const openNewSessionModal = () => {
    setSelectedHostLocationId('')
    setIsNewSessionModalOpen(true)
  }

  const startSession = async () => {
    if (!selectedHostLocationId) {
      alert('Please select a host location')
      return
    }

    setIsStarting(true)
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostLocationId: selectedHostLocationId }),
      })

      if (res.ok) {
        const data = await res.json()
        setIsNewSessionModalOpen(false)
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
            onClick={openNewSessionModal}
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
                  <div className="text-right flex items-center gap-3">
                    {session.specialHandsCount && session.specialHandsCount > 0 && (
                      <span className="text-amber-400 font-bold text-lg" title={`${session.specialHandsCount} special hand${session.specialHandsCount > 1 ? 's' : ''}`}>
                        {'*'.repeat(session.specialHandsCount)}
                      </span>
                    )}
                    <div>
                      <p className="font-bold text-emerald-400">
                        ${session.totalPot}
                      </p>
                      <p className="text-sm text-gray-500">total pot</p>
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* New Session Modal */}
      <Modal
        isOpen={isNewSessionModalOpen}
        onClose={() => setIsNewSessionModalOpen(false)}
        title="Start New Session"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Where are we playing tonight?
            </label>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {users.map((user) => (
                <button
                  key={user.id}
                  onClick={() => setSelectedHostLocationId(user.id)}
                  className={`w-full p-3 rounded-lg text-left transition-colors flex items-center justify-between ${
                    selectedHostLocationId === user.id
                      ? 'bg-emerald-700/50 border border-emerald-500'
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  <p className="font-medium text-gray-100">{user.name}&apos;s house</p>
                  {selectedHostLocationId === user.id && (
                    <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setIsNewSessionModalOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={startSession}
              isLoading={isStarting}
              disabled={!selectedHostLocationId}
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
