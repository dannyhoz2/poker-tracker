import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { SESSION_STATUS, BUY_IN_AMOUNT } from '@/lib/constants'
import cuid from 'cuid'

const PIGGY_BANK_USER_ID = 'piggy-bank'

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const status = request.nextUrl.searchParams.get('status')
    const year = request.nextUrl.searchParams.get('year')
    const includeArchived = request.nextUrl.searchParams.get('includeArchived') === 'true'

    const where: Record<string, unknown> = {}

    if (!includeArchived) {
      where.isArchived = false
    }

    if (status) {
      where.status = status
    }

    if (year) {
      const yearNum = parseInt(year)
      where.date = {
        gte: new Date(yearNum, 0, 1),
        lt: new Date(yearNum + 1, 0, 1),
      }
    }

    const sessions = await prisma.session.findMany({
      where,
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
        },
      },
      orderBy: { date: 'desc' },
    })

    const sessionsWithTotals = sessions.map((session) => {
      // Filter out piggy bank from player list
      const filteredPlayers = session.players.filter(p => p.userId !== PIGGY_BANK_USER_ID)
      return {
        ...session,
        players: filteredPlayers,
        totalPot: filteredPlayers.reduce(
          (sum, p) => sum + p.buyInCount * BUY_IN_AMOUNT,
          0
        ),
        playerCount: filteredPlayers.length,
      }
    })

    return NextResponse.json({ sessions: sessionsWithTotals })
  } catch (error) {
    console.error('Get sessions error:', error)
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if there's already an active session
    const activeSession = await prisma.session.findFirst({
      where: { status: SESSION_STATUS.ACTIVE },
    })

    if (activeSession) {
      return NextResponse.json(
        { error: 'An active session already exists' },
        { status: 400 }
      )
    }

    const { notes } = await request.json().catch(() => ({}))

    const session = await prisma.session.create({
      data: {
        id: cuid(),
        hostId: currentUser.id,
        notes,
      },
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
        },
      },
    })

    return NextResponse.json({ session })
  } catch (error) {
    console.error('Create session error:', error)
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
  }
}
