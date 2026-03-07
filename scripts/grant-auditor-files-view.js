const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const roleId = 'cmm77b02o000a3reqy7ac7krk'
  
  // Check if AUDITOR role has FILES_LIST permission
  const existing = await prisma.rolePermission.findUnique({
    where: {
      roleId_screenName: {
        roleId: roleId,
        screenName: 'FILES_LIST'
      }
    }
  })

  if (existing) {
    console.log('✅ AUDITOR role already has FILES_LIST permission with level:', existing.permissionLevel)
  } else {
    console.log('❌ AUDITOR role missing FILES_LIST permission')
    console.log('Granting FILES_LIST VIEW permission...')
    
    await prisma.rolePermission.create({
      data: {
        roleId: roleId,
        screenName: 'FILES_LIST',
        permissionLevel: 'VIEW'
      }
    })
    
    console.log('✅ Permission granted successfully!')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
