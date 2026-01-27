'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'

interface User {
  id: string
  email: string | null
  name: string
  role: 'ADMIN' | 'PLAYER'
  playerType: 'TEAM' | 'GUEST'
  isArchived: boolean
  isManaged: boolean
  createdAt: string
}

interface Invitation {
  id: string
  email: string
  name: string
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED'
  expiresAt: string
  createdAt: string
  invitedBy: { name: string }
}

export default function AdminPage() {
  const { user } = useAuth()
  const router = useRouter()

  const [users, setUsers] = useState<User[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState<'users' | 'archived' | 'invitations'>('users')
  const [showArchived, setShowArchived] = useState(false)
  const [isEditUserOpen, setIsEditUserOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [isAddGuestOpen, setIsAddGuestOpen] = useState(false)
  const [guestName, setGuestName] = useState('')
  const [guestEmail, setGuestEmail] = useState('')

  useEffect(() => {
    if (user?.role !== 'ADMIN') {
      router.push('/dashboard')
      return
    }
    fetchData()
  }, [user, router, showArchived])

  const fetchData = async () => {
    try {
      const [usersRes, invitationsRes] = await Promise.all([
        fetch('/api/users?includeArchived=true'),
        fetch('/api/invitations'),
      ])

      const usersData = await usersRes.json()
      const invitationsData = await invitationsRes.json()

      setUsers(usersData.users || [])
      setInvitations(invitationsData.invitations || [])
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const sendInvite = async () => {
    if (!inviteEmail || !inviteName) {
      alert('Please fill in all fields')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, name: inviteName }),
      })

      const data = await res.json()

      if (res.ok) {
        setInviteLink(data.inviteLink)
        await fetchData()
      } else {
        alert(data.error || 'Failed to send invitation')
      }
    } catch (error) {
      console.error('Failed to send invite:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const resendInvite = async (id: string) => {
    try {
      const res = await fetch(`/api/invitations/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resend' }),
      })

      const data = await res.json()

      if (res.ok) {
        alert(`New invite link: ${data.inviteLink}`)
        await fetchData()
      } else {
        alert(data.error || 'Failed to resend invitation')
      }
    } catch (error) {
      console.error('Failed to resend invite:', error)
    }
  }

  const deleteInvite = async (id: string) => {
    if (!confirm('Are you sure you want to delete this invitation?')) return

    try {
      const res = await fetch(`/api/invitations/${id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        await fetchData()
      }
    } catch (error) {
      console.error('Failed to delete invite:', error)
    }
  }

  const toggleUserRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'ADMIN' ? 'PLAYER' : 'ADMIN'

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })

      if (res.ok) {
        await fetchData()
      }
    } catch (error) {
      console.error('Failed to update user:', error)
    }
  }

  const togglePlayerType = async (userId: string, currentType: string) => {
    const newType = currentType === 'TEAM' ? 'GUEST' : 'TEAM'

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerType: newType }),
      })

      if (res.ok) {
        await fetchData()
      }
    } catch (error) {
      console.error('Failed to update player type:', error)
    }
  }

  const toggleArchive = async (userId: string, isCurrentlyArchived: boolean) => {
    const action = isCurrentlyArchived ? 'unarchive' : 'archive'
    if (!confirm(`Are you sure you want to ${action} this user?`)) return

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isArchived: !isCurrentlyArchived }),
      })

      if (res.ok) {
        await fetchData()
      }
    } catch (error) {
      console.error('Failed to update user:', error)
    }
  }

  const deactivateUser = async (userId: string) => {
    if (!confirm('Are you sure you want to deactivate this user?')) return

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        await fetchData()
      }
    } catch (error) {
      console.error('Failed to deactivate user:', error)
    }
  }

  const addGuestPlayer = async () => {
    if (!guestName.trim()) {
      alert('Please enter a name')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: guestName.trim(),
          email: guestEmail.trim() || undefined,
        }),
      })

      const data = await res.json()
      if (res.ok) {
        await fetchData()
        closeAddGuestModal()
      } else {
        alert(data.error || 'Failed to add guest player')
      }
    } catch (error) {
      console.error('Failed to add guest:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const closeAddGuestModal = () => {
    setIsAddGuestOpen(false)
    setGuestName('')
    setGuestEmail('')
  }

  const closeInviteModal = () => {
    setIsInviteOpen(false)
    setInviteEmail('')
    setInviteName('')
    setInviteLink('')
  }

  const openEditUser = (u: User) => {
    setEditingUser(u)
    setEditName(u.name)
    setEditEmail(u.email || '')
    setIsEditUserOpen(true)
  }

  const closeEditUserModal = () => {
    setIsEditUserOpen(false)
    setEditingUser(null)
    setEditName('')
    setEditEmail('')
  }

  const updateUserDetails = async () => {
    if (!editingUser || !editName.trim()) {
      alert('Please enter a name')
      return
    }
    if (!editingUser.isManaged && !editEmail.trim()) {
      alert('Please enter an email')
      return
    }

    setIsSubmitting(true)
    try {
      const body: Record<string, string> = { name: editName.trim() }
      if (editEmail.trim()) {
        body.email = editEmail.trim()
      }

      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (res.ok) {
        await fetchData()
        closeEditUserModal()
      } else {
        alert(data.error || 'Failed to update user')
      }
    } catch (error) {
      console.error('Failed to update user:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Filter users based on active tab
  const activeUsers = users.filter(u => !u.isArchived)
  const archivedUsers = users.filter(u => u.isArchived)
  const teamPlayers = activeUsers.filter(u => u.playerType === 'TEAM')
  const guestPlayers = activeUsers.filter(u => u.playerType === 'GUEST')

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500" />
      </div>
    )
  }

  if (user?.role !== 'ADMIN') {
    return null
  }

  const handleTabChange = (tab: 'users' | 'archived' | 'invitations') => {
    setActiveTab(tab)
    if (tab === 'archived') {
      setShowArchived(true)
    } else {
      setShowArchived(false)
    }
  }

  const renderUserCard = (u: User) => (
    <Card key={u.id}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-medium ${
            u.isArchived ? 'bg-gray-600' : u.playerType === 'GUEST' ? 'bg-amber-700' : 'bg-gray-700'
          }`}>
            {u.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className={`font-medium ${u.isArchived ? 'text-gray-500' : 'text-gray-100'}`}>
                {u.name}
              </p>
              {u.role === 'ADMIN' && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs">
                  Admin
                </span>
              )}
              {u.playerType === 'GUEST' && !u.isArchived && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs">
                  Guest
                </span>
              )}
              {u.playerType === 'TEAM' && !u.isArchived && (
                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-xs">
                  Team
                </span>
              )}
              {u.isArchived && (
                <span className="px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-400 text-xs">
                  Archived
                </span>
              )}
              {u.isManaged && (
                <span className="px-2 py-0.5 rounded-full bg-gray-600/30 text-gray-400 text-xs">
                  Managed
                </span>
              )}
              {u.id === user?.id && (
                <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-xs">
                  You
                </span>
              )}
            </div>
            <p className="text-sm text-gray-400">{u.email || 'No email'}</p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {!u.isArchived && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => openEditUser(u)}
            >
              Edit
            </Button>
          )}
          {u.id !== user?.id && (
            <>
              {!u.isArchived && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => togglePlayerType(u.id, u.playerType)}
                    title={`Change to ${u.playerType === 'TEAM' ? 'Guest' : 'Team'}`}
                  >
                    {u.playerType === 'TEAM' ? '→ Guest' : '→ Team'}
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => toggleUserRole(u.id, u.role)}
                  >
                    {u.role === 'ADMIN' ? '→ Player' : '→ Admin'}
                  </Button>
                </>
              )}
              <Button
                size="sm"
                variant={u.isArchived ? 'success' : 'ghost'}
                onClick={() => toggleArchive(u.id, u.isArchived)}
              >
                {u.isArchived ? 'Restore' : 'Archive'}
              </Button>
              {!u.isArchived && (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => deactivateUser(u.id)}
                >
                  Deactivate
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </Card>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-100">Admin Panel</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setIsAddGuestOpen(true)}>Add Guest</Button>
          <Button onClick={() => setIsInviteOpen(true)}>Invite New Player</Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-700 pb-2 overflow-x-auto">
        <button
          onClick={() => handleTabChange('users')}
          className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors whitespace-nowrap ${
            activeTab === 'users'
              ? 'bg-gray-800 text-emerald-400'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Active Users ({activeUsers.length})
        </button>
        <button
          onClick={() => handleTabChange('archived')}
          className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors whitespace-nowrap ${
            activeTab === 'archived'
              ? 'bg-gray-800 text-emerald-400'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Archived ({archivedUsers.length})
        </button>
        <button
          onClick={() => handleTabChange('invitations')}
          className={`px-4 py-2 rounded-t-lg text-sm font-medium transition-colors whitespace-nowrap ${
            activeTab === 'invitations'
              ? 'bg-gray-800 text-emerald-400'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          Invitations ({invitations.filter((i) => i.status === 'PENDING').length}{' '}
          pending)
        </button>
      </div>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {/* Team Players Section */}
          <div>
            <h2 className="text-lg font-semibold text-gray-100 mb-3 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500"></span>
              Team Players ({teamPlayers.length})
            </h2>
            <div className="space-y-3">
              {teamPlayers.length === 0 ? (
                <Card>
                  <p className="text-center text-gray-400 py-4">No team players</p>
                </Card>
              ) : (
                teamPlayers.map(renderUserCard)
              )}
            </div>
          </div>

          {/* Guest Players Section */}
          <div>
            <h2 className="text-lg font-semibold text-gray-100 mb-3 flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500"></span>
              Guest Players ({guestPlayers.length})
            </h2>
            <div className="space-y-3">
              {guestPlayers.length === 0 ? (
                <Card>
                  <p className="text-center text-gray-400 py-4">No guest players</p>
                </Card>
              ) : (
                guestPlayers.map(renderUserCard)
              )}
            </div>
          </div>
        </div>
      )}

      {/* Archived Tab */}
      {activeTab === 'archived' && (
        <div className="space-y-3">
          {archivedUsers.length === 0 ? (
            <Card>
              <p className="text-center text-gray-400 py-4">No archived users</p>
            </Card>
          ) : (
            archivedUsers.map(renderUserCard)
          )}
        </div>
      )}

      {/* Invitations Tab */}
      {activeTab === 'invitations' && (
        <div className="space-y-3">
          {invitations.length === 0 ? (
            <Card>
              <p className="text-center text-gray-400 py-4">
                No invitations sent yet
              </p>
            </Card>
          ) : (
            invitations.map((inv) => (
              <Card key={inv.id}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-100">{inv.name}</p>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs ${
                          inv.status === 'PENDING'
                            ? 'bg-amber-500/20 text-amber-400'
                            : inv.status === 'ACCEPTED'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400">{inv.email}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Invited by {inv.invitedBy.name} •{' '}
                      {new Date(inv.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  {inv.status === 'PENDING' && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => resendInvite(inv.id)}
                      >
                        Resend
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => deleteInvite(inv.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Invite Modal */}
      <Modal
        isOpen={isInviteOpen}
        onClose={closeInviteModal}
        title="Invite New Player"
      >
        {inviteLink ? (
          <div className="space-y-4">
            <p className="text-emerald-400">Invitation created!</p>
            <div className="p-3 bg-gray-900 rounded-lg border border-gray-700">
              <p className="text-xs text-gray-400 mb-1">Share this link:</p>
              <p className="text-sm text-gray-100 break-all">{inviteLink}</p>
            </div>
            <Button onClick={closeInviteModal} className="w-full">
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Input
              label="Name"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              placeholder="Player's name"
            />
            <Input
              type="email"
              label="Email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="player@example.com"
            />
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={closeInviteModal}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={sendInvite}
                isLoading={isSubmitting}
                className="flex-1"
              >
                Send Invite
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit User Modal */}
      <Modal
        isOpen={isEditUserOpen}
        onClose={closeEditUserModal}
        title="Edit User"
      >
        <div className="space-y-4">
          <Input
            label="Name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Player's name"
          />
          <Input
            type="email"
            label={editingUser?.isManaged ? 'Email (optional)' : 'Email'}
            value={editEmail}
            onChange={(e) => setEditEmail(e.target.value)}
            placeholder="player@example.com"
          />
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={closeEditUserModal}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={updateUserDetails}
              isLoading={isSubmitting}
              className="flex-1"
            >
              Save
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add Guest Modal */}
      <Modal
        isOpen={isAddGuestOpen}
        onClose={closeAddGuestModal}
        title="Add Guest Player"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-400">
            Create a guest player who can join sessions without signing up.
          </p>
          <Input
            label="Name"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            placeholder="Guest player's name"
          />
          <Input
            type="email"
            label="Email (optional)"
            value={guestEmail}
            onChange={(e) => setGuestEmail(e.target.value)}
            placeholder="Optional"
          />
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={closeAddGuestModal}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={addGuestPlayer}
              isLoading={isSubmitting}
              className="flex-1"
            >
              Add Guest
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
