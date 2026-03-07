const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function fixViewerPermissions() {
  try {
    // Find the Viewer role
    const viewerRole = await prisma.role.findFirst({
      where: { name: 'VIEWER' }
    })

    if (!viewerRole) {
      console.log('Viewer role not found')
      return
    }

    console.log('Found Viewer role:', viewerRole.id, viewerRole.name)

    // Find FILES_LIST screen
    const filesListScreen = await prisma.screen.findUnique({
      where: { name: 'FILES_LIST' }
    })

    if (!filesListScreen) {
      console.log('FILES_LIST screen not found')
      return
    }

    console.log('Found FILES_LIST screen:', filesListScreen.id)

    // Check if screen permission exists
    let screenPerm = await prisma.screenPermission.findFirst({
      where: {
        roleId: viewerRole.id,
        screenId: filesListScreen.id
      },
      include: {
        actionPermissions: {
          include: {
            action: true
          }
        }
      }
    })

    console.log('Current screen permission:', JSON.stringify(screenPerm, null, 2))

    // If no screen permission, create it
    if (!screenPerm) {
      screenPerm = await prisma.screenPermission.create({
        data: {
          roleId: viewerRole.id,
          screenId: filesListScreen.id
        }
      })
      console.log('Created screen permission')
    }

    // Find VIEW action
    const viewAction = await prisma.action.findUnique({
      where: { name: 'VIEW' }
    })

    if (!viewAction) {
      console.log('VIEW action not found')
      return
    }

    // Check if VIEW action permission exists
    const existingActionPerm = await prisma.actionPermission.findFirst({
      where: {
        screenPermissionId: screenPerm.id,
        actionId: viewAction.id
      }
    })

    if (existingActionPerm) {
      console.log('VIEW permission already exists for FILES_LIST')
    } else {
      // Grant VIEW permission
      await prisma.actionPermission.create({
        data: {
          screenPermissionId: screenPerm.id,
          actionId: viewAction.id
        }
      })
      console.log('✅ Granted FILES_LIST VIEW permission to Viewer role')
    }

    // Verify the permission
    const updated = await prisma.screenPermission.findFirst({
      where: {
        roleId: viewerRole.id,
        screenId: filesListScreen.id
      },
      include: {
        actionPermissions: {
          include: {
            action: true
          }
        }
      }
    })

    console.log('\nUpdated permissions:', JSON.stringify(updated, null, 2))
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixViewerPermissions()
