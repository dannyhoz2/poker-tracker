import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { INVITATION_STATUS } from '@/lib/constants'

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 })
    }

    const invitation = await prisma.invitation.findUnique({
      where: { token },
    })

    if (!invitation) {
      return NextResponse.json({ valid: false, error: 'Invalid invitation' })
    }

    if (invitation.status !== INVITATION_STATUS.PENDING) {
      return NextResponse.json({ valid: false, error: 'Invitation already used' })
    }

    if (new Date() > invitation.expiresAt) {
      return NextResponse.json({ valid: false, error: 'Invitation expired' })
    }

    return NextResponse.json({
      valid: true,
      invitation: {
        email: invitation.email,
        name: invitation.name,
      },
    })
  } catch (error) {
    console.error('Verify invitation error:', error)
    return NextResponse.json({ error: 'Failed to verify invitation' }, { status: 500 })
  }
}
