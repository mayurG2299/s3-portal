import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import fuzzysort from 'fuzzysort'
import { searchAndRank, type SearchItem } from "@/lib/search-utils";

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
    const [files, links, buckets, teams, members] = await Promise.all([
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
                  teamId: teamId || null,
                },
              },
            },
          ],
          ...(bucketId ? { bucketId } : {}),
          ...(identityId ? { credentialId: identityId } : {}),
          AND: [
            {
              OR: [
                { name: dbQuery },
                { tags: { has: query.toLowerCase().trim() } },
                { description: dbQuery },
              ],
            },
          ],
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
          bucket: { select: { bucket: true } },
        },
        take: 50,
      }),
      // 2. Shared Links - scoped and searched by file name or link properties
      prisma.link.findMany({
        where: {
          file: {
            ...(bucketId ? { bucketId } : {}),
            ...(identityId ? { credentialId: identityId } : {}),
            OR: [
              {
                teamId: teamId || null,
                name: dbQuery,
              },
              {
                teamId: teamId || null,
                tags: { has: query.toLowerCase().trim() },
              },
              {
                teamId: null,
                bucket: {
                  credential: {
                    teamId: teamId || null,
                  },
                },
                name: dbQuery,
              },
              {
                teamId: null,
                bucket: {
                  credential: {
                    teamId: teamId || null,
                  },
                },
                tags: { has: query.toLowerCase().trim() },
              },
            ],
          },
        },
        select: {
          id: true,
          hash: true,
          type: true,
          expiresAt: true,
          allowDownload: true,
          allowPreview: true,
          createdAt: true,
          file: {
            select: {
              id: true,
              name: true,
              tags: true,
              teamId: true,
              credentialId: true,
              bucketId: true,
            },
          },
        },
        take: 30,
      }),
      // 3. Buckets - scoped and searched by name
      prisma.awsBucket.findMany({
        where: {
          bucket: dbQuery,
          credential: {
            ...(identityId ? { id: identityId } : {}),
            teamId: teamId || null,
            ...(teamId
              ? { team: { members: { some: { userId } } } }
              : { userId }),
          },
        },
        select: {
          id: true,
          bucket: true,
          credentialId: true,
          credential: {
            select: {
              name: true,
              teamId: true,
            },
          },
        },
        take: 20,
      }),
      // 4. Teams - searched by name or slug
      prisma.team.findMany({
        where: {
          members: { some: { userId } },
          OR: [{ name: dbQuery }, { slug: dbQuery }],
        },
        select: { id: true, name: true, slug: true },
        take: 10,
      }),
      // 5. Team Members - searched by user name or email
      prisma.teamMember.findMany({
        where: {
          teamId: teamId || undefined,
          user: {
            OR: [{ name: dbQuery }, { email: dbQuery }],
          },
        },
        select: {
          id: true,
          teamId: true,
          user: { select: { name: true, email: true } },
          role: { select: { name: true, description: true } },
        },
        take: 10,
      }),
    ]);


    // Flatten into a single searchable dataset with context IDs for synchronization
    const dataset: SearchItem[] = [
      ...files.map((f) => ({
        type: "file" as const,
        id: f.id,
        title: f.name,
        subtitle: f.bucket?.bucket || "Unknown Bucket",
        tags: f.tags || [],
        description: f.description,
        url: `/dashboard/files`,
        // Context for UI sync
        teamId: f.teamId,
        identityId: f.credentialId,
        bucketId: f.bucketId,
      })),
      ...links.map((l) => ({
        type: "link" as const,
        id: l.id,
        title: l.file.name,
        subtitle: `Shared Link • ${l.type === "PUBLIC" ? "Public" : "Private"}${l.expiresAt ? " • Expires" : " • Permanent"}`,
        tags: l.file.tags || [],
        description: `Link to ${l.file.name}`,
        url: `/dashboard/links`,
        hash: l.hash,
        // Context for UI sync
        teamId: l.file.teamId,
        identityId: l.file.credentialId,
        bucketId: l.file.bucketId,
      })),
      ...buckets.map((b) => ({
        type: "bucket" as const,
        id: b.id,
        title: b.bucket,
        subtitle: b.credential?.name || "AWS Config",
        tags: [],
        description: null,
        url: "/dashboard/settings",
        teamId: b.credential?.teamId,
        identityId: b.credentialId,
        bucketId: b.id,
      })),
      ...teams.map((t) => ({
        type: "team" as const,
        id: t.id,
        title: t.name,
        subtitle: t.slug,
        tags: [],
        description: null,
        url: "/dashboard/teams",
        teamId: t.id,
      })),
      ...members.map((m) => ({
        type: "member" as const,
        id: m.id,
        title: m.user.name || m.user.email,
        subtitle: m.role.name,
        tags: [],
        description: m.role.description,
        url: `/dashboard/teams?memberId=${m.id}`,
        teamId: m.teamId,
      })),
    ];

    // Use custom search and ranking with score-based relevance
    const rankedResults = searchAndRank(query, dataset, {
      scoreThreshold: 10,
      maxResults: 20,
    });

    // Format results with search metadata
    const formattedResults = rankedResults.map(
      ({ item, score, matchedField }) => ({
        ...item,
        _searchMeta: {
          score,
          matchedField,
          query,
        },
      }),
    );

    return NextResponse.json({
      results: formattedResults,
      meta: {
        totalResults: rankedResults.length,
        query,
        scopes: {
          files: files.length,
          links: links.length,
          buckets: buckets.length,
          teams: teams.length,
          members: members.length,
        },
      },
    });

  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 })
  }
}
