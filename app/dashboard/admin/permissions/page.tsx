import { requireUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { canManageTeam } from '@/lib/permissions'
import { PermissionManagement } from '@/components/admin/permission-management'

export default async function PermissionsPage() {
  const session = await requireUser('admin/permissions')
  const cookieStore = await cookies()
  const selectedTeamId = cookieStore.get('selectedTeamId')?.value?.trim()
  const teamId = selectedTeamId || session.user.teamId

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
      <PermissionManagement teamId={teamId} />
    </div>
  )
}
