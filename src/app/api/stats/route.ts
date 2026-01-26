import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { SESSION_STATUS, BUY_IN_AMOUNT, PLAYER_TYPE, HAND_STRENGTH } from '@/lib/constants'
import type { PlayerStats, AsteriskStats, SpecialHandType } from '@/types'

const PIGGY_BANK_USER_ID = 'piggy-bank'

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const year = parseInt(
      request.nextUrl.searchParams.get('year') || new Date().getFullYear().toString()
    )

    const startDate = new Date(year, 0, 1)
    const endDate = new Date(year + 1, 0, 1)

    // Get all closed sessions for the year (excluding archived sessions)
    const sessions = await prisma.session.findMany({
      where: {
        status: SESSION_STATUS.CLOSED,
        isArchived: false,
        date: {
          gte: startDate,
          lt: endDate,
        },
      },
      include: {
        players: {
          include: {
            user: {
              select: { id: true, name: true },
            },
          },
        },
        transactions: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    // Get only TEAM players (exclude guests from statistics)
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        isArchived: false,
        playerType: PLAYER_TYPE.TEAM,
      },
      select: { id: true, name: true },
    })

    const totalSessions = sessions.length

    // Calculate stats for each user
    const playerStats: PlayerStats[] = users.map((user) => {
      const userSessions = sessions.filter((s) =>
        s.players.some((p) => p.userId === user.id)
      )

      let totalBuyIns = 0
      let totalCashOut = 0
      let wins = 0
      let biggestWin = 0
      let biggestLoss = 0

      userSessions.forEach((session) => {
        const playerData = session.players.find((p) => p.userId === user.id)
        if (playerData) {
          const buyInAmount = playerData.buyInCount * BUY_IN_AMOUNT
          const cashOutAmount = playerData.cashOut || 0
          const chipsSoldAmount = playerData.chipsSold || 0
          const netResult = cashOutAmount + chipsSoldAmount - buyInAmount

          totalBuyIns += buyInAmount
          totalCashOut += cashOutAmount + chipsSoldAmount

          if (netResult > 0) {
            wins++
            if (netResult > biggestWin) biggestWin = netResult
          } else if (netResult < 0) {
            if (netResult < biggestLoss) biggestLoss = netResult
          }
        }
      })

      const sessionsPlayed = userSessions.length
      const netGainLoss = totalCashOut - totalBuyIns
      const avgGainLoss = sessionsPlayed > 0 ? netGainLoss / sessionsPlayed : 0
      const winRate = sessionsPlayed > 0 ? (wins / sessionsPlayed) * 100 : 0
      const attendanceRate =
        totalSessions > 0 ? (sessionsPlayed / totalSessions) * 100 : 0

      return {
        userId: user.id,
        userName: user.name,
        totalBuyIns,
        totalCashOut,
        netGainLoss,
        sessionsPlayed,
        totalSessions,
        avgGainLoss: Math.round(avgGainLoss * 100) / 100,
        winRate: Math.round(winRate * 100) / 100,
        attendanceRate: Math.round(attendanceRate * 100) / 100,
        biggestWin,
        biggestLoss: Math.abs(biggestLoss),
      }
    })

    // Sort by net gain/loss (highest first)
    playerStats.sort((a, b) => b.netGainLoss - a.netGainLoss)

    // Session-by-session data for graphs
    const sessionData = sessions.map((session) => {
      // Calculate total pot (sum of all buy-ins)
      const totalPot = session.players
        .filter(p => p.userId !== PIGGY_BANK_USER_ID)
        .reduce((sum, p) => sum + (p.buyInCount * BUY_IN_AMOUNT) + (p.chipsSold || 0), 0)

      // Calculate session duration from first buy-in to last cash out
      const buyInTransactions = session.transactions.filter(t => t.type === 'BUY_IN')
      const cashOutTransactions = session.transactions.filter(t => t.type === 'CASH_OUT')

      let durationMinutes: number | null = null
      if (buyInTransactions.length > 0 && cashOutTransactions.length > 0) {
        const firstBuyIn = new Date(buyInTransactions[0].createdAt)
        const lastCashOut = new Date(cashOutTransactions[cashOutTransactions.length - 1].createdAt)
        durationMinutes = Math.round((lastCashOut.getTime() - firstBuyIn.getTime()) / (1000 * 60))
      }

      return {
        id: session.id,
        date: session.date,
        totalPot,
        durationMinutes,
        players: session.players.map((p) => ({
          userId: p.userId,
          userName: p.user?.name || 'Unknown',
          buyIns: p.buyInCount * BUY_IN_AMOUNT,
          cashOut: (p.cashOut || 0) + (p.chipsSold || 0),
          netResult: (p.cashOut || 0) + (p.chipsSold || 0) - p.buyInCount * BUY_IN_AMOUNT,
        })),
      }
    })

    // Calculate running totals for each player over time
    const cumulativeData: { date: string; [key: string]: number | string }[] = []
    const runningTotals: Record<string, number> = {}

    users.forEach((u) => {
      runningTotals[u.id] = 0
    })

    sessions
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .forEach((session) => {
        session.players.forEach((p) => {
          const netResult = (p.cashOut || 0) + (p.chipsSold || 0) - p.buyInCount * BUY_IN_AMOUNT
          runningTotals[p.userId] = (runningTotals[p.userId] || 0) + netResult
        })

        const dataPoint: { date: string; [key: string]: number | string } = {
          date: new Date(session.date).toLocaleDateString(),
        }

        users.forEach((u) => {
          dataPoint[u.name] = runningTotals[u.id]
        })

        cumulativeData.push(dataPoint)
      })

    // Get special hands for the year (asterisks) - excluding archived sessions
    const specialHands = await prisma.specialHand.findMany({
      where: {
        session: {
          status: SESSION_STATUS.CLOSED,
          isArchived: false,
          date: {
            gte: startDate,
            lt: endDate,
          },
        },
      },
      include: {
        player: {
          select: { id: true, name: true },
        },
        session: {
          select: { id: true, date: true },
        },
      },
    })

    // Calculate asterisk stats for each player
    const asteriskStatsMap: Record<string, {
      playerId: string
      playerName: string
      totalAsterisks: number
      hands: Record<string, { count: number; bestStrength: number }>
      strongestHandStrength: number
    }> = {}

    specialHands.forEach((hand) => {
      const playerId = hand.playerId
      const playerName = hand.player.name
      const handType = hand.handType as SpecialHandType
      const strength = HAND_STRENGTH[handType] || 0

      if (!asteriskStatsMap[playerId]) {
        asteriskStatsMap[playerId] = {
          playerId,
          playerName,
          totalAsterisks: 0,
          hands: {},
          strongestHandStrength: 0,
        }
      }

      asteriskStatsMap[playerId].totalAsterisks++

      if (!asteriskStatsMap[playerId].hands[handType]) {
        asteriskStatsMap[playerId].hands[handType] = { count: 0, bestStrength: strength }
      }
      asteriskStatsMap[playerId].hands[handType].count++

      if (strength > asteriskStatsMap[playerId].strongestHandStrength) {
        asteriskStatsMap[playerId].strongestHandStrength = strength
      }
    })

    // Convert to array and sort by: 1) total asterisks, 2) strongest hand strength
    const asteriskStats: AsteriskStats[] = Object.values(asteriskStatsMap)
      .map((stat) => {
        const handsArray = Object.entries(stat.hands).map(([handType, data]) => ({
          handType: handType as SpecialHandType,
          count: data.count,
          bestStrength: data.bestStrength,
        }))

        // Find strongest hand type
        let strongestHand: SpecialHandType = 'FOUR_OF_A_KIND_JACKS'
        handsArray.forEach((h) => {
          if (HAND_STRENGTH[h.handType] > HAND_STRENGTH[strongestHand]) {
            strongestHand = h.handType
          }
        })

        return {
          playerId: stat.playerId,
          playerName: stat.playerName,
          totalAsterisks: stat.totalAsterisks,
          hands: handsArray.sort((a, b) => HAND_STRENGTH[b.handType] - HAND_STRENGTH[a.handType]),
          strongestHand,
          strongestHandStrength: stat.strongestHandStrength,
        }
      })
      .sort((a, b) => {
        // First sort by total asterisks (descending)
        if (b.totalAsterisks !== a.totalAsterisks) {
          return b.totalAsterisks - a.totalAsterisks
        }
        // If tied, sort by strongest hand (descending)
        return b.strongestHandStrength - a.strongestHandStrength
      })

    // Get all special hands with session info for detailed view
    const specialHandsDetails = specialHands.map((hand) => ({
      id: hand.id,
      playerId: hand.playerId,
      playerName: hand.player.name,
      handType: hand.handType,
      cards: hand.cards,
      description: hand.description,
      sessionId: hand.sessionId,
      sessionDate: hand.session.date,
      createdAt: hand.createdAt,
    }))

    // Get piggy bank total for the year (from closed, non-archived sessions in that year)
    const piggyBankEntries = await prisma.sessionPlayer.findMany({
      where: {
        userId: PIGGY_BANK_USER_ID,
        session: {
          status: SESSION_STATUS.CLOSED,
          isArchived: false,
          date: {
            gte: startDate,
            lt: endDate,
          },
        },
      },
      select: {
        cashOut: true,
      },
    })

    const piggyBankTotal = piggyBankEntries.reduce((sum, entry) => sum + (entry.cashOut || 0), 0)

    // Get hosting stats - count sessions hosted at each player's location
    const sessionsWithLocation = await prisma.session.findMany({
      where: {
        status: SESSION_STATUS.CLOSED,
        isArchived: false,
        hostLocationId: { not: null },
        date: {
          gte: startDate,
          lt: endDate,
        },
      },
      include: {
        hostLocation: {
          select: { id: true, name: true },
        },
      },
    })

    // Aggregate hosting stats
    const hostingStatsMap: Record<string, { userId: string; userName: string; count: number }> = {}

    sessionsWithLocation.forEach((session) => {
      if (session.hostLocation) {
        const userId = session.hostLocation.id
        if (!hostingStatsMap[userId]) {
          hostingStatsMap[userId] = {
            userId,
            userName: session.hostLocation.name,
            count: 0,
          }
        }
        hostingStatsMap[userId].count++
      }
    })

    const hostingStats = Object.values(hostingStatsMap).sort((a, b) => b.count - a.count)

    return NextResponse.json({
      year,
      totalSessions,
      playerStats,
      sessionData,
      cumulativeData,
      asteriskStats,
      specialHandsDetails,
      piggyBankTotal,
      hostingStats,
    })
  } catch (error) {
    console.error('Get stats error:', error)
    return NextResponse.json({ error: 'Failed to fetch statistics' }, { status: 500 })
  }
}
