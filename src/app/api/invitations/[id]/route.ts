import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser, generateInviteToken } from '@/lib/auth'
import { USER_ROLE, INVITATION_STATUS, INVITATION_EXPIRY_DAYS } from '@/lib/constants'

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

    await prisma.invitation.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete invitation error:', error)
    return NextResponse.json({ error: 'Failed to delete invitation' }, { status: 500 })
  }
}

export async function POST(
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

    const { action } = await request.json()

    if (action !== 'resend') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const invitation = await prisma.invitation.findUnique({
      where: { id },
    })

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
    }

    const token = generateInviteToken()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRY_DAYS)

    const updated = await prisma.invitation.update({
      where: { id },
      data: {
        token,
        expiresAt,
        status: INVITATION_STATUS.PENDING,
      },
      include: {
        invitedBy: {
          select: { name: true },
        },
      },
    })

    const host = request.headers.get('host') || 'localhost:3000'
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${protocol}://${host}`
    const inviteLink = `${baseUrl}/register?token=${token}`

    return NextResponse.json({
      invitation: updated,
      inviteLink,
    })
  } catch (error) {
    console.error('Resend invitation error:', error)
    return NextResponse.json({ error: 'Failed to resend invitation' }, { status: 500 })
  }
}
