import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { USER_ROLE } from '@/lib/constants'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; handId: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    const { id, handId } = await params

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const session = await prisma.session.findUnique({
      where: { id },
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const specialHand = await prisma.specialHand.findUnique({
      where: { id: handId },
    })

    if (!specialHand) {
      return NextResponse.json({ error: 'Special hand not found' }, { status: 404 })
    }

    if (specialHand.sessionId !== id) {
      return NextResponse.json({ error: 'Special hand does not belong to this session' }, { status: 400 })
    }

    // Only host or admin can delete
    const isHost = session.hostId === currentUser.id
    const isAdmin = currentUser.role === USER_ROLE.ADMIN

    if (!isHost && !isAdmin) {
      return NextResponse.json({ error: 'Only the host or admin can delete special hands' }, { status: 403 })
    }

    await prisma.specialHand.delete({
      where: { id: handId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete special hand error:', error)
    return NextResponse.json({ error: 'Failed to delete special hand' }, { status: 500 })
  }
}
