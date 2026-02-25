import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function listUsers() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        teamMembers: {
          include: {
            team: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    console.log('\n📋 Users in database:\n')
    
    if (users.length === 0) {
      console.log('❌ No users found. Please register at http://localhost:3000/register')
    } else {
      users.forEach((user, index) => {
        console.log(`${index + 1}. ${user.email}`)
        console.log(`   Name: ${user.name || 'N/A'}`)
        console.log(`   ID: ${user.id}`)
        console.log(`   Created: ${user.createdAt}`)
        if (user.teamMembers.length > 0) {
          user.teamMembers.forEach(tm => {
            console.log(`   Team: ${tm.team.name} (RoleId: ${tm.roleId})`)
          })
        } else {
          console.log(`   Team: None - User needs team assignment!`)
        }
        console.log('')
      })
    }
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

listUsers()
