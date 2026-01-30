import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { SESSION_STATUS, BUY_IN_AMOUNT, USER_ROLE } from '@/lib/constants'
import cuid from 'cuid'

export async function PATCH(
  request: NextRequest,
  context: { params: { id: string; playerId: string } }
) {
  try {
    const currentUser = await getCurrentUser()
    const { id: sessionId, playerId } = context.params

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
      return NextResponse.json({ error: 'Only the host or admin can modify players' }, { status: 403 })
    }

    if (session.status !== SESSION_STATUS.ACTIVE) {
      return NextResponse.json({ error: 'Session is not active' }, { status: 400 })
    }

    const sessionPlayer = await prisma.sessionPlayer.findUnique({
      where: { id: playerId },
    })

    if (!sessionPlayer || sessionPlayer.sessionId !== sessionId) {
      return NextResponse.json({ error: 'Player not found in session' }, { status: 404 })
    }

    const { action, cashOut, buyerId } = await request.json()

    if (action === 'buyIn') {
      const [updated] = await prisma.$transaction([
        prisma.sessionPlayer.update({
          where: { id: playerId },
          data: {
            buyInCount: sessionPlayer.buyInCount + 1,
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
            playerId: sessionPlayer.userId,
            type: 'BUY_IN',
            amount: BUY_IN_AMOUNT,
          },
        }),
      ])

      return NextResponse.json({ player: updated })
    }

    if (action === 'removeBuyIn') {
      if (sessionPlayer.buyInCount <= 0) {
        return NextResponse.json({ error: 'No buy-ins to remove' }, { status: 400 })
      }

      const [updated] = await prisma.$transaction([
        prisma.sessionPlayer.update({
          where: { id: playerId },
          data: {
            buyInCount: sessionPlayer.buyInCount - 1,
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
            playerId: sessionPlayer.userId,
            type: 'REMOVE_BUY_IN',
            amount: BUY_IN_AMOUNT,
          },
        }),
      ])

      return NextResponse.json({ player: updated })
    }

    if (action === 'cashOut') {
      if (typeof cashOut !== 'number' || cashOut < 0) {
        return NextResponse.json({ error: 'Valid cash-out amount required' }, { status: 400 })
      }

      const [updated] = await prisma.$transaction([
        prisma.sessionPlayer.update({
          where: { id: playerId },
          data: {
            cashOut,
            leftAt: new Date(),
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
            playerId: sessionPlayer.userId,
            type: 'CASH_OUT',
            amount: cashOut,
          },
        }),
      ])

      return NextResponse.json({ player: updated })
    }

    if (action === 'undoCashOut') {
      // Find and delete the most recent CASH_OUT transaction for this player
      const cashOutTransaction = await prisma.sessionTransaction.findFirst({
        where: {
          sessionId,
          playerId: sessionPlayer.userId,
          type: 'CASH_OUT',
        },
        orderBy: { createdAt: 'desc' },
      })

      const [updated] = await prisma.$transaction([
        prisma.sessionPlayer.update({
          where: { id: playerId },
          data: {
            cashOut: null,
            leftAt: null,
          },
          include: {
            user: {
              select: { id: true, name: true },
            },
          },
        }),
        // Delete the cash out transaction if it exists
        ...(cashOutTransaction
          ? [prisma.sessionTransaction.delete({ where: { id: cashOutTransaction.id } })]
          : []),
      ])

      return NextResponse.json({ player: updated })
    }

    if (action === 'sellBuyIn') {
      if (!buyerId) {
        return NextResponse.json({ error: 'Buyer ID required' }, { status: 400 })
      }

      // Find the buyer
      const buyerPlayer = await prisma.sessionPlayer.findFirst({
        where: {
          sessionId,
          userId: buyerId,
          cashOut: null, // Buyer must still be active
        },
      })

      if (!buyerPlayer) {
        return NextResponse.json({ error: 'Buyer not found or already cashed out' }, { status: 404 })
      }

      // Use a transaction to update both players and record the transfer
      const result = await prisma.$transaction(async (tx) => {
        // Update seller:
        // - If seller has yellow chips (buyInCount > 0): transfer chip to buyer (decrement buyInCount)
        // - If seller has no yellow chips: they get green chip (add to chipsSold) - this adds to pot
        const sellerUpdate = sessionPlayer.buyInCount > 0
          ? { buyInCount: sessionPlayer.buyInCount - 1 }
          : { chipsSold: (sessionPlayer.chipsSold || 0) + BUY_IN_AMOUNT }

        const updatedSeller = await tx.sessionPlayer.update({
          where: { id: playerId },
          data: sellerUpdate,
          include: {
            user: {
              select: { id: true, name: true },
            },
          },
        })

        // Add buy-in to buyer
        const updatedBuyer = await tx.sessionPlayer.update({
          where: { id: buyerPlayer.id },
          data: {
            buyInCount: buyerPlayer.buyInCount + 1,
          },
          include: {
            user: {
              select: { id: true, name: true },
            },
          },
        })

        // Record the transfer
        const transfer = await tx.buyInTransfer.create({
          data: {
            id: cuid(),
            sessionId,
            sellerId: sessionPlayer.userId,
            buyerId: buyerPlayer.userId,
            amount: BUY_IN_AMOUNT,
          },
          include: {
            seller: {
              select: { id: true, name: true },
            },
            buyer: {
              select: { id: true, name: true },
            },
          },
        })

        // Log the transaction
        await tx.sessionTransaction.create({
          data: {
            id: cuid(),
            sessionId,
            playerId: sessionPlayer.userId,
            type: 'SELL_BUY_IN',
            amount: BUY_IN_AMOUNT,
            targetPlayerId: buyerPlayer.userId,
          },
        })

        return { seller: updatedSeller, buyer: updatedBuyer, transfer }
      })

      return NextResponse.json(result)
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Update player error:', error)
    return NextResponse.json({ error: 'Failed to update player' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: { id: string; playerId: string } }
) {
  try {
    const currentUser = await getCurrentUser()
    const { id: sessionId, playerId } = context.params

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
      return NextResponse.json({ error: 'Only the host or admin can remove players' }, { status: 403 })
    }

    if (session.status !== SESSION_STATUS.ACTIVE) {
      return NextResponse.json({ error: 'Session is not active' }, { status: 400 })
    }

    const sessionPlayer = await prisma.sessionPlayer.findUnique({
      where: { id: playerId },
      include: { user: { select: { playerType: true } } },
    })

    if (!sessionPlayer || sessionPlayer.sessionId !== sessionId) {
      return NextResponse.json({ error: 'Player not found in session' }, { status: 404 })
    }

    if (sessionPlayer.cashOut !== null) {
      return NextResponse.json(
        { error: 'Cannot remove a player who has already cashed out' },
        { status: 400 }
      )
    }

    // Reverse piggy bank contribution if team player
    if (sessionPlayer.user.playerType === 'TEAM') {
      const piggyBankEntry = await prisma.sessionPlayer.findUnique({
        where: {
          sessionId_userId: {
            sessionId,
            userId: 'piggy-bank',
          },
        },
      })

      if (piggyBankEntry) {
        const newAmount = (piggyBankEntry.cashOut || 0) - 1
        if (newAmount <= 0) {
          await prisma.sessionPlayer.delete({ where: { id: piggyBankEntry.id } })
        } else {
          await prisma.sessionPlayer.update({
            where: { id: piggyBankEntry.id },
            data: { cashOut: newAmount },
          })
        }
      }
    }

    // Delete all transactions for this player in this session
    await prisma.sessionTransaction.deleteMany({
      where: {
        sessionId,
        playerId: sessionPlayer.userId,
      },
    })

    // Delete the session player record
    await prisma.sessionPlayer.delete({
      where: { id: playerId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Remove player error:', error)
    return NextResponse.json({ error: 'Failed to remove player' }, { status: 500 })
  }
}
