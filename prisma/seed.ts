import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function seedRoles() {
  console.log('🌱 Seeding default roles...')

  // Create default roles
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

  console.log('✅ Roles created:', { owner: owner.name, admin: admin.name, viewer: viewer.name })

  // Create OWNER permissions (all screens with EDIT)
  const ownerScreens = [
    'FILES_LIST', 'FILES_UPLOAD', 'FILES_DELETE', 'FILES_SHARE',
    'CREDENTIALS_LIST', 'CREDENTIALS_CREATE', 'CREDENTIALS_EDIT', 'CREDENTIALS_DELETE',
    'TEAM_SETTINGS', 'TEAM_MEMBERS', 'TEAM_INVITATIONS', 'TEAM_DELETE',
    'LINKS_LIST', 'LINKS_CREATE', 'LINKS_DELETE',
    'ADMIN_AUDIT_LOG', 'ADMIN_SETTINGS'
  ]

  for (const screen of ownerScreens) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_screenName: {
          roleId: owner.id,
          screenName: screen as any,
        },
      },
      update: {},
      create: {
        roleId: owner.id,
        screenName: screen as any,
        permissionLevel: 'EDIT',
      },
    })
  }

  console.log(`✅ Created ${ownerScreens.length} OWNER permissions`)

  // Create ADMIN permissions
  const adminPerms = [
    { screen: 'FILES_LIST', level: 'EDIT' },
    { screen: 'FILES_UPLOAD', level: 'EDIT' },
    { screen: 'FILES_DELETE', level: 'EDIT' },
    { screen: 'FILES_SHARE', level: 'EDIT' },
    { screen: 'CREDENTIALS_LIST', level: 'EDIT' },
    { screen: 'CREDENTIALS_CREATE', level: 'EDIT' },
    { screen: 'CREDENTIALS_EDIT', level: 'EDIT' },
    { screen: 'CREDENTIALS_DELETE', level: 'EDIT' },
    { screen: 'TEAM_SETTINGS', level: 'VIEW' },
    { screen: 'TEAM_MEMBERS', level: 'EDIT' },
    { screen: 'TEAM_INVITATIONS', level: 'EDIT' },
    { screen: 'LINKS_LIST', level: 'EDIT' },
    { screen: 'LINKS_CREATE', level: 'EDIT' },
    { screen: 'LINKS_DELETE', level: 'EDIT' },
    { screen: 'ADMIN_AUDIT_LOG', level: 'VIEW' },
  ]

  for (const perm of adminPerms) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_screenName: {
          roleId: admin.id,
          screenName: perm.screen as any,
        },
      },
      update: {},
      create: {
        roleId: admin.id,
        screenName: perm.screen as any,
        permissionLevel: perm.level as any,
      },
    })
  }

  console.log(`✅ Created ${adminPerms.length} ADMIN permissions`)

  // Create VIEWER permissions
  const viewerScreens = ['FILES_LIST', 'LINKS_LIST']

  for (const screen of viewerScreens) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_screenName: {
          roleId: viewer.id,
          screenName: screen as any,
        },
      },
      update: {},
      create: {
        roleId: viewer.id,
        screenName: screen as any,
        permissionLevel: 'VIEW',
      },
    })
  }

  console.log(`✅ Created ${viewerScreens.length} VIEWER permissions`)

  console.log('🎉 Seeding completed successfully!')
}

seedRoles()
  .catch((error) => {
    console.error('❌ Error seeding roles:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
