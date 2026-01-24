import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { PLAYER_TYPE } from '@/lib/constants'

const PIGGY_BANK_USER_ID = 'piggy-bank'

export async function GET() {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all piggy bank entries across all sessions
    const piggyBankEntries = await prisma.sessionPlayer.findMany({
      where: {
        userId: PIGGY_BANK_USER_ID,
      },
      select: {
        cashOut: true,
      },
    })

    // Sum up all contributions (stored in cashOut field)
    const total = piggyBankEntries.reduce((sum, entry) => sum + (entry.cashOut || 0), 0)

    return NextResponse.json({ total })
  } catch (error) {
    console.error('Get piggy bank error:', error)
    return NextResponse.json({ error: 'Failed to fetch piggy bank total' }, { status: 500 })
  }
}
