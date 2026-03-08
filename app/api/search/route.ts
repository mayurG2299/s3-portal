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
    const teamId = searchParams.get('teamId') || session.user.teamId
    const identityId = searchParams.get('identityId') || undefined
    const bucketId = searchParams.get('bucketId') || undefined

    if (!query || query.trim().length < 1) {
      return NextResponse.json({ results: [] })
    }


    const userId = session.user.id
    const dbQuery = { contains: query, mode: 'insensitive' as const }

    // Fetch data concurrently with database-side filtering
    const [files, buckets, teams, members] = await Promise.all([
      // 1. Files - scoped and searched by name, tags, or description
      prisma.file.findMany({
        where: {
          // File must either match the teamId exactly, or have no teamId but belong to a bucket/credential that does
          OR: [
            { teamId: teamId || null },
            { 
              teamId: null,
              bucket: {
                credential: {
                  teamId: teamId || null
                }
              }
            }
          ],
          ...(bucketId ? { bucketId } : {}),
          ...(identityId ? { credentialId: identityId } : {}),
          AND: [
            {
              OR: [
                { name: dbQuery },
                { tags: { has: query.toLowerCase().trim() } },
                { description: dbQuery }
              ]
            }
          ]
        },
        select: {
          id: true,
          name: true,
          key: true,
          tags: true,
          description: true,
          teamId: true,
          credentialId: true,
          bucketId: true,
          bucket: { select: { bucket: true } }
        },
        take: 50
      }),
      // 2. Buckets - scoped and searched by name
      prisma.awsBucket.findMany({
        where: {
          bucket: dbQuery,
          credential: {
            ...(identityId ? { id: identityId } : {}),
            teamId: teamId || null,
            ...(teamId
              ? { team: { members: { some: { userId } } } }
              : { userId }
            )
          }
        },
        select: { 
          id: true, 
          bucket: true, 
          credentialId: true,
          credential: { 
            select: { 
              name: true,
              teamId: true
            } 
          } 
        },
        take: 20
      }),
      // 3. Teams - searched by name or slug
      prisma.team.findMany({
        where: {
          members: { some: { userId } },
          OR: [
            { name: dbQuery },
            { slug: dbQuery }
          ]
        },
        select: { id: true, name: true, slug: true },
        take: 10
      }),
      // 4. Team Members - searched by user name or email
      prisma.teamMember.findMany({
        where: {
          teamId: teamId || undefined,
          user: {
            OR: [
              { name: dbQuery },
              { email: dbQuery }
            ]
          }
        },
        select: {
          id: true,
          teamId: true,
          user: { select: { name: true, email: true } },
          role: { select: { name: true, description: true } }
        },
        take: 10
      })
    ])


    // Flatten into a single searchable dataset with context IDs for synchronization
    const dataset = [
      ...files.map(f => ({
        type: 'file',
        id: f.id,
        title: f.name,
        subtitle: f.bucket?.bucket || 'Unknown Bucket',
        tags: f.tags,
        description: f.description,
        url: `/dashboard/files`,
        // Context for UI sync
        teamId: f.teamId,
        identityId: f.credentialId,
        bucketId: f.bucketId
      })),
      ...buckets.map(b => ({
        type: 'bucket',
        id: b.id,
        title: b.bucket,
        subtitle: b.credential?.name || 'AWS Config',
        tags: [],
        description: null,
        url: '/dashboard/settings',
        teamId: b.credential?.teamId,
        identityId: b.credentialId,
        bucketId: b.id
      })),
      ...teams.map(t => ({
        type: 'team',
        id: t.id,
        title: t.name,
        subtitle: t.slug,
        tags: [],
        description: null,
        url: '/dashboard/teams',
        teamId: t.id
      })),
      ...members.map(m => ({
        type: 'member',
        id: m.id,
        title: m.user.name || m.user.email,
        subtitle: m.role.name,
        tags: [],
        description: m.role.description,
        url: '/dashboard/teams',
        teamId: m.teamId
      }))
    ]

    // Sort using fuzzysort for perfect ranking of DB results
    const searchTargets = dataset.map(item => ({
      ...item,
      searchStr: [item.title, item.subtitle, ...(item.tags || []), item.description]
        .filter(Boolean)
        .join(' ')
    }))

    const results = fuzzysort.go(query, searchTargets, {
      key: 'searchStr',
      limit: 15,
      threshold: -10000 
    })

    const formattedResults = results.map(res => res.obj)

    return NextResponse.json({ results: formattedResults })

  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 })
  }
}
