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
    <div>
      <main className="max-w-7xl mx-auto py-8 animate-fade-in">
        <div className="mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-1">
            Welcome back, <span className="gradient-text">{session.user.name || 'User'}</span>!
          </h2>
          <p className="text-slate-500">
            Manage your S3 files and share them with your team
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <Card className="card-hover border-slate-200/60 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                AWS Buckets
              </CardTitle>
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-md shadow-indigo-500/20">
                <HardDrive className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{bucketsCount}</div>
              <p className="text-xs text-slate-500 mt-1">
                Connected buckets
              </p>
            </CardContent>
          </Card>

          <Card className="card-hover border-slate-200/60 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Files</CardTitle>
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-md shadow-emerald-500/20">
                <FolderOpen className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{filesCount}</div>
              <p className="text-xs text-slate-500 mt-1">Total files stored</p>
            </CardContent>
          </Card>

          <Card className="card-hover border-slate-200/60 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Shared Links</CardTitle>
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-md shadow-violet-500/20">
                <LinkIcon className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{linksCount}</div>
              <p className="text-xs text-slate-500 mt-1">Active share links</p>
            </CardContent>
          </Card>

          <Card className="card-hover border-slate-200/60 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Teams</CardTitle>
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-md shadow-amber-500/20">
                <Users className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{teamsCount}</div>
              <p className="text-xs text-slate-500 mt-1">Team memberships</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 border-slate-200/60 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Link href="/dashboard/settings">
                <Button className="w-full justify-start h-12 text-left" variant="outline">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center mr-3">
                    <HardDrive className="h-4 w-4 text-indigo-600" />
                  </div>
                  Add AWS Credentials
                </Button>
              </Link>
              <Link href="/dashboard/files">
                <Button className="w-full justify-start h-12 text-left" variant="outline">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center mr-3">
                    <FolderOpen className="h-4 w-4 text-emerald-600" />
                  </div>
                  Browse Files
                </Button>
              </Link>
              <Link href="/dashboard/teams">
                <Button className="w-full justify-start h-12 text-left" variant="outline">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center mr-3">
                    <Users className="h-4 w-4 text-amber-600" />
                  </div>
                  Manage Teams
                </Button>
              </Link>
              <Link href="/dashboard/links">
                <Button className="w-full justify-start h-12 text-left" variant="outline">
                  <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center mr-3">
                    <LinkIcon className="h-4 w-4 text-violet-600" />
                  </div>
                  View Shared Links
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="border-slate-200/60 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Recent Files</CardTitle>
            </CardHeader>
            <CardContent>
              {recentFiles.length === 0 ? (
                <div className="text-center py-4">
                  <FolderOpen className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No files uploaded yet
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-start justify-between p-2.5 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate text-slate-900">
                          {file.name}
                        </p>
                        <p className="text-xs text-slate-500">
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
