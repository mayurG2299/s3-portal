import { prisma } from '@/lib/db'
import type { PermissionLevel, ScreenName } from '@prisma/client'

const ownerScreens: ScreenName[] = [
  'FILES_LIST', 'FILES_UPLOAD', 'FILES_DELETE', 'FILES_SHARE',
  'CREDENTIALS_LIST', 'CREDENTIALS_CREATE', 'CREDENTIALS_EDIT', 'CREDENTIALS_DELETE',
  'TEAM_SETTINGS', 'TEAM_MEMBERS', 'TEAM_INVITATIONS', 'TEAM_DELETE',
  'LINKS_LIST', 'LINKS_CREATE', 'LINKS_DELETE',
  'ADMIN_AUDIT_LOG', 'ADMIN_SETTINGS',
]

const adminPermissions: Array<{ screenName: ScreenName; permissionLevel: PermissionLevel }> = [
  { screenName: 'FILES_LIST', permissionLevel: 'EDIT' },
  { screenName: 'FILES_UPLOAD', permissionLevel: 'EDIT' },
  { screenName: 'FILES_DELETE', permissionLevel: 'EDIT' },
  { screenName: 'FILES_SHARE', permissionLevel: 'EDIT' },
  { screenName: 'CREDENTIALS_LIST', permissionLevel: 'EDIT' },
  { screenName: 'CREDENTIALS_CREATE', permissionLevel: 'EDIT' },
  { screenName: 'CREDENTIALS_EDIT', permissionLevel: 'EDIT' },
  { screenName: 'CREDENTIALS_DELETE', permissionLevel: 'EDIT' },
  { screenName: 'TEAM_SETTINGS', permissionLevel: 'VIEW' },
  { screenName: 'TEAM_MEMBERS', permissionLevel: 'EDIT' },
  { screenName: 'TEAM_INVITATIONS', permissionLevel: 'EDIT' },
  { screenName: 'LINKS_LIST', permissionLevel: 'EDIT' },
  { screenName: 'LINKS_CREATE', permissionLevel: 'EDIT' },
  { screenName: 'LINKS_DELETE', permissionLevel: 'EDIT' },
  { screenName: 'ADMIN_AUDIT_LOG', permissionLevel: 'VIEW' },
]

const viewerScreens: ScreenName[] = ['FILES_LIST', 'LINKS_LIST']

export async function ensureSystemRoles() {
  const owner = await prisma.role.upsert({
    where: { name: 'OWNER' },
    update: {},
    create: {
      id: 'role_owner',
      name: 'OWNER',
      description: 'Full access to all features and settings',
      level: 100,
      isSystem: true,
    },
  })

  const admin = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: {
      id: 'role_admin',
      name: 'ADMIN',
      description: 'Can manage team, files, and most settings',
      level: 50,
      isSystem: true,
    },
  })

  const viewer = await prisma.role.upsert({
    where: { name: 'VIEWER' },
    update: {},
    create: {
      id: 'role_viewer',
      name: 'VIEWER',
      description: 'Read-only access to files and links',
      level: 10,
      isSystem: true,
    },
  })

  for (const screenName of ownerScreens) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_screenName: {
          roleId: owner.id,
          screenName,
        },
      },
      update: {},
      create: {
        roleId: owner.id,
        screenName,
        permissionLevel: 'EDIT',
      },
    })
  }

  for (const permission of adminPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_screenName: {
          roleId: admin.id,
          screenName: permission.screenName,
        },
      },
      update: {},
      create: {
        roleId: admin.id,
        screenName: permission.screenName,
        permissionLevel: permission.permissionLevel,
      },
    })
  }

  for (const screenName of viewerScreens) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_screenName: {
          roleId: viewer.id,
          screenName,
        },
      },
      update: {},
      create: {
        roleId: viewer.id,
        screenName,
        permissionLevel: 'VIEW',
      },
    })
  }

  return { owner, admin, viewer }
}
