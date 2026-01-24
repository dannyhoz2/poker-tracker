import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { SESSION_STATUS, BUY_IN_AMOUNT } from '@/lib/constants'

export async function GET() {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const session = await prisma.session.findFirst({
      where: { status: SESSION_STATUS.ACTIVE },
      include: {
        host: {
          select: { id: true, name: true },
        },
        players: {
          include: {
            user: {
              select: { id: true, name: true },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
      },
    })

    if (!session) {
      return NextResponse.json({ session: null })
    }

    const totalPot = session.players.reduce(
      (sum, p) => sum + p.buyInCount * BUY_IN_AMOUNT,
      0
    )

    return NextResponse.json({
      session: {
        ...session,
        totalPot,
      },
    })
  } catch (error) {
    console.error('Get active session error:', error)
    return NextResponse.json({ error: 'Failed to fetch active session' }, { status: 500 })
  }
}
