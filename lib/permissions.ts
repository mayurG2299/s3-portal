import type { Role } from '@prisma/client'
import { Session } from 'next-auth'
import { prisma } from '@/lib/db'
import { DEFAULT_SCREEN_PERMISSIONS, hasPermissionLevel } from '@/lib/screen-permissions'
import type { ScreenName, PermissionLevel } from '@prisma/client'

/**
 * Check if user role level meets minimum requirement
 */
export function hasRoleLevel(userRole: Role | undefined, requiredLevel: number): boolean {
  if (!userRole) return false
  return userRole.level >= requiredLevel
}

/**
 * Check if user has at least the specified role name
 */
export function hasRoleName(userRole: Role | undefined, requiredRoleName: string): boolean {
  if (!userRole) return false
  return userRole.name === requiredRoleName || userRole.level >= (requiredRoleName === 'OWNER' ? 100 : requiredRoleName === 'ADMIN' ? 50 : 10)
}

/**
 * Check if user is team owner
 */
export function isOwner(userRole: Role | undefined): boolean {
  return userRole?.level === 100 || userRole?.name === 'OWNER'
}

/**
 * Check if user is admin or above
 */
export function isAdmin(userRole: Role | undefined): boolean {
  return userRole ? userRole.level >= 50 : false
}

/**
 * Check if user is viewer (any role)
 */
export function isViewer(userRole: Role | undefined): boolean {
  return userRole ? userRole.level >= 10 : false
}

/**
 * Get user's role in a specific team
 */
export async function getUserRoleInTeam(
  userId: string,
  teamId: string
): Promise<Role | null> {
  const teamMember = await prisma.teamMember.findUnique({
    where: {
      teamId_userId: {
        teamId,
        userId,
      },
    },
    include: {
      role: true,
    },
  })

  return teamMember?.role || null
}

/**
 * Check if user can access a team
 */
export async function canAccessTeam(
  userId: string,
  teamId: string
): Promise<boolean> {
  const role = await getUserRoleInTeam(userId, teamId)
  return role !== null
}

/**
 * Check if user can manage team (admin or owner)
 */
export async function canManageTeam(
  userId: string,
  teamId: string
): Promise<boolean> {
  const role = await getUserRoleInTeam(userId, teamId)
  return isAdmin(role || undefined)
}

/**
 * Check if user is owner of team
 */
export async function isTeamOwner(
  userId: string,
  teamId: string
): Promise<boolean> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
  })

  return team?.ownerId === userId
}

/**
 * Check if user can access credentials (within their team)
 */
export async function canAccessCredential(
  userId: string,
  credentialId: string
): Promise<boolean> {
  const credential = await prisma.aWSCredential.findUnique({
    where: { id: credentialId },
    include: {
      team: true,
    },
  })

  if (!credential) return false

  // If it's personal credential (no team), only owner can access
  if (!credential.teamId) {
    return credential.userId === userId
  }

  // If it's team credential, user must be team member
  return canAccessTeam(userId, credential.teamId)
}

/**
 * Check if user can modify credentials (admin or above in team)
 */
export async function canModifyCredential(
  userId: string,
  credentialId: string
): Promise<boolean> {
  const credential = await prisma.aWSCredential.findUnique({
    where: { id: credentialId },
    include: {
      team: true,
    },
  })

  if (!credential) return false

  // If it's personal credential, only owner can modify
  if (!credential.teamId) {
    return credential.userId === userId
  }

  // If it's team credential, user must be admin or above
  return canManageTeam(userId, credential.teamId)
}

/**
 * Check if user can access file (shared with them via team)
 */
export async function canAccessFile(
  userId: string,
  fileId: string
): Promise<boolean> {
  const file = await prisma.file.findUnique({
    where: { id: fileId },
  })

  if (!file) return false

  // If personal file, only owner can access
  if (!file.teamId) {
    return file.userId === userId
  }

  // If team file, user must be team member
  return canAccessTeam(userId, file.teamId)
}

/**
 * Get user's primary team (first team they're a member of)
 */
export async function getUserPrimaryTeam(userId: string) {
  const teamMember = await prisma.teamMember.findFirst({
    where: { userId },
    include: { team: true },
    orderBy: { createdAt: 'asc' },
  })

  return teamMember?.team || null
}

/**
 * Get all teams for a user with their roles
 */
export async function getUserTeams(userId: string) {
  const teamMembers = await prisma.teamMember.findMany({
    where: { userId },
    include: { team: true },
    orderBy: { createdAt: 'asc' },
  })

  return teamMembers.map((tm) => ({
    ...tm.team,
    roleId: tm.roleId,
  }))
}

/**
 * Verify session - deprecated, returns roleId instead of role object
 */
export function requireAuth(session: Session | null): {
  userId: string
  roleId?: string
  teamId?: string
} | null {
  if (!session?.user) return null

  return {
    userId: session.user.id,
    roleId: session.user.roleId,
    teamId: session.user.teamId,
  }
}

/**
 * ============================================================================
 * SCREEN/FEATURE PERMISSIONS
 * ============================================================================
 * These functions handle granular screen/feature-level permissions that can
 * override role-based access
 */

/**
 * Get user's screen permission in a team
 * Returns the permission level or null if not permitted
 * NOTE: This is for legacy support. New code should use role-based permissions.
 */
export async function getUserScreenPermission(
  userId: string,
  teamId: string,
  screenName: ScreenName
): Promise<PermissionLevel | null> {
  // First check if user is in team and get their role
  const teamMember = await prisma.teamMember.findUnique({
    where: {
      teamId_userId: {
        teamId,
        userId,
      },
    },
    include: {
      role: true,
    },
  })

  if (!teamMember || !teamMember.role) return null

  // Check if role has permission for this screen via RolePermission
  const rolePermission = await prisma.rolePermission.findUnique({
    where: {
      roleId_screenName: {
        roleId: teamMember.role.id,
        screenName,
      },
    },
  })

  if (rolePermission) {
    return rolePermission.permissionLevel
  }

  // Fall back to role level - OWNER and ADMIN get EDIT on all screens
  if (teamMember.role.level >= 50) {
    return 'EDIT'
  }
  if (teamMember.role.level >= 10) {
    return 'VIEW'
  }

  return null
}

/**
 * Check if user can VIEW a screen
 */
export async function userCanViewScreen(
  userId: string,
  teamId: string,
  screenName: ScreenName
): Promise<boolean> {
  const permission = await getUserScreenPermission(userId, teamId, screenName)
  return permission !== null && hasPermissionLevel(permission, 'VIEW')
}

/**
 * Check if user can EDIT a screen (implies can view)
 */
export async function userCanEditScreen(
  userId: string,
  teamId: string,
  screenName: ScreenName
): Promise<boolean> {
  const permission = await getUserScreenPermission(userId, teamId, screenName)
  return permission !== null && hasPermissionLevel(permission, 'EDIT')
}

/**
 * Grant a screen permission to a user
 */
export async function grantScreenPermission(
  userId: string,
  teamId: string,
  screenName: ScreenName,
  permissionLevel: PermissionLevel = 'VIEW'
): Promise<any> {
  const teamMember = await prisma.teamMember.findUnique({
    where: {
      teamId_userId: {
        teamId,
        userId,
      },
    },
  })

  if (!teamMember) {
    throw new Error('User is not a member of this team')
  }

  return prisma.screenPermission.upsert({
    where: {
      teamMemberId_screenName: {
        teamMemberId: teamMember.id,
        screenName,
      },
    },
    create: {
      teamMemberId: teamMember.id,
      screenName,
      permissionLevel,
    },
    update: {
      permissionLevel,
    },
  })
}

/**
 * Revoke a screen permission (return to role-based defaults)
 */
export async function revokeScreenPermission(
  userId: string,
  teamId: string,
  screenName: ScreenName
): Promise<void> {
  const teamMember = await prisma.teamMember.findUnique({
    where: {
      teamId_userId: {
        teamId,
        userId,
      },
    },
  })

  if (!teamMember) return

  await prisma.screenPermission.deleteMany({
    where: {
      teamMemberId: teamMember.id,
      screenName,
    },
  })
}

/**
 * Get all screen permissions for a user in a team
 * NOTE: This is for legacy support.
 */
export async function getUserScreenPermissions(userId: string, teamId: string) {
  const teamMember = await prisma.teamMember.findUnique({
    where: {
      teamId_userId: {
        teamId,
        userId,
      },
    },
    include: {
      role: {
        include: {
          rolePermissions: true,
        },
      },
    },
  })

  if (!teamMember || !teamMember.role) return []

  return teamMember.role.rolePermissions
}

/**
 * Get all users with a specific screen permission in a team
 */
export async function getUsersWithScreenPermission(teamId: string, screenName: ScreenName) {
  return prisma.screenPermission.findMany({
    where: {
      teamMember: {
        teamId,
      },
      screenName,
    },
    include: {
      teamMember: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      },
    },
  })
}

/**
 * Bulk set permissions for a user (grant multiple screens)
 */
export async function setUserScreenPermissions(
  userId: string,
  teamId: string,
  permissions: Array<{
    screenName: ScreenName
    permissionLevel: PermissionLevel
  }>
): Promise<void> {
  const teamMember = await prisma.teamMember.findUnique({
    where: {
      teamId_userId: {
        teamId,
        userId,
      },
    },
  })

  if (!teamMember) {
    throw new Error('User is not a member of this team')
  }

  // Delete existing custom permissions
  await prisma.screenPermission.deleteMany({
    where: {
      teamMemberId: teamMember.id,
    },
  })

  // Create new permissions
  if (permissions.length > 0) {
    await prisma.screenPermission.createMany({
      data: permissions.map((perm) => ({
        teamMemberId: teamMember.id,
        screenName: perm.screenName,
        permissionLevel: perm.permissionLevel,
      })),
      skipDuplicates: true,
    })
  }
}

