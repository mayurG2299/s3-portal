import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canManageTeam } from '@/lib/permissions'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')?.toLowerCase()
    const teamId = searchParams.get('teamId')

    if (!email || !teamId) {
      return NextResponse.json({ error: 'Email and teamId are required' }, { status: 400 })
    }

    const hasAccess = await canManageTeam(session.user.id, teamId)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Only admins can look up users' }, { status: 403 })
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, deletedAt: true },
    })

    if (!user || user.deletedAt) {
      return NextResponse.json({ user: null, alreadyMember: false })
    }

    const existingMember = await prisma.teamMember.findFirst({
      where: { teamId, userId: user.id },
      select: { id: true },
    })

    return NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name },
      alreadyMember: Boolean(existingMember),
    })
  } catch (error) {
    console.error('User lookup error:', error)
    return NextResponse.json({ error: 'Failed to lookup user' }, { status: 500 })
  }
}
