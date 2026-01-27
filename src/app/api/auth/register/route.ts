import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import prisma from '@/lib/prisma'
import { hashPassword, generateToken } from '@/lib/auth'
import { INVITATION_STATUS } from '@/lib/constants'
import cuid from 'cuid'

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, inviteToken } = await request.json()

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Email, password, and name are required' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }

    // Check if this is the first user (will be admin)
    const userCount = await prisma.user.count()
    const isFirstUser = userCount === 0

    // If not first user, require valid invitation
    if (!isFirstUser) {
      if (!inviteToken) {
        return NextResponse.json(
          { error: 'Registration requires an invitation' },
          { status: 400 }
        )
      }

      const invitation = await prisma.invitation.findUnique({
        where: { token: inviteToken },
      })

      if (!invitation) {
        return NextResponse.json(
          { error: 'Invalid invitation token' },
          { status: 400 }
        )
      }

      if (invitation.status !== INVITATION_STATUS.PENDING) {
        return NextResponse.json(
          { error: 'Invitation has already been used or expired' },
          { status: 400 }
        )
      }

      if (new Date() > invitation.expiresAt) {
        await prisma.invitation.update({
          where: { id: invitation.id },
          data: { status: INVITATION_STATUS.EXPIRED },
        })
        return NextResponse.json(
          { error: 'Invitation has expired' },
          { status: 400 }
        )
      }

      if (invitation.email.toLowerCase() !== email.toLowerCase()) {
        return NextResponse.json(
          { error: 'Email does not match invitation' },
          { status: 400 }
        )
      }

      // Mark invitation as accepted
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: INVITATION_STATUS.ACCEPTED },
      })
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (existingUser) {
      // If it's a managed guest, upgrade them to a full account
      if (existingUser.isManaged) {
        const passwordHash = await hashPassword(password)
        const upgraded = await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            passwordHash,
            isManaged: false,
            name, // Update name if changed during registration
          },
        })

        const token = generateToken({
          userId: upgraded.id,
          email: upgraded.email!,
          role: upgraded.role,
        })

        const cookieStore = await cookies()
        cookieStore.set('auth-token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 7,
          path: '/',
        })

        return NextResponse.json({
          user: {
            id: upgraded.id,
            email: upgraded.email,
            name: upgraded.name,
            role: upgraded.role,
          },
        })
      }

      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 400 }
      )
    }

    const passwordHash = await hashPassword(password)

    const user = await prisma.user.create({
      data: {
        id: cuid(),
        email: email.toLowerCase(),
        name,
        passwordHash,
        role: isFirstUser ? 'ADMIN' : 'PLAYER',
      },
    })

    const token = generateToken({
      userId: user.id,
      email: user.email!,
      role: user.role,
    })

    const cookieStore = await cookies()
    cookieStore.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    })
  } catch (error) {
    console.error('Registration error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Registration failed: ${errorMessage}` },
      { status: 500 }
    )
  }
}
