import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { embedText } from '@/lib/indexing/embed'
import { getAccessibleBucketIds } from '@/lib/bucket-access'
import { allowRequest } from '@/lib/rate-limiter'
import { getResolvedUserTeamScope } from '@/lib/team-selection'

export const dynamic = 'force-dynamic'

interface SearchRow {
  id: string
  name: string
  key: string
  contentType: string | null
  parentPath: string
  score: number
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })

  const { searchParams } = request.nextUrl
  const q = searchParams.get('q')
  if (!q) return NextResponse.json({ message: 'q is required' }, { status: 400 })

  const allowed = await allowRequest(`ai-search:${session.user.id}`, 120, 60)
  if (!allowed) {
    return NextResponse.json({ message: 'Rate limit exceeded' }, { status: 429, headers: { 'Retry-After': '60' } })
  }

  const { teamId } = await getResolvedUserTeamScope({
    userId: session.user.id,
    requestedTeamId: searchParams.get('teamId'),
    cookieTeamId: request.cookies.get('selectedTeamId')?.value?.trim(),
    sessionTeamId: (session.user as any).teamId,
  })

  if (!teamId) return NextResponse.json({ message: 'Team not selected' }, { status: 400 })

  // getAccessibleBucketIds returns string[] | null — null means unrestricted admin (no filter)
  const allowedBucketIds = searchParams.get('bucketId')
    ? [searchParams.get('bucketId')!]
    : await getAccessibleBucketIds(session.user.id, teamId)

  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50)

  const embedding = await embedText(q)
  // embedding is number[] from OpenAI — all floats, no SQL injection risk
  const vectorStr = `[${embedding.join(',')}]`

  // When allowedBucketIds is null the user is an unrestricted admin — no bucket filter needed
  const bucketClause = allowedBucketIds === null
    ? Prisma.sql`1=1`
    : Prisma.sql`f."bucketId" = ANY(${allowedBucketIds})`

  const rows = await prisma.$queryRaw<SearchRow[]>(
    Prisma.sql`
      SELECT f.id, f.name, f.key, f."contentType", f."parentPath",
             1 - (fe.embedding <=> ${Prisma.raw(`'${vectorStr}'::vector`)}) AS score
      FROM "File" f
      JOIN "FileEmbedding" fe ON fe."fileId" = f.id
      WHERE fe.status = 'DONE'
        AND fe.embedding IS NOT NULL
        AND ${bucketClause}
      ORDER BY fe.embedding <=> ${Prisma.raw(`'${vectorStr}'::vector`)}
      LIMIT ${limit}
    `
  )

  return NextResponse.json({
    results: rows.map((r) => ({ ...r, semanticScore: Number(r.score) })),
  })
}
