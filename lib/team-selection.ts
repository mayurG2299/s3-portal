import { prisma } from '@/lib/db'
import { resolveActiveTeamId } from '@/lib/active-team'

export type AccessibleTeam = {
  id: string
  name: string
  slug: string
}

type ResolveUserTeamScopeParams = {
  userId: string
  requestedTeamId?: string | null
  cookieTeamId?: string | null
  sessionTeamId?: string | null
}

export async function getResolvedUserTeamScope({
  userId,
  requestedTeamId,
  cookieTeamId,
  sessionTeamId,
}: ResolveUserTeamScopeParams): Promise<{ teams: AccessibleTeam[]; teamId: string | null }> {
  const teams = await prisma.team.findMany({
    where: {
      members: {
        some: {
          userId,
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

  const teamId =
    (requestedTeamId && teams.some((team) => team.id === requestedTeamId) ? requestedTeamId : null) ||
    resolveActiveTeamId(teams, cookieTeamId, sessionTeamId)

  return { teams, teamId }
}
