import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { SESSION_STATUS, PLAYER_TYPE, PIGGY_BANK_CONTRIBUTION, USER_ROLE, BUY_IN_AMOUNT } from '@/lib/constants'
import cuid from 'cuid'

const PIGGY_BANK_USER_ID = 'piggy-bank'

export async function POST(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const currentUser = await getCurrentUser()
    const { id: sessionId } = context.params

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const isHost = session.hostId === currentUser.id
    const isAdmin = currentUser.role === USER_ROLE.ADMIN
    if (!isHost && !isAdmin) {
      return NextResponse.json({ error: 'Only the host or admin can add players' }, { status: 403 })
    }

    if (session.status !== SESSION_STATUS.ACTIVE) {
      return NextResponse.json({ error: 'Session is not active' }, { status: 400 })
    }

    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Check if player already in session
    const existingPlayer = await prisma.sessionPlayer.findUnique({
      where: {
        sessionId_userId: {
          sessionId,
          userId,
        },
      },
    })

    if (existingPlayer) {
      return NextResponse.json({ error: 'Player already in session' }, { status: 400 })
    }

    // Get the user to check their player type
    const userToAdd = await prisma.user.findUnique({
      where: { id: userId },
      select: { playerType: true },
    })

    if (!userToAdd) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // If team player, add contribution to piggy bank
    if (userToAdd.playerType === PLAYER_TYPE.TEAM) {
      // Check if piggy bank user exists, create if not
      let piggyBankUser = await prisma.user.findUnique({
        where: { id: PIGGY_BANK_USER_ID },
      })

      if (!piggyBankUser) {
        piggyBankUser = await prisma.user.create({
          data: {
            id: PIGGY_BANK_USER_ID,
            email: 'piggy-bank@system.local',
            name: 'Piggy Bank',
            passwordHash: 'SYSTEM_USER_NO_LOGIN',
            role: 'PLAYER',
            playerType: 'GUEST',
            isActive: false,
          },
        })
      }

      // Check if piggy bank is already in this session
      const piggyBankInSession = await prisma.sessionPlayer.findUnique({
        where: {
          sessionId_userId: {
            sessionId,
            userId: PIGGY_BANK_USER_ID,
          },
        },
      })

      if (piggyBankInSession) {
        // Add $1 to existing piggy bank entry
        await prisma.sessionPlayer.update({
          where: { id: piggyBankInSession.id },
          data: { cashOut: (piggyBankInSession.cashOut || 0) + PIGGY_BANK_CONTRIBUTION },
        })
      } else {
        // Create piggy bank entry for this session
        await prisma.sessionPlayer.create({
          data: {
            id: cuid(),
            sessionId,
            userId: PIGGY_BANK_USER_ID,
            buyInCount: 0,
            cashOut: PIGGY_BANK_CONTRIBUTION,
          },
        })
      }
    }

    // Create player and log initial buy-in transaction
    const [player] = await prisma.$transaction([
      prisma.sessionPlayer.create({
        data: {
          id: cuid(),
          sessionId,
          userId,
          buyInCount: 1, // Start with one buy-in
        },
        include: {
          user: {
            select: { id: true, name: true },
          },
        },
      }),
      prisma.sessionTransaction.create({
        data: {
          id: cuid(),
          sessionId,
          playerId: userId,
          type: 'BUY_IN',
          amount: BUY_IN_AMOUNT,
        },
      }),
    ])

    return NextResponse.json({ player })
  } catch (error) {
    console.error('Add player error:', error)
    return NextResponse.json({ error: 'Failed to add player' }, { status: 500 })
  }
}
