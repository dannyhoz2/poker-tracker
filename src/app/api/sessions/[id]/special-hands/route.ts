import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { HAND_STRENGTH } from '@/lib/constants'
import cuid from 'cuid'

export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const currentUser = await getCurrentUser()
    const { id } = context.params

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const session = await prisma.session.findUnique({
      where: { id },
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const specialHands = await prisma.specialHand.findMany({
      where: { sessionId: id },
      include: {
        player: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json({ specialHands })
  } catch (error) {
    console.error('Get special hands error:', error)
    return NextResponse.json({ error: 'Failed to fetch special hands' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const currentUser = await getCurrentUser()
    const { id } = context.params

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const session = await prisma.session.findUnique({
      where: { id },
      include: { players: true },
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const { playerId, handType, cards, description } = await request.json()

    // Validate hand type
    if (!HAND_STRENGTH[handType]) {
      return NextResponse.json({ error: 'Invalid hand type' }, { status: 400 })
    }

    // Validate player is in the session
    const playerInSession = session.players.some(p => p.userId === playerId)
    if (!playerInSession) {
      return NextResponse.json({ error: 'Player is not in this session' }, { status: 400 })
    }

    const specialHand = await prisma.specialHand.create({
      data: {
        id: cuid(),
        sessionId: id,
        playerId,
        handType,
        cards: cards || '',
        description: description || null,
      },
      include: {
        player: {
          select: { id: true, name: true },
        },
      },
    })

    return NextResponse.json({ specialHand }, { status: 201 })
  } catch (error) {
    console.error('Create special hand error:', error)
    return NextResponse.json({ error: 'Failed to create special hand' }, { status: 500 })
  }
}
