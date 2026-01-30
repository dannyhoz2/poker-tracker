import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { SESSION_STATUS, BUY_IN_AMOUNT, PLAYER_TYPE, HAND_STRENGTH } from '@/lib/constants'
import type { PlayerStats, AsteriskStats, SpecialHandType } from '@/types'

const PIGGY_BANK_USER_ID = 'piggy-bank'
const BURST_WINDOW_MS = 15 * 60 * 1000 // 15 minutes in milliseconds

interface SessionWithData {
  id: string
  date: Date
  players: Array<{
    userId: string
    user: { id: string; name: string }
    buyInCount: number
    cashOut: number | null
    chipsSold: number
  }>
  transactions: Array<{
    id: string
    type: string
    playerId: string
    targetPlayerId: string | null
    amount: number
    createdAt: Date
  }>
}

function computeBuyInTimingAnalytics(sessions: SessionWithData[], teamUserIds: Set<string>) {
  // Per-player accumulators
  const playerData: Record<string, {
    name: string
    earlyReBuys: number
    lateReBuys: number
    totalReBuys: number
    velocitySessions: { reBuys: number; hours: number }[]
    timeToFirstReBuyMinutes: number[]
    sessionsPlayed: number
    sessionsWithReBuy: number
    burstReBuys: number
    burstEvents: number
    quarterCounts: { q1: number; q2: number; q3: number; q4: number }[]
    sellTimings: number[]
    buyFromOthersTimings: number[]
    lateNightIndices: number[]
  }> = {}

  const initPlayer = (userId: string, name: string) => {
    if (!playerData[userId]) {
      playerData[userId] = {
        name,
        earlyReBuys: 0,
        lateReBuys: 0,
        totalReBuys: 0,
        velocitySessions: [],
        timeToFirstReBuyMinutes: [],
        sessionsPlayed: 0,
        sessionsWithReBuy: 0,
        quarterCounts: [],
        burstReBuys: 0,
        burstEvents: 0,
        sellTimings: [],
        buyFromOthersTimings: [],
        lateNightIndices: [],
      }
    }
  }

  for (const session of sessions) {
    const txs = session.transactions
    const buyInTxs = txs.filter(t => t.type === 'BUY_IN')
    const cashOutTxs = txs.filter(t => t.type === 'CASH_OUT')
    const sellTxs = txs.filter(t => t.type === 'SELL_BUY_IN')

    if (buyInTxs.length === 0 || cashOutTxs.length === 0) continue

    const sessionStart = new Date(buyInTxs[0].createdAt).getTime()
    const sessionEnd = new Date(cashOutTxs[cashOutTxs.length - 1].createdAt).getTime()
    const sessionDuration = sessionEnd - sessionStart
    if (sessionDuration <= 0) continue

    const sessionMidpoint = sessionStart + sessionDuration / 2
    const q1End = sessionStart + sessionDuration * 0.25
    const q2End = sessionStart + sessionDuration * 0.5
    const q3End = sessionStart + sessionDuration * 0.75
    const lastQuarterStart = q3End

    // Group buy-in transactions by player
    const playerBuyIns: Record<string, Date[]> = {}
    for (const tx of buyInTxs) {
      if (!teamUserIds.has(tx.playerId)) continue
      if (!playerBuyIns[tx.playerId]) playerBuyIns[tx.playerId] = []
      playerBuyIns[tx.playerId].push(new Date(tx.createdAt))
    }

    // Process each player in this session
    for (const [playerId, buyIns] of Object.entries(playerBuyIns)) {
      const playerInSession = session.players.find(p => p.userId === playerId)
      if (!playerInSession) continue

      const playerName = playerInSession.user?.name || 'Unknown'
      initPlayer(playerId, playerName)
      const pd = playerData[playerId]
      pd.sessionsPlayed++

      // Re-buys = all buy-ins after the first
      const reBuys = buyIns.slice(1)
      const reBuyCount = reBuys.length

      if (reBuyCount > 0) {
        pd.sessionsWithReBuy++
        pd.totalReBuys += reBuyCount

        // Analytic 1: Early vs Late
        for (const rb of reBuys) {
          if (rb.getTime() < sessionMidpoint) {
            pd.earlyReBuys++
          } else {
            pd.lateReBuys++
          }
        }

        // Analytic 2: Velocity
        const playerCashOut = cashOutTxs.find(t => t.playerId === playerId)
        const playerEnd = playerCashOut ? new Date(playerCashOut.createdAt).getTime() : sessionEnd
        const playerStart = buyIns[0].getTime()
        const playTimeHours = (playerEnd - playerStart) / (1000 * 60 * 60)
        if (playTimeHours >= 0.5) {
          pd.velocitySessions.push({ reBuys: reBuyCount, hours: playTimeHours })
        }

        // Analytic 3: Time to first re-buy
        const minutesToFirst = (reBuys[0].getTime() - buyIns[0].getTime()) / (1000 * 60)
        pd.timeToFirstReBuyMinutes.push(minutesToFirst)

        // Analytic 4: Tilt/Burst detection
        let inBurst = false
        for (let i = 1; i < reBuys.length; i++) {
          const gap = reBuys[i].getTime() - reBuys[i - 1].getTime()
          if (gap <= BURST_WINDOW_MS) {
            if (!inBurst) {
              // Start of a new burst — count the previous re-buy too
              pd.burstReBuys++
              pd.burstEvents++
              inBurst = true
            }
            pd.burstReBuys++
          } else {
            inBurst = false
          }
        }

        // Analytic 7: Late Night Spending Index
        const lastQuarterReBuys = reBuys.filter(rb => rb.getTime() >= lastQuarterStart).length
        const durationHours = sessionDuration / (1000 * 60 * 60)
        const overallRate = reBuyCount / durationHours
        if (overallRate > 0 && durationHours >= 1) {
          const lateRate = lastQuarterReBuys / (0.25 * durationHours)
          pd.lateNightIndices.push(lateRate / overallRate)
        }
      }

      // Analytic 5: Quarter heatmap (all buy-ins, including initial)
      const qc = { q1: 0, q2: 0, q3: 0, q4: 0 }
      for (const bi of buyIns) {
        const t = bi.getTime()
        if (t < q1End) qc.q1++
        else if (t < q2End) qc.q2++
        else if (t < q3End) qc.q3++
        else qc.q4++
      }
      pd.quarterCounts.push(qc)
    }

    // Analytic 6: Sell timing patterns
    for (const sell of sellTxs) {
      const sellTime = new Date(sell.createdAt).getTime()
      const elapsed = ((sellTime - sessionStart) / sessionDuration) * 100

      // Seller
      if (teamUserIds.has(sell.playerId)) {
        const sellerPlayer = session.players.find(p => p.userId === sell.playerId)
        if (sellerPlayer) {
          initPlayer(sell.playerId, sellerPlayer.user?.name || 'Unknown')
          playerData[sell.playerId].sellTimings.push(elapsed)
        }
      }

      // Buyer
      if (sell.targetPlayerId && teamUserIds.has(sell.targetPlayerId)) {
        const buyerPlayer = session.players.find(p => p.userId === sell.targetPlayerId)
        if (buyerPlayer) {
          initPlayer(sell.targetPlayerId, buyerPlayer.user?.name || 'Unknown')
          playerData[sell.targetPlayerId].buyFromOthersTimings.push(elapsed)
        }
      }
    }
  }

  // Aggregate results
  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0

  const allPlayers = Object.entries(playerData)

  // Analytic 1: Timing profiles (min 3 re-buys)
  const timingProfiles = allPlayers
    .filter(([, d]) => d.totalReBuys >= 3)
    .map(([, d]) => ({
      name: d.name,
      earlyPct: Math.round((d.earlyReBuys / d.totalReBuys) * 100),
      latePct: Math.round((d.lateReBuys / d.totalReBuys) * 100),
      earlyReBuys: d.earlyReBuys,
      lateReBuys: d.lateReBuys,
      totalReBuys: d.totalReBuys,
    }))
    .sort((a, b) => b.latePct - a.latePct)

  // Analytic 2: Re-buy velocity (min 2 sessions, min 1 re-buy)
  const reBuyVelocity = allPlayers
    .filter(([, d]) => d.velocitySessions.length >= 2 && d.totalReBuys >= 1)
    .map(([, d]) => {
      const avgVel = avg(d.velocitySessions.map(s => s.reBuys / s.hours))
      return {
        name: d.name,
        velocity: Math.round(avgVel * 100) / 100,
        totalReBuys: d.totalReBuys,
        totalHours: Math.round(d.velocitySessions.reduce((s, v) => s + v.hours, 0) * 10) / 10,
      }
    })
    .sort((a, b) => b.velocity - a.velocity)

  // Analytic 3: Time to first re-buy (min 2 sessions with re-buy)
  const timeToFirstRebuy = allPlayers
    .filter(([, d]) => d.timeToFirstReBuyMinutes.length >= 2)
    .map(([, d]) => ({
      name: d.name,
      avgMinutes: Math.round(avg(d.timeToFirstReBuyMinutes)),
      sessionsWithReBuy: d.sessionsWithReBuy,
      sessionsWithoutReBuy: d.sessionsPlayed - d.sessionsWithReBuy,
      survivalRate: Math.round(((d.sessionsPlayed - d.sessionsWithReBuy) / d.sessionsPlayed) * 100),
    }))
    .sort((a, b) => b.avgMinutes - a.avgMinutes)

  // Analytic 4: Tilt scores (min 4 re-buys)
  const tiltScores = allPlayers
    .filter(([, d]) => d.totalReBuys >= 4)
    .map(([, d]) => ({
      name: d.name,
      tiltRate: Math.round((d.burstReBuys / d.totalReBuys) * 100),
      burstEvents: d.burstEvents,
      burstReBuys: d.burstReBuys,
      totalReBuys: d.totalReBuys,
    }))
    .sort((a, b) => b.tiltRate - a.tiltRate)

  // Analytic 5: Heatmap (min 3 sessions)
  const buyInHeatmap = allPlayers
    .filter(([, d]) => d.quarterCounts.length >= 3)
    .map(([, d]) => ({
      name: d.name,
      q1Avg: Math.round(avg(d.quarterCounts.map(q => q.q1)) * 10) / 10,
      q2Avg: Math.round(avg(d.quarterCounts.map(q => q.q2)) * 10) / 10,
      q3Avg: Math.round(avg(d.quarterCounts.map(q => q.q3)) * 10) / 10,
      q4Avg: Math.round(avg(d.quarterCounts.map(q => q.q4)) * 10) / 10,
      sessions: d.quarterCounts.length,
    }))

  // Analytic 6: Sell timing patterns (min 2 sells or buys)
  const sellTimingPatterns = allPlayers
    .filter(([, d]) => d.sellTimings.length >= 2 || d.buyFromOthersTimings.length >= 2)
    .map(([, d]) => ({
      name: d.name,
      avgSellPct: d.sellTimings.length > 0 ? Math.round(avg(d.sellTimings)) : null,
      totalSells: d.sellTimings.length,
      avgBuyFromOthersPct: d.buyFromOthersTimings.length > 0 ? Math.round(avg(d.buyFromOthersTimings)) : null,
      totalBuysFromOthers: d.buyFromOthersTimings.length,
    }))

  // Analytic 7: Late night spending index (min 3 sessions with re-buys)
  const lateNightSpending = allPlayers
    .filter(([, d]) => d.lateNightIndices.length >= 3)
    .map(([, d]) => ({
      name: d.name,
      index: Math.round(avg(d.lateNightIndices) * 100) / 100,
      sessionsAnalyzed: d.lateNightIndices.length,
    }))
    .sort((a, b) => b.index - a.index)

  return {
    timingProfiles,
    reBuyVelocity,
    timeToFirstRebuy,
    tiltScores,
    buyInHeatmap,
    sellTimingPatterns,
    lateNightSpending,
  }
}

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

    // Compute buy-in timing analytics
    const teamUserIds = new Set(users.map(u => u.id))
    const buyInTimingAnalytics = computeBuyInTimingAnalytics(sessions as unknown as SessionWithData[], teamUserIds)

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
      buyInTimingAnalytics,
    })
  } catch (error) {
    console.error('Get stats error:', error)
    return NextResponse.json({ error: 'Failed to fetch statistics' }, { status: 500 })
  }
}
