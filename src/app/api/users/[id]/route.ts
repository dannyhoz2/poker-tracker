import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { USER_ROLE, PLAYER_TYPE } from '@/lib/constants'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    const { id } = await params

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (currentUser.role !== USER_ROLE.ADMIN) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { isActive, role, playerType, isArchived, name, email } = await request.json()

    // Prevent admin from deactivating themselves
    if (id === currentUser.id && isActive === false) {
      return NextResponse.json(
        { error: 'Cannot deactivate your own account' },
        { status: 400 }
      )
    }

    // Prevent admin from archiving themselves
    if (id === currentUser.id && isArchived === true) {
      return NextResponse.json(
        { error: 'Cannot archive your own account' },
        { status: 400 }
      )
    }

    // Check email uniqueness if email is being changed
    if (email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email: email.toLowerCase(),
          id: { not: id },
        },
      })
      if (existingUser) {
        return NextResponse.json(
          { error: 'Email is already in use by another user' },
          { status: 400 }
        )
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(typeof isActive === 'boolean' && { isActive }),
        ...(typeof isArchived === 'boolean' && { isArchived }),
        ...(role && { role }),
        ...(playerType && { playerType }),
        ...(name && { name: name.trim() }),
        ...(email && { email: email.toLowerCase().trim() }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        playerType: true,
        isActive: true,
        isArchived: true,
        isManaged: true,
      },
    })

    return NextResponse.json({ user })
  } catch (error) {
    console.error('Update user error:', error)
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    const { id } = await params

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (currentUser.role !== USER_ROLE.ADMIN) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    if (id === currentUser.id) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      )
    }

    // Soft delete - just deactivate
    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete user error:', error)
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
  }
}
