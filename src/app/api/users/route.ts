import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { USER_ROLE, PLAYER_TYPE } from '@/lib/constants'

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const includeArchived = request.nextUrl.searchParams.get('includeArchived') === 'true'

    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        playerType: { not: PLAYER_TYPE.PIGGY_BANK }, // Exclude piggy bank from user lists
        ...(includeArchived ? {} : { isArchived: false }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        playerType: true,
        isArchived: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({ users })
  } catch (error) {
    console.error('Get users error:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}
