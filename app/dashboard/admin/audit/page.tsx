import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { getUserRoleInTeam, isOwner } from '@/lib/permissions'

export default async function AuditLogPage() {
  const session = await requireUser()
  const teamId = session.user.teamId

  if (!teamId) {
    redirect('/dashboard')
  }

  const role = await getUserRoleInTeam(session.user.id, teamId)
  if (!isOwner(role || undefined)) {
    redirect('/dashboard')
  }

  type AuditLogRow = Prisma.AccessLogGetPayload<{
    include: { user: { select: { email: true } } }
  }> & {
    resourceType?: string | null
    resourceId?: string | null
  }

  const logs = (await prisma.accessLog.findMany({
    where: { teamId } as Prisma.AccessLogWhereInput,
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      user: { select: { email: true } },
    },
  })) as AuditLogRow[]

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
        <p className="text-muted-foreground mt-2">
          Recent user actions for your team (last 100 entries)
        </p>
      </div>

      <div className="rounded-lg border bg-white overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Time</th>
              <th className="text-left px-4 py-3 font-medium">User</th>
              <th className="text-left px-4 py-3 font-medium">Action</th>
              <th className="text-left px-4 py-3 font-medium">Resource</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium">Error</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {logs.map((log) => (
              <tr key={log.id}>
                <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                  {new Date(log.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {log.user?.email || 'Unknown'}
                </td>
                <td className="px-4 py-3 text-gray-900 font-medium">
                  {log.action}
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {log.resourceType ? `${log.resourceType}:${log.resourceId ?? ''}` : '-'}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={
                      log.success
                        ? 'inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700'
                        : 'inline-flex items-center rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700'
                    }
                  >
                    {log.success ? 'SUCCESS' : 'FAILURE'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {log.errorMessage || '-'}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-gray-500" colSpan={6}>
                  No audit logs yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
