import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { requireScreenPermission } from '@/lib/api-utils'
import { getResolvedUserTeamScope } from '@/lib/team-selection'

async function getTeamIdOrFail(session: any, request: NextRequest) {
  const { teamId } = await getResolvedUserTeamScope({
    userId: session.user.id,
    requestedTeamId: null,
    cookieTeamId: request.cookies.get('selectedTeamId')?.value?.trim(),
    sessionTeamId: session.user.teamId,
  })
  return teamId
}

function lastFour(key: string | undefined): string | null {
  return key && key.length >= 4 ? `...${key.slice(-4)}` : null
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const teamId = await getTeamIdOrFail(session, request)
  if (!teamId) return NextResponse.json({ message: 'Team not selected' }, { status: 400 })

  await requireScreenPermission(session, teamId, 'ADMIN_SETTINGS', 'READ')

  const openaiKey = process.env.OPENAI_API_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY

  return NextResponse.json({
    openai: {
      configured: Boolean(openaiKey),
      maskedKey: lastFour(openaiKey),
    },
    anthropic: {
      configured: Boolean(anthropicKey),
      maskedKey: lastFour(anthropicKey),
    },
    envOnly: true,
  })
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const teamId = await getTeamIdOrFail(session, request)
  if (!teamId) return NextResponse.json({ message: 'Team not selected' }, { status: 400 })

  await requireScreenPermission(session, teamId, 'ADMIN_SETTINGS', 'EDIT')

  // MVP: keys are read from environment — runtime saving is not supported.
  // Instruct the admin to set OPENAI_API_KEY / ANTHROPIC_API_KEY in the deployment environment.
  return NextResponse.json({
    ok: true,
    envOnly: true,
    message: 'Set OPENAI_API_KEY and ANTHROPIC_API_KEY in your deployment environment to configure AI credentials.',
  })
}
