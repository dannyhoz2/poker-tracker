import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { SESSION_STATUS } from '@/lib/constants'

export async function GET() {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sessions = await prisma.session.findMany({
      where: { status: SESSION_STATUS.CLOSED, isArchived: false },
      select: { date: true },
      orderBy: { date: 'asc' },
    })

    const yearsSet = new Set(sessions.map((s) => new Date(s.date).getFullYear()))
    const years = Array.from(yearsSet)

    // Always include current year
    const currentYear = new Date().getFullYear()
    if (!years.includes(currentYear)) {
      years.push(currentYear)
    }

    years.sort((a, b) => b - a) // Most recent first

    return NextResponse.json({ years })
  } catch (error) {
    console.error('Get years error:', error)
    return NextResponse.json({ error: 'Failed to fetch years' }, { status: 500 })
  }
}
