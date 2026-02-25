import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function makeUserAdmin() {
  try {
    const email = process.argv[2]
    
    if (!email) {
      console.log('Usage: npx tsx scripts/make-admin.ts <email>')
      console.log('Example: npx tsx scripts/make-admin.ts user@example.com')
      process.exit(1)
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        teamMembers: {
          include: {
            team: true,
            role: true,
          },
        },
      },
    })

    if (!user) {
      console.log(`❌ User not found with email: ${email}`)
      console.log('Please register first at http://localhost:3000/register')
      process.exit(1)
    }

    console.log('✅ User found:', user.email)

    if (user.teamMembers.length === 0) {
      console.log('⚠️  User has no team membership. Creating team...')
      
      // Create a team
      const team = await prisma.team.create({
        data: {
          name: 'Default Team',
          slug: 'default-team',
          ownerId: user.id,
        },
      })

      console.log('✅ Team created:', team.name)

      // Add user to team as OWNER
      const teamMember = await prisma.teamMember.create({
        data: {
          userId: user.id,
          teamId: team.id,
          roleId: 'role_owner',
        },
      })

      console.log('✅ User added to team as OWNER')
      console.log('🎉 All done! Log out and log back in to see changes.')
    } else {
      // Update existing team membership to OWNER
      const teamMember = user.teamMembers[0]
      
      if (teamMember.role.name === 'OWNER') {
        console.log('✅ User already has OWNER access')
      } else if (teamMember.role.level >= 50) {
        console.log('✅ User already has admin access with role:', teamMember.role.name)
        console.log('Upgrading to OWNER...')
        
        await prisma.teamMember.update({
          where: { id: teamMember.id },
          data: { roleId: 'role_owner' },
        })
        
        console.log('✅ Updated user role to OWNER')
        console.log('🎉 All done! Log out and log back in to see changes.')
      } else {
        await prisma.teamMember.update({
          where: { id: teamMember.id },
          data: { roleId: 'role_owner' },
        })
        
        console.log('✅ Updated user role from', teamMember.role.name, 'to OWNER')
        console.log('🎉 All done! Log out and log back in to see changes.')
      }
    }
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

makeUserAdmin()
