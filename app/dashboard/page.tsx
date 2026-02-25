import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import Link from 'next/link'
import { FolderOpen, HardDrive, Users, Link as LinkIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SignOutButton } from '@/components/dashboard/sign-out-button'

export default async function DashboardPage() {
  const session = await requireUser()

  // Fetch user stats
  const [bucketsCount, filesCount, linksCount, teamsCount] =
    await Promise.all([
      prisma.awsBucket.count({
        where: { 
          credential: {
            userId: session.user.id 
          }
        },
      }),
      prisma.file.count({
        where: { userId: session.user.id },
      }),
      prisma.link.count({
        where: { userId: session.user.id },
      }),
      prisma.teamMember.count({
        where: { userId: session.user.id },
      }),
    ])

  const recentFiles = await prisma.file.findMany({
    where: { userId: session.user.id },
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: {
      bucket: {
        select: {
          bucket: true,
          credential: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back, {session.user.name || 'User'}!
          </h2>
          <p className="text-gray-600">
            Manage your S3 files and share them with your team
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                AWS Buckets
              </CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{bucketsCount}</div>
              <p className="text-xs text-muted-foreground">
                Connected buckets
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Files</CardTitle>
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filesCount}</div>
              <p className="text-xs text-muted-foreground">Total files stored</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Shared Links</CardTitle>
              <LinkIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{linksCount}</div>
              <p className="text-xs text-muted-foreground">Active share links</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Teams</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{teamsCount}</div>
              <p className="text-xs text-muted-foreground">Team memberships</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <Link href="/dashboard/settings">
                <Button className="w-full" variant="outline">
                  <HardDrive className="mr-2 h-4 w-4" />
                  Add AWS Credentials
                </Button>
              </Link>
              <Link href="/dashboard/files">
                <Button className="w-full" variant="outline">
                  <FolderOpen className="mr-2 h-4 w-4" />
                  Browse Files
                </Button>
              </Link>
              <Link href="/dashboard/teams">
                <Button className="w-full" variant="outline">
                  <Users className="mr-2 h-4 w-4" />
                  Manage Teams
                </Button>
              </Link>
              <Link href="/dashboard/links">
                <Button className="w-full" variant="outline">
                  <LinkIcon className="mr-2 h-4 w-4" />
                  View Shared Links
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Files</CardTitle>
            </CardHeader>
            <CardContent>
              {recentFiles.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No files uploaded yet
                </p>
              ) : (
                <div className="space-y-3">
                  {recentFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-start justify-between"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {file.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {file.bucket.credential.name} • {file.bucket.bucket}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
