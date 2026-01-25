import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { SESSION_STATUS, BUY_IN_AMOUNT, USER_ROLE, PLAYER_TYPE } from '@/lib/constants'

const PIGGY_BANK_USER_ID = 'piggy-bank'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    const { id } = await params

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const session = await prisma.session.findUnique({
      where: { id },
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
        transfers: {
          include: {
            seller: {
              select: { id: true, name: true },
            },
            buyer: {
              select: { id: true, name: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        specialHands: {
          include: {
            player: {
              select: { id: true, name: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    // Filter out piggy bank from player list
    const filteredPlayers = session.players.filter(p => p.userId !== PIGGY_BANK_USER_ID)

    // Get piggy bank contribution for this session
    const piggyBankEntry = session.players.find(p => p.userId === PIGGY_BANK_USER_ID)
    const piggyBankContribution = piggyBankEntry?.cashOut || 0

    const totalPot = filteredPlayers.reduce(
      (sum, p) => sum + p.buyInCount * BUY_IN_AMOUNT,
      0
    )

    return NextResponse.json({
      session: {
        ...session,
        players: filteredPlayers,
        totalPot,
        piggyBankContribution,
      },
    })
  } catch (error) {
    console.error('Get session error:', error)
    return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 })
  }
}

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

    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        players: true,
      },
    })

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const isHost = session.hostId === currentUser.id
    const isAdmin = currentUser.role === USER_ROLE.ADMIN

    const { action, notes, date, isArchived } = await request.json()

    // Admins can perform all session actions, hosts can only modify their own
    if (!isHost && !isAdmin) {
      return NextResponse.json({ error: 'Only the host or admin can modify this session' }, { status: 403 })
    }

    // Handle archive action
    if (action === 'archive' || typeof isArchived === 'boolean') {
      const updated = await prisma.session.update({
        where: { id },
        data: { isArchived: isArchived ?? true },
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

      return NextResponse.json({ session: updated })
    }

    // Handle reopen action - set session back to ACTIVE
    if (action === 'reopen') {
      if (session.status !== SESSION_STATUS.CLOSED) {
        return NextResponse.json({ error: 'Session is not closed' }, { status: 400 })
      }

      const updated = await prisma.session.update({
        where: { id },
        data: {
          status: SESSION_STATUS.ACTIVE,
          closedAt: null,
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

      return NextResponse.json({ session: updated })
    }

    if (action === 'close') {
      // Filter out piggy bank for validation
      const realPlayers = session.players.filter(p => p.userId !== PIGGY_BANK_USER_ID)

      // Get piggy bank contribution
      const piggyBankEntry = session.players.find(p => p.userId === PIGGY_BANK_USER_ID)
      const piggyBankContribution = piggyBankEntry?.cashOut || 0

      // Validate that all players have cashed out
      const totalBuyIns = realPlayers.reduce(
        (sum, p) => sum + p.buyInCount * BUY_IN_AMOUNT,
        0
      )
      const totalCashOuts = realPlayers.reduce(
        (sum, p) => sum + (p.cashOut || 0),
        0
      )
      // Include chipsSold (extra cash from selling chips when at 0 buy-ins)
      const totalChipsSold = realPlayers.reduce(
        (sum, p) => sum + (p.chipsSold || 0),
        0
      )
      const effectiveCashOuts = totalCashOuts + totalChipsSold

      // Distributable pot is total buy-ins minus piggy bank contribution
      const distributablePot = totalBuyIns - piggyBankContribution

      if (distributablePot !== effectiveCashOuts) {
        return NextResponse.json(
          {
            error: `Cannot close session: Distributable pot ($${distributablePot}) does not match cash-outs ($${effectiveCashOuts})`,
          },
          { status: 400 }
        )
      }

      const playersWithoutCashOut = realPlayers.filter(
        (p) => p.buyInCount > 0 && p.cashOut === null
      )

      if (playersWithoutCashOut.length > 0) {
        return NextResponse.json(
          { error: 'All players must cash out before closing' },
          { status: 400 }
        )
      }

      const updated = await prisma.session.update({
        where: { id },
        data: {
          status: SESSION_STATUS.CLOSED,
          closedAt: new Date(),
          totalPot: totalBuyIns,
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

      return NextResponse.json({ session: updated })
    }

    if (notes !== undefined) {
      const updated = await prisma.session.update({
        where: { id },
        data: { notes },
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

      return NextResponse.json({ session: updated })
    }

    // Handle date update (admin only)
    if (date !== undefined) {
      if (!isAdmin) {
        return NextResponse.json({ error: 'Only admins can change the session date' }, { status: 403 })
      }

      // Parse date as local date (YYYY-MM-DD) to avoid timezone issues
      // Adding T12:00:00 ensures the date stays correct regardless of timezone
      const newDate = new Date(`${date}T12:00:00`)
      if (isNaN(newDate.getTime())) {
        return NextResponse.json({ error: 'Invalid date format' }, { status: 400 })
      }

      const updated = await prisma.session.update({
        where: { id },
        data: { date: newDate },
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

      return NextResponse.json({ session: updated })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Update session error:', error)
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 })
  }
}
