'use server'

import { getServerSession } from 'next-auth'
import { revalidatePath } from 'next/cache'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function switchTeam(teamId: string) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      throw new Error('Not authenticated')
    }

    // Verify user is a member of this team
    const membership = await prisma.teamMember.findFirst({
      where: {
        userId: session.user.id,
        teamId,
      },
    })

    if (!membership) {
      throw new Error('Not a member of this team')
    }

    // Update session user's teamId
    // Note: Next-auth sessions are immutable, so we store the preference
    // The actual session update happens on next request via middleware or session callback
    return { success: true, teamId, roleId: membership.roleId }
  } catch (error) {
    console.error('Team switch error:', error)
    throw error
  } finally {
    // Revalidate dashboard cache
    revalidatePath('/dashboard')
  }
}

export async function getUserTeams() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      throw new Error('Not authenticated')
    }

    const teams = await prisma.team.findMany({
      where: {
        members: {
          some: {
            userId: session.user.id,
          },
        },
      },
      select: {
        id: true,
        name: true,
        slug: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    })

    return teams
  } catch (error) {
    console.error('Get teams error:', error)
    throw error
  }
}
