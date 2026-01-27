import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { USER_ROLE, PLAYER_TYPE } from '@/lib/constants'
import cuid from 'cuid'

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
        isManaged: true,
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

export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (currentUser.role !== USER_ROLE.ADMIN) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { name, email } = await request.json()

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // If email provided, check uniqueness
    if (email && email.trim()) {
      const existing = await prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() },
      })
      if (existing) {
        return NextResponse.json({ error: 'Email already in use' }, { status: 400 })
      }
    }

    const user = await prisma.user.create({
      data: {
        id: cuid(),
        name: name.trim(),
        email: email && email.trim() ? email.toLowerCase().trim() : null,
        passwordHash: null,
        role: USER_ROLE.PLAYER,
        playerType: PLAYER_TYPE.GUEST,
        isManaged: true,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        playerType: true,
        isArchived: true,
        isManaged: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ user })
  } catch (error) {
    console.error('Create managed guest error:', error)
    return NextResponse.json({ error: 'Failed to create guest player' }, { status: 500 })
  }
}
