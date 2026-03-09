import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { canManageTeam } from '@/lib/permissions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface TeamDetailsPageProps {
  params: {
    id: string
  }
}

export default async function TeamDetailsPage({ params }: TeamDetailsPageProps) {
  const session = await requireUser()

  const membership = await prisma.teamMember.findFirst({
    where: {
      teamId: params.id,
      userId: session.user.id,
    },
    select: {
      teamId: true,
    },
  })

  if (!membership) {
    notFound()
  }

  const team = await prisma.team.findUnique({
    where: { id: params.id },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      _count: {
        select: {
          members: true,
        },
      },
    },
  })

  if (!team) {
    notFound()
  }

  const canManage = await canManageTeam(session.user.id, team.id)

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>{team.name}</CardTitle>
          <p className="text-sm text-muted-foreground">Team ID: {team.id}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Slug</p>
            <p className="text-sm font-medium">{team.slug}</p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Owner</p>
            <p className="text-sm font-medium">{team.owner?.name || 'Unknown Owner'}</p>
            <p className="text-xs text-muted-foreground">{team.owner?.email || 'No email available'}</p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Members</p>
            <p className="text-sm font-medium">{team._count.members}</p>
          </div>

          <div className="pt-2">
            {canManage ? (
              <Button asChild>
                <Link href="/dashboard/teams">Manage Team in Dashboard</Link>
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link href="/dashboard">Back to Dashboard</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
