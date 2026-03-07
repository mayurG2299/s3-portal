import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import fuzzysort from 'fuzzysort'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q')

    if (!query || query.trim().length < 1) {
      return NextResponse.json({ results: [] })
    }

    const activeTeamId = session.user.teamId
    const userId = session.user.id

    // Fetch data concurrently
    const [files, buckets, teams, members] = await Promise.all([
      // 1. Files
      prisma.file.findMany({
        where: activeTeamId ? { teamId: activeTeamId } : { userId },
        select: {
          id: true,
          name: true,
          key: true,
          tags: true,
          description: true,
          bucket: { select: { bucket: true } }
        },
        take: 100 // limit to avoid massive memory usage
      }),
      // 2. Buckets
      prisma.awsBucket.findMany({
        where: {
          credential: {
            teamId: activeTeamId || null,
            ...(activeTeamId
              ? { team: { members: { some: { userId } } } }
              : { userId }
            )
          }
        },
        select: { id: true, bucket: true, credential: { select: { name: true } } },
        take: 50
      }),
      // 3. Teams
      prisma.team.findMany({
        where: {
          members: { some: { userId } }
        },
        select: { id: true, name: true, slug: true },
        take: 20
      }),
      // 4. Team Members
      prisma.teamMember.findMany({
        where: activeTeamId ? { teamId: activeTeamId } : { userId },
        select: {
          id: true,
          user: { select: { name: true, email: true } },
          role: { select: { name: true, description: true } }
        },
        take: 50
      })
    ])

    // Flatten into a single searchable dataset
    const dataset = [
      ...files.map(f => ({
        type: 'file',
        id: f.id,
        title: f.name,
        subtitle: f.bucket?.bucket || 'Unknown Bucket',
        tags: f.tags,
        description: f.description,
        url: '/dashboard/files' // Ideally we would format the currentPath to auto-open the folder
      })),
      ...buckets.map(b => ({
        type: 'bucket',
        id: b.id,
        title: b.bucket,
        subtitle: b.credential?.name || 'AWS Config',
        tags: [],
        description: null,
        url: '/dashboard/settings'
      })),
      ...teams.map(t => ({
        type: 'team',
        id: t.id,
        title: t.name,
        subtitle: t.slug,
        tags: [],
        description: null,
        url: '/dashboard/teams'
      })),
      ...members.map(m => ({
        type: 'member',
        id: m.id,
        title: m.user.name || m.user.email,
        subtitle: m.role.name,
        tags: [],
        description: m.role.description,
        url: '/dashboard/teams'
      }))
    ]

    // Sort using fuzzysort
    // We create a single searchable string for each item combining relevant fields for fuzzy matching
    const searchTargets = dataset.map(item => ({
      ...item,
      searchStr: [item.title, item.subtitle, ...(item.tags || []), item.description]
        .filter(Boolean)
        .join(' ')
    }))

    const results = fuzzysort.go(query, searchTargets, {
      key: 'searchStr',
      limit: 15,
      threshold: -10000 // Adjust as needed
    })

    const formattedResults = results.map(res => res.obj)

    return NextResponse.json({ results: formattedResults })

  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 })
  }
}
