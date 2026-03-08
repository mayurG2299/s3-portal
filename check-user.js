const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkUser() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: 'mayur@fitpage.in' },
      include: {
        teamMembers: {
          include: {
            team: true,
            role: true,
          },
        },
      },
    });

    if (!user) {
      console.log('❌ User mayur@fitpage.in NOT FOUND in database');
    } else {
      console.log('✅ User found:');
      console.log('   Email:', user.email);
      console.log('   Name:', user.name);
      console.log('   Password Hash:', user.passwordHash ? '✓ Set' : '✗ Not set');
      console.log('   Team Memberships:', user.teamMembers.length);
      if (user.teamMembers.length === 0) {
        console.log('   ⚠️  WARNING: User has NO team memberships!');
      } else {
        user.teamMembers.forEach((tm, i) => {
          console.log(`     [${i}] Team: ${tm.team.name}, Role: ${tm.role.name}`);
        });
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkUser();
