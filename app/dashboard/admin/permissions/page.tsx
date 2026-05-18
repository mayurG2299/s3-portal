import { requireUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { canManageTeam } from '@/lib/permissions'
import { PermissionManagement } from '@/components/admin/permission-management'
import { getResolvedUserTeamScope } from '@/lib/team-selection'
import { Shield } from 'lucide-react'

export default async function PermissionsPage() {
  const session = await requireUser('admin/permissions')
  const cookieStore = await cookies()
  const { teamId } = await getResolvedUserTeamScope({
    userId: session.user.id,
    cookieTeamId: cookieStore.get('selectedTeamId')?.value?.trim(),
    sessionTeamId: session.user.teamId,
  })

  if (!teamId) {
    redirect('/dashboard')
  }

  // Only admins and owners can access this page
  const hasAccess = await canManageTeam(session.user.id!, teamId)
  if (!hasAccess) {
    redirect('/dashboard')
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-8 animate-slide-up">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Shield size={20} strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground">
              Role <span className="text-gradient">Permissions</span>
            </h1>
            <p className="text-sm text-muted-foreground">Configure what each role can access.</p>
          </div>
        </div>
      </div>
      <PermissionManagement teamId={teamId} />
    </div>
  )
}
