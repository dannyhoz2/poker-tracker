'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import { BUY_IN_AMOUNT, SPECIAL_HAND_TYPE, SPECIAL_HAND_LABELS, HAND_STRENGTH } from '@/lib/constants'
import type { SpecialHandType } from '@/types'

interface User {
  id: string
  name: string
}

interface SessionPlayer {
  id: string
  userId: string
  buyInCount: number
  chipsSold: number
  cashOut: number | null
  user: User
}

interface BuyInTransfer {
  id: string
  sellerId: string
  buyerId: string
  amount: number
  createdAt: string
  seller: User
  buyer: User
}

interface SpecialHand {
  id: string
  sessionId: string
  playerId: string
  handType: SpecialHandType
  cards: string
  description?: string | null
  createdAt: string
  player: User
}

interface SessionTransaction {
  id: string
  type: 'BUY_IN' | 'REMOVE_BUY_IN' | 'SELL_BUY_IN' | 'CASH_OUT'
  amount: number
  createdAt: string
  player: User
  targetPlayer?: User | null
}

interface Session {
  id: string
  date: string
  status: 'ACTIVE' | 'CLOSED'
  hostId: string
  host: User
  hostLocationId?: string
  hostLocation?: User
  players: SessionPlayer[]
  transfers: BuyInTransfer[]
  specialHands: SpecialHand[]
  transactions: SessionTransaction[]
  totalPot: number
  notes?: string
  isArchived?: boolean
  piggyBankContribution?: number
}

export default function SessionPage() {
  const params = useParams()
  const id = params.id as string
  const { user } = useAuth()
  const router = useRouter()

  const [session, setSession] = useState<Session | null>(null)
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAddPlayerOpen, setIsAddPlayerOpen] = useState(false)
  const [selectedPlayersToAdd, setSelectedPlayersToAdd] = useState<string[]>([])
  const [isCashOutOpen, setIsCashOutOpen] = useState(false)
  const [isSellBuyInOpen, setIsSellBuyInOpen] = useState(false)
  const [isAddSpecialHandOpen, setIsAddSpecialHandOpen] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<SessionPlayer | null>(null)
  const [cashOutAmount, setCashOutAmount] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [specialHandPlayerId, setSpecialHandPlayerId] = useState('')
  const [specialHandType, setSpecialHandType] = useState<SpecialHandType | ''>('')
  const [specialHandCards, setSpecialHandCards] = useState('')
  const [specialHandDescription, setSpecialHandDescription] = useState('')
  const [isEditDateOpen, setIsEditDateOpen] = useState(false)
  const [editDateValue, setEditDateValue] = useState('')
  const [isEditHostLocationOpen, setIsEditHostLocationOpen] = useState(false)
  const [selectedHostLocationId, setSelectedHostLocationId] = useState('')

  const isHost = session?.hostId === user?.id
  const isAdmin = user?.role === 'ADMIN'
  const canEdit = isHost || isAdmin
  const isActive = session?.status === 'ACTIVE'

  useEffect(() => {
    fetchSession()
    fetchUsers()
  }, [id])

  // Separate effect for polling - re-runs when session status changes
  useEffect(() => {
    if (session?.status !== 'ACTIVE') return

    // Poll for updates every 3 seconds for active sessions
    const interval = setInterval(() => {
      fetchSession()
    }, 3000)

    return () => clearInterval(interval)
  }, [id, session?.status])

  const fetchSession = async () => {
    try {
      const res = await fetch(`/api/sessions/${id}`)
      if (res.ok) {
        const data = await res.json()
        setSession(data.session)
      }
    } catch (error) {
      console.error('Failed to fetch session:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users')
      if (res.ok) {
        const data = await res.json()
        setAllUsers(data.users || [])
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    }
  }

  const togglePlayerSelection = (userId: string) => {
    setSelectedPlayersToAdd((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    )
  }

  const addSelectedPlayers = async () => {
    if (selectedPlayersToAdd.length === 0) return

    setIsSubmitting(true)
    try {
      // Add players one by one
      for (const userId of selectedPlayersToAdd) {
        const res = await fetch(`/api/sessions/${id}/players`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        })

        if (!res.ok) {
          const error = await res.json()
          console.error(`Failed to add player ${userId}:`, error.error)
        }
      }

      await fetchSession()
      setIsAddPlayerOpen(false)
      setSelectedPlayersToAdd([])
    } catch (error) {
      console.error('Failed to add players:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const addBuyIn = async (playerId: string, playerName: string) => {
    if (!confirm(`Add $10 buy-in for ${playerName}?`)) return

    try {
      const res = await fetch(`/api/sessions/${id}/players/${playerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'buyIn' }),
      })

      if (res.ok) {
        await fetchSession()
      }
    } catch (error) {
      console.error('Failed to add buy-in:', error)
    }
  }

  const removeBuyIn = async (playerId: string, playerName: string) => {
    if (!confirm(`Remove $10 buy-in from ${playerName}?`)) return

    try {
      const res = await fetch(`/api/sessions/${id}/players/${playerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'removeBuyIn' }),
      })

      if (res.ok) {
        await fetchSession()
      }
    } catch (error) {
      console.error('Failed to remove buy-in:', error)
    }
  }

  const removePlayer = async (playerId: string, playerName: string) => {
    if (!confirm(`Remove ${playerName} from this session? This will undo all their buy-ins and transactions.`)) return

    try {
      const res = await fetch(`/api/sessions/${id}/players/${playerId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        await fetchSession()
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to remove player')
      }
    } catch (error) {
      console.error('Failed to remove player:', error)
    }
  }

  const recordCashOut = async () => {
    if (!selectedPlayer) return

    const amount = parseFloat(cashOutAmount)
    if (isNaN(amount) || amount < 0) {
      alert('Please enter a valid amount')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch(
        `/api/sessions/${id}/players/${selectedPlayer.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'cashOut', cashOut: amount }),
        }
      )

      if (res.ok) {
        await fetchSession()
        setIsCashOutOpen(false)
        setSelectedPlayer(null)
        setCashOutAmount('')
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to record cash out')
      }
    } catch (error) {
      console.error('Failed to record cash out:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const undoCashOut = async (playerId: string) => {
    try {
      const res = await fetch(`/api/sessions/${id}/players/${playerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'undoCashOut' }),
      })

      if (res.ok) {
        await fetchSession()
      }
    } catch (error) {
      console.error('Failed to undo cash out:', error)
    }
  }

  const undoTransaction = async (transactionId: string, transactionType: string, playerName: string) => {
    const actionLabel = transactionType === 'BUY_IN' ? 'buy-in' :
                        transactionType === 'SELL_BUY_IN' ? 'sell' :
                        transactionType === 'CASH_OUT' ? 'cash out' : 'transaction'

    if (!confirm(`Undo ${playerName}'s ${actionLabel}?`)) return

    try {
      const res = await fetch(`/api/sessions/${id}/transactions/${transactionId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        await fetchSession()
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to undo transaction')
      }
    } catch (error) {
      console.error('Failed to undo transaction:', error)
    }
  }

  const closeSession = async () => {
    if (!confirm('Are you sure you want to close this session?')) return

    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/sessions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close' }),
      })

      if (res.ok) {
        await fetchSession()
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to close session')
      }
    } catch (error) {
      console.error('Failed to close session:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const openCashOut = (player: SessionPlayer) => {
    setSelectedPlayer(player)
    setCashOutAmount('')
    setIsCashOutOpen(true)
  }

  const openSellBuyIn = (player: SessionPlayer) => {
    setSelectedPlayer(player)
    setIsSellBuyInOpen(true)
  }

  const sellBuyIn = async (buyerUserId: string, buyerName: string) => {
    if (!selectedPlayer) return

    if (!confirm(`Sell $10 buy-in from ${selectedPlayer.user.name} to ${buyerName}?`)) return

    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/sessions/${id}/players/${selectedPlayer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sellBuyIn', buyerId: buyerUserId }),
      })

      if (!res.ok) {
        const error = await res.json()
        alert(error.error || 'Failed to sell buy-in')
        return
      }

      await fetchSession()
      setIsSellBuyInOpen(false)
      setSelectedPlayer(null)
    } catch (error) {
      console.error('Failed to sell buy-in:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const reopenSession = async () => {
    if (!confirm('Are you sure you want to reopen this session? It will become active again.')) return

    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/sessions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reopen' }),
      })

      if (res.ok) {
        await fetchSession()
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to reopen session')
      }
    } catch (error) {
      console.error('Failed to reopen session:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const archiveSession = async () => {
    if (!confirm('Are you sure you want to archive this session? It will be hidden from the sessions list.')) return

    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/sessions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'archive', isArchived: true }),
      })

      if (res.ok) {
        router.push('/sessions')
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to archive session')
      }
    } catch (error) {
      console.error('Failed to archive session:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const unarchiveSession = async () => {
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/sessions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: false }),
      })

      if (res.ok) {
        await fetchSession()
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to unarchive session')
      }
    } catch (error) {
      console.error('Failed to unarchive session:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const addSpecialHand = async () => {
    if (!specialHandPlayerId || !specialHandType) {
      alert('Please select a player and hand type')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/sessions/${id}/special-hands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: specialHandPlayerId,
          handType: specialHandType,
          cards: specialHandCards,
          description: specialHandDescription,
        }),
      })

      if (res.ok) {
        await fetchSession()
        setIsAddSpecialHandOpen(false)
        setSpecialHandPlayerId('')
        setSpecialHandType('')
        setSpecialHandCards('')
        setSpecialHandDescription('')
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to add special hand')
      }
    } catch (error) {
      console.error('Failed to add special hand:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const deleteSpecialHand = async (handId: string) => {
    if (!confirm('Are you sure you want to delete this special hand?')) return

    try {
      const res = await fetch(`/api/sessions/${id}/special-hands/${handId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        await fetchSession()
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to delete special hand')
      }
    } catch (error) {
      console.error('Failed to delete special hand:', error)
    }
  }

  const openEditDate = () => {
    if (session) {
      // Format date as YYYY-MM-DD for the input
      const date = new Date(session.date)
      const formatted = date.toISOString().split('T')[0]
      setEditDateValue(formatted)
      setIsEditDateOpen(true)
    }
  }

  const updateSessionDate = async () => {
    if (!editDateValue) return

    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/sessions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: editDateValue }),
      })

      if (res.ok) {
        await fetchSession()
        setIsEditDateOpen(false)
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to update session date')
      }
    } catch (error) {
      console.error('Failed to update session date:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const openEditHostLocation = () => {
    setSelectedHostLocationId(session?.hostLocationId || '')
    setIsEditHostLocationOpen(true)
  }

  const updateHostLocation = async () => {
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/sessions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostLocationId: selectedHostLocationId || null }),
      })

      if (res.ok) {
        await fetchSession()
        setIsEditHostLocationOpen(false)
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to update host location')
      }
    } catch (error) {
      console.error('Failed to update host location:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Calculate totals
  const totalBuyIns = session?.players.reduce(
    (sum, p) => sum + p.buyInCount * BUY_IN_AMOUNT,
    0
  ) ?? 0

  const piggyBankAmount = session?.piggyBankContribution || 0

  // Total cash-outs include chipsSold (extra cash from selling chips when at 0 buy-ins)
  const totalChipsSold = session?.players.reduce(
    (sum, p) => sum + (p.chipsSold || 0),
    0
  ) ?? 0

  const totalCashOuts = session?.players.reduce(
    (sum, p) => sum + (p.cashOut ?? 0),
    0
  ) ?? 0

  // Effective cash-outs include both actual cash-outs and chips sold
  const effectiveCashOuts = totalCashOuts + totalChipsSold

  // Amount available to distribute to players (total pot minus piggy bank)
  const distributablePot = totalBuyIns - piggyBankAmount

  // Session is balanced when cash-outs (including chipsSold) equal the distributable pot
  const isBalanced = effectiveCashOuts === distributablePot
  const allCashedOut = session?.players.every(
    (p) => p.buyInCount === 0 || p.cashOut !== null
  )

  const availableUsers = allUsers.filter(
    (u) => !session?.players.some((p) => p.userId === u.id)
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Session not found</p>
        <Button onClick={() => router.push('/sessions')} className="mt-4">
          Back to Sessions
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-100">
              {new Date(session.date).toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </h1>
            {isAdmin && (
              <button
                onClick={openEditDate}
                className="text-gray-500 hover:text-gray-300 transition-colors"
                title="Edit date"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
              </button>
            )}
            {isActive && (
              <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse-live" />
                Live
              </span>
            )}
            {session.isArchived && (
              <span className="px-2 py-1 rounded-full bg-gray-600/50 text-gray-400 text-xs font-medium">
                Archived
              </span>
            )}
          </div>
          <p className="text-gray-400 mt-1">
            Hosted by {session.host.name}
            {isHost && ' (You)'}
          </p>
          <p className="text-gray-500 text-sm mt-1 flex items-center gap-1">
            <span>📍</span>
            {session.hostLocation ? (
              <span>{session.hostLocation.name}&apos;s house</span>
            ) : (
              <span className="text-gray-600 italic">No location set</span>
            )}
            {canEdit && (
              <button
                onClick={openEditHostLocation}
                className="ml-1 text-gray-500 hover:text-gray-300 transition-colors"
                title="Edit host location"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
              </button>
            )}
          </p>
          {session.notes && (
            <p className="text-gray-500 text-sm mt-1">{session.notes}</p>
          )}
        </div>

        {canEdit && (
          <div className="flex gap-2 flex-wrap">
            {isActive && canEdit && (
              <>
                <Button onClick={() => setIsAddPlayerOpen(true)} variant="secondary">
                  Add Player
                </Button>
                <Button
                  onClick={closeSession}
                  variant="danger"
                  disabled={!isBalanced || !allCashedOut}
                  isLoading={isSubmitting}
                >
                  Close Session
                </Button>
              </>
            )}
            {canEdit && (
              <>
                {!isActive && (
                  <Button onClick={reopenSession} variant="secondary" isLoading={isSubmitting}>
                    Reopen
                  </Button>
                )}
                {session.isArchived ? (
                  <Button onClick={unarchiveSession} variant="secondary" isLoading={isSubmitting}>
                    Unarchive
                  </Button>
                ) : (
                  <Button onClick={archiveSession} variant="secondary" isLoading={isSubmitting}>
                    Archive
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="text-center">
          <p className="text-sm text-gray-400">Players</p>
          <p className="text-2xl font-bold text-gray-100">
            {session.players.length}
          </p>
        </Card>
        <Card className="text-center">
          <p className="text-sm text-gray-400">Total Pot</p>
          <p className="text-2xl font-bold text-emerald-400">${totalBuyIns}</p>
        </Card>
        <Card className="text-center">
          <p className="text-sm text-gray-400">Cashed Out</p>
          <p className={`text-2xl font-bold ${isBalanced ? 'text-emerald-400' : 'text-amber-400'}`}>
            ${effectiveCashOuts} / ${distributablePot}
          </p>
        </Card>
        <Card className="text-center bg-amber-900/20 border-amber-700/50">
          <p className="text-sm text-amber-400/80 flex items-center justify-center gap-1">
            <span>Piggy Bank</span>
          </p>
          <p className="text-2xl font-bold text-amber-400">
            ${piggyBankAmount}
          </p>
        </Card>
      </div>

      {/* Balance Warning */}
      {isActive && !isBalanced && effectiveCashOuts > 0 && (
        <Card className="bg-amber-900/30 border-amber-700">
          <p className="text-amber-400">
            ⚠️ Distributable pot (${distributablePot}) and cash-outs (${effectiveCashOuts}) don&apos;t
            match. Difference: ${Math.abs(distributablePot - effectiveCashOuts)}
          </p>
        </Card>
      )}

      {/* Players List */}
      <div>
        <h2 className="text-lg font-semibold text-gray-100 mb-4">Players</h2>
        <div className="space-y-3">
          {session.players.map((player) => {
            const buyInTotal = player.buyInCount * BUY_IN_AMOUNT
            const chipsSold = player.chipsSold || 0
            // Net result: cashOut + chipsSold - buyInTotal
            const netResult =
              player.cashOut !== null ? (player.cashOut + chipsSold) - buyInTotal : null

            return (
              <Card key={player.id}>
                <div className="flex flex-col gap-3">
                  {/* Player info row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-lg font-medium flex-shrink-0">
                        {player.user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-gray-100">
                            {player.user.name}
                            {player.userId === session.hostId && (
                              <span className="ml-2 text-xs text-emerald-400">
                                Host
                              </span>
                            )}
                          </p>
                          {/* Chip indicators */}
                          <div className="flex items-center gap-0.5">
                            {/* Yellow chips for buy-ins */}
                            {Array.from({ length: player.buyInCount }).map((_, i) => (
                              <svg key={`yellow-${i}`} className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="10" fill="#EAB308" stroke="#CA8A04" strokeWidth="2"/>
                                <circle cx="12" cy="12" r="6" stroke="#CA8A04" strokeWidth="1" fill="none"/>
                              </svg>
                            ))}
                            {/* Green chips for sold buy-ins */}
                            {chipsSold > 0 && Array.from({ length: Math.floor(chipsSold / BUY_IN_AMOUNT) }).map((_, i) => (
                              <svg key={`green-${i}`} className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="10" fill="#22C55E" stroke="#16A34A" strokeWidth="2"/>
                                <circle cx="12" cy="12" r="6" stroke="#16A34A" strokeWidth="1" fill="none"/>
                              </svg>
                            ))}
                          </div>
                        </div>
                        <p className="text-sm text-gray-400">
                          {player.buyInCount} buy-in{player.buyInCount !== 1 ? 's' : ''}{' '}
                          (${buyInTotal})
                          {chipsSold > 0 && (
                            <span className="text-emerald-400"> +${chipsSold} sold</span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Cash out result - shown on the right for cashed out players */}
                    {player.cashOut !== null && (
                      <div className="text-right space-y-1">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs text-gray-500">Cash Out</span>
                          <span className="font-medium text-gray-100 min-w-[3rem]">${player.cashOut}</span>
                        </div>
                        {chipsSold > 0 && (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-xs text-gray-500">Sold</span>
                            <span className="font-medium text-emerald-400 min-w-[3rem]">+${chipsSold}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs text-gray-500">Net</span>
                          <span
                            className={`font-medium min-w-[3rem] ${
                              netResult! >= 0 ? 'text-emerald-400' : 'text-red-400'
                            }`}
                          >
                            {netResult! >= 0 ? '+' : ''}${netResult}
                          </span>
                        </div>
                        {canEdit && isActive && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => undoCashOut(player.id)}
                            className="mt-2"
                          >
                            Undo
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Action buttons row - only shown for active players who haven't cashed out */}
                  {player.cashOut === null && canEdit && isActive && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => addBuyIn(player.id, player.user.name)}
                      >
                        Buy
                      </Button>
                      {session.players.filter(p => p.id !== player.id && p.cashOut === null).length > 0 && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openSellBuyIn(player)}
                        >
                          Sell
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="success"
                        onClick={() => openCashOut(player)}
                      >
                        Cash Out
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => removePlayer(player.id, player.user.name)}
                      >
                        Remove
                      </Button>
                    </div>
                  )}

                  {/* Playing status for non-editors */}
                  {player.cashOut === null && (!canEdit || !isActive) && (
                    <span className="text-sm text-gray-500">Playing</span>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Transactions Table */}
      {session.transactions && session.transactions.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-100 mb-4">Transactions</h2>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-400">Time</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-400">Player</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-400">Action</th>
                    <th className="text-right py-2 px-3 text-sm font-medium text-gray-400">Amount</th>
                    {canEdit && isActive && (
                      <th className="text-right py-2 px-3 text-sm font-medium text-gray-400"></th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {session.transactions.map((tx) => {
                    const getTypeLabel = () => {
                      switch (tx.type) {
                        case 'BUY_IN':
                          return 'Buy In'
                        case 'REMOVE_BUY_IN':
                          return 'Remove Buy-In'
                        case 'SELL_BUY_IN':
                          return `Sold to ${tx.targetPlayer?.name || 'Unknown'}`
                        case 'CASH_OUT':
                          return 'Cash Out'
                        default:
                          return tx.type
                      }
                    }

                    const getTypeStyle = () => {
                      switch (tx.type) {
                        case 'BUY_IN':
                          return 'bg-emerald-900/30 text-emerald-400'
                        case 'REMOVE_BUY_IN':
                          return 'bg-red-900/30 text-red-400'
                        case 'SELL_BUY_IN':
                          return 'bg-blue-900/30 text-blue-400'
                        case 'CASH_OUT':
                          return 'bg-amber-900/30 text-amber-400'
                        default:
                          return 'bg-gray-700 text-gray-300'
                      }
                    }

                    const getAmountDisplay = () => {
                      switch (tx.type) {
                        case 'BUY_IN':
                          return <span className="text-emerald-400">+${tx.amount}</span>
                        case 'REMOVE_BUY_IN':
                          return <span className="text-red-400">-${tx.amount}</span>
                        case 'SELL_BUY_IN':
                          return <span className="text-blue-400">${tx.amount}</span>
                        case 'CASH_OUT':
                          return <span className="text-amber-400">${tx.amount}</span>
                        default:
                          return `$${tx.amount}`
                      }
                    }

                    return (
                      <tr key={tx.id} className="border-b border-gray-700/50 last:border-0">
                        <td className="py-2 px-3 text-gray-400 text-sm">
                          {new Date(tx.createdAt).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-2 px-3 text-gray-100">{tx.player.name}</td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-1 rounded text-sm ${getTypeStyle()}`}>
                            {getTypeLabel()}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-medium">
                          {getAmountDisplay()}
                        </td>
                        {canEdit && isActive && (
                          <td className="py-2 px-3 text-right">
                            <button
                              onClick={() => undoTransaction(tx.id, tx.type, tx.player.name)}
                              className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                            >
                              Undo
                            </button>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Special Hands (Asterisks) Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
            <span className="text-amber-400 text-xl">*</span>
            Special Hands
          </h2>
          {canEdit && isActive && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setIsAddSpecialHandOpen(true)}
            >
              Record Hand
            </Button>
          )}
        </div>
        {session.specialHands && session.specialHands.length > 0 ? (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-400">Player</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-400">Hand</th>
                    <th className="text-left py-2 px-3 text-sm font-medium text-gray-400">Cards</th>
                    <th className="text-right py-2 px-3 text-sm font-medium text-gray-400">Time</th>
                    {canEdit && isActive && (
                      <th className="text-right py-2 px-3 text-sm font-medium text-gray-400"></th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {session.specialHands.map((hand) => (
                    <tr key={hand.id} className="border-b border-gray-700/50 last:border-0">
                      <td className="py-2 px-3 text-gray-100 flex items-center gap-2">
                        <span className="text-amber-400">*</span>
                        {hand.player.name}
                      </td>
                      <td className="py-2 px-3">
                        <span className="px-2 py-1 rounded bg-amber-900/30 text-amber-400 text-sm">
                          {SPECIAL_HAND_LABELS[hand.handType] || hand.handType}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-gray-300 text-sm">
                        {hand.cards || '-'}
                        {hand.description && (
                          <span className="text-gray-500 ml-2">({hand.description})</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right text-gray-400 text-sm">
                        {new Date(hand.createdAt).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </td>
                      {canEdit && isActive && (
                        <td className="py-2 px-3 text-right">
                          <button
                            onClick={() => deleteSpecialHand(hand.id)}
                            className="text-xs text-gray-500 hover:text-red-400"
                          >
                            Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <Card className="bg-gray-800/50 border-gray-700">
            <p className="text-center text-gray-500 text-sm py-4">
              No special hands recorded yet.
              {canEdit && isActive && ' Click "Record Hand" to add one.'}
            </p>
          </Card>
        )}
      </div>

      {/* Read-only indicator */}
      {!canEdit && isActive && (
        <Card className="bg-gray-800/50 border-gray-700">
          <p className="text-center text-gray-400 text-sm">
            👀 You&apos;re viewing this session. Only the host ({session.host.name}) or admins can make changes.
          </p>
        </Card>
      )}

      {/* Add Player Modal */}
      <Modal
        isOpen={isAddPlayerOpen}
        onClose={() => {
          setIsAddPlayerOpen(false)
          setSelectedPlayersToAdd([])
        }}
        title="Add Players"
      >
        {availableUsers.length === 0 ? (
          <p className="text-gray-400">All users are already in the session.</p>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-400">Select players to add to the session:</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {availableUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => togglePlayerSelection(u.id)}
                  disabled={isSubmitting}
                  className={`w-full p-3 rounded-lg text-left transition-colors disabled:opacity-50 flex items-center justify-between ${
                    selectedPlayersToAdd.includes(u.id)
                      ? 'bg-emerald-700/50 border border-emerald-500'
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  <p className="font-medium text-gray-100">{u.name}</p>
                  {selectedPlayersToAdd.includes(u.id) && (
                    <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
            {selectedPlayersToAdd.length > 0 && (
              <Button
                onClick={addSelectedPlayers}
                isLoading={isSubmitting}
                className="w-full"
              >
                Add {selectedPlayersToAdd.length} Player{selectedPlayersToAdd.length !== 1 ? 's' : ''}
              </Button>
            )}
          </div>
        )}
      </Modal>

      {/* Cash Out Modal */}
      <Modal
        isOpen={isCashOutOpen}
        onClose={() => setIsCashOutOpen(false)}
        title={`Cash Out - ${selectedPlayer?.user.name}`}
      >
        <div className="space-y-4">
          <p className="text-gray-400">
            Buy-ins: {selectedPlayer?.buyInCount} ($
            {(selectedPlayer?.buyInCount ?? 0) * BUY_IN_AMOUNT})
          </p>
          <Input
            type="number"
            label="Cash Out Amount ($)"
            value={cashOutAmount}
            onChange={(e) => setCashOutAmount(e.target.value)}
            placeholder="0"
            min="0"
            step="1"
          />
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setIsCashOutOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={recordCashOut}
              isLoading={isSubmitting}
              className="flex-1"
            >
              Confirm
            </Button>
          </div>
        </div>
      </Modal>

      {/* Sell Buy-In Modal */}
      <Modal
        isOpen={isSellBuyInOpen}
        onClose={() => {
          setIsSellBuyInOpen(false)
          setSelectedPlayer(null)
        }}
        title={`Sell Buy-In from ${selectedPlayer?.user.name}`}
      >
        <div className="space-y-4">
          <p className="text-gray-400">
            Select who is buying the $10 buy-in from {selectedPlayer?.user.name}:
          </p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {session.players
              .filter(p => p.id !== selectedPlayer?.id && p.cashOut === null)
              .map((buyer) => (
                <button
                  key={buyer.id}
                  onClick={() => sellBuyIn(buyer.userId, buyer.user.name)}
                  disabled={isSubmitting}
                  className="w-full p-3 rounded-lg bg-gray-700 hover:bg-gray-600 text-left transition-colors disabled:opacity-50"
                >
                  <p className="font-medium text-gray-100">{buyer.user.name}</p>
                  <p className="text-sm text-gray-400">
                    Currently: {buyer.buyInCount} buy-in{buyer.buyInCount !== 1 ? 's' : ''} (${buyer.buyInCount * BUY_IN_AMOUNT})
                  </p>
                </button>
              ))}
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              setIsSellBuyInOpen(false)
              setSelectedPlayer(null)
            }}
            className="w-full"
          >
            Cancel
          </Button>
        </div>
      </Modal>

      {/* Add Special Hand Modal */}
      <Modal
        isOpen={isAddSpecialHandOpen}
        onClose={() => {
          setIsAddSpecialHandOpen(false)
          setSpecialHandPlayerId('')
          setSpecialHandType('')
          setSpecialHandCards('')
          setSpecialHandDescription('')
        }}
        title="Record Special Hand"
      >
        <div className="space-y-4">
          <p className="text-gray-400 text-sm">
            Record a special hand (Royal Four of a Kind or above) to earn an asterisk (*).
          </p>

          {/* Player Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Player
            </label>
            <select
              value={specialHandPlayerId}
              onChange={(e) => setSpecialHandPlayerId(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Select player...</option>
              {session.players.map((p) => (
                <option key={p.userId} value={p.userId}>
                  {p.user.name}
                </option>
              ))}
            </select>
          </div>

          {/* Hand Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Hand Type
            </label>
            <select
              value={specialHandType}
              onChange={(e) => setSpecialHandType(e.target.value as SpecialHandType)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Select hand type...</option>
              {Object.entries(SPECIAL_HAND_TYPE)
                .sort((a, b) => HAND_STRENGTH[b[1]] - HAND_STRENGTH[a[1]])
                .map(([key, value]) => (
                  <option key={key} value={value}>
                    {SPECIAL_HAND_LABELS[value]}
                  </option>
                ))}
            </select>
          </div>

          {/* Cards Description */}
          <Input
            label="Cards (optional)"
            value={specialHandCards}
            onChange={(e) => setSpecialHandCards(e.target.value)}
            placeholder="e.g., AAAA with K kicker"
          />

          {/* Additional Description */}
          <Input
            label="Notes (optional)"
            value={specialHandDescription}
            onChange={(e) => setSpecialHandDescription(e.target.value)}
            placeholder="e.g., Won huge pot"
          />

          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setIsAddSpecialHandOpen(false)
                setSpecialHandPlayerId('')
                setSpecialHandType('')
                setSpecialHandCards('')
                setSpecialHandDescription('')
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={addSpecialHand}
              isLoading={isSubmitting}
              disabled={!specialHandPlayerId || !specialHandType}
              className="flex-1"
            >
              Record Hand
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Date Modal (Admin Only) */}
      <Modal
        isOpen={isEditDateOpen}
        onClose={() => setIsEditDateOpen(false)}
        title="Edit Session Date"
      >
        <div className="space-y-4">
          <p className="text-gray-400 text-sm">
            Change the date of this session. This will affect which year the session appears in for statistics.
          </p>
          <Input
            type="date"
            label="Session Date"
            value={editDateValue}
            onChange={(e) => setEditDateValue(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setIsEditDateOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={updateSessionDate}
              isLoading={isSubmitting}
              disabled={!editDateValue}
              className="flex-1"
            >
              Save
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Host Location Modal */}
      <Modal
        isOpen={isEditHostLocationOpen}
        onClose={() => setIsEditHostLocationOpen(false)}
        title="Edit Host Location"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Whose house are we playing at?
            </label>
            <select
              value={selectedHostLocationId}
              onChange={(e) => setSelectedHostLocationId(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">No location set</option>
              {allUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}&apos;s house
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setIsEditHostLocationOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={updateHostLocation}
              isLoading={isSubmitting}
              className="flex-1"
            >
              Save
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  )
}
