import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixUsersWithoutTeams() {
  console.log('🔧 Finding users without teams...')

  // Find users without team memberships
  const usersWithoutTeams = await prisma.user.findMany({
    where: {
      teamMembers: {
        none: {},
      },
    },
  })

  if (usersWithoutTeams.length === 0) {
    console.log('✅ All users already have teams!')
    return
  }

  console.log(`📋 Found ${usersWithoutTeams.length} users without teams`)

  // Get OWNER role
  const ownerRole = await prisma.role.findUnique({
    where: { name: 'OWNER' },
  })

  if (!ownerRole) {
    console.error('❌ OWNER role not found. Run: npm run db:seed')
    process.exit(1)
  }

  // Fix each user
  for (const user of usersWithoutTeams) {
    console.log(`🔧 Fixing user: ${user.email}`)

    await prisma.$transaction(async (tx) => {
      // Create team for the user
      const team = await tx.team.create({
        data: {
          name: `${user.name || user.email}'s Team`,
          slug: `${user.email.split('@')[0]}-${Date.now()}`,
          ownerId: user.id,
        },
      })

      // Add user as OWNER of the team
      await tx.teamMember.create({
        data: {
          userId: user.id,
          teamId: team.id,
          roleId: ownerRole.id,
        },
      })

      console.log(`  ✅ Created team: ${team.name}`)
    })
  }

  console.log('🎉 All users fixed successfully!')
}

fixUsersWithoutTeams()
  .catch((error) => {
    console.error('❌ Error:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
