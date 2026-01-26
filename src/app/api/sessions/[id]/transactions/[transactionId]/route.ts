import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { SESSION_STATUS, USER_ROLE, BUY_IN_AMOUNT } from '@/lib/constants'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; transactionId: string }> }
) {
  try {
    const currentUser = await getCurrentUser()
    const { id: sessionId, transactionId } = await params

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
      return NextResponse.json({ error: 'Only the host or admin can undo transactions' }, { status: 403 })
    }

    if (session.status !== SESSION_STATUS.ACTIVE) {
      return NextResponse.json({ error: 'Session is not active' }, { status: 400 })
    }

    // Find the transaction
    const transaction = await prisma.sessionTransaction.findUnique({
      where: { id: transactionId },
    })

    if (!transaction || transaction.sessionId !== sessionId) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
    }

    // Find the session player
    const sessionPlayer = await prisma.sessionPlayer.findFirst({
      where: {
        sessionId,
        userId: transaction.playerId,
      },
    })

    if (!sessionPlayer) {
      return NextResponse.json({ error: 'Player not found in session' }, { status: 404 })
    }

    // Handle different transaction types
    if (transaction.type === 'BUY_IN') {
      // Undo buy-in: decrement buyInCount
      if (sessionPlayer.buyInCount <= 0) {
        return NextResponse.json({ error: 'Cannot undo: player has no buy-ins' }, { status: 400 })
      }

      await prisma.$transaction([
        prisma.sessionPlayer.update({
          where: { id: sessionPlayer.id },
          data: { buyInCount: sessionPlayer.buyInCount - 1 },
        }),
        prisma.sessionTransaction.delete({
          where: { id: transactionId },
        }),
      ])
    } else if (transaction.type === 'REMOVE_BUY_IN') {
      // Undo remove buy-in: increment buyInCount
      await prisma.$transaction([
        prisma.sessionPlayer.update({
          where: { id: sessionPlayer.id },
          data: { buyInCount: sessionPlayer.buyInCount + 1 },
        }),
        prisma.sessionTransaction.delete({
          where: { id: transactionId },
        }),
      ])
    } else if (transaction.type === 'SELL_BUY_IN') {
      // Undo sell buy-in: reverse the transfer
      if (!transaction.targetPlayerId) {
        return NextResponse.json({ error: 'Invalid sell transaction' }, { status: 400 })
      }

      const buyerPlayer = await prisma.sessionPlayer.findFirst({
        where: {
          sessionId,
          userId: transaction.targetPlayerId,
        },
      })

      if (!buyerPlayer) {
        return NextResponse.json({ error: 'Buyer not found' }, { status: 404 })
      }

      // Check if buyer has chips to return
      if (buyerPlayer.buyInCount <= 0) {
        return NextResponse.json({ error: 'Cannot undo: buyer has no buy-ins to return' }, { status: 400 })
      }

      // Determine if seller originally had chips or got green chips (chipsSold)
      // If seller's chipsSold > 0 when they sold, we need to reduce chipsSold
      // Otherwise we add back to buyInCount
      const sellerUpdate = sessionPlayer.chipsSold > 0
        ? { chipsSold: sessionPlayer.chipsSold - BUY_IN_AMOUNT }
        : { buyInCount: sessionPlayer.buyInCount + 1 }

      await prisma.$transaction([
        // Return chip from seller (undo their gain)
        prisma.sessionPlayer.update({
          where: { id: sessionPlayer.id },
          data: sellerUpdate,
        }),
        // Remove chip from buyer
        prisma.sessionPlayer.update({
          where: { id: buyerPlayer.id },
          data: { buyInCount: buyerPlayer.buyInCount - 1 },
        }),
        // Delete the transaction
        prisma.sessionTransaction.delete({
          where: { id: transactionId },
        }),
        // Delete the corresponding buy-in transfer record
        prisma.buyInTransfer.deleteMany({
          where: {
            sessionId,
            sellerId: transaction.playerId,
            buyerId: transaction.targetPlayerId,
          },
        }),
      ])
    } else if (transaction.type === 'CASH_OUT') {
      // Undo cash out: clear cashOut
      await prisma.$transaction([
        prisma.sessionPlayer.update({
          where: { id: sessionPlayer.id },
          data: {
            cashOut: null,
            leftAt: null,
          },
        }),
        prisma.sessionTransaction.delete({
          where: { id: transactionId },
        }),
      ])
    } else {
      return NextResponse.json({ error: 'Unknown transaction type' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Undo transaction error:', error)
    return NextResponse.json({ error: 'Failed to undo transaction' }, { status: 500 })
  }
}
