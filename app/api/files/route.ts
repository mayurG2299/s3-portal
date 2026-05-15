import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logUserAction } from '@/lib/audit'
import { copyS3Object, deleteS3Object } from '@/lib/aws'
import { buildS3Key } from '@/lib/utils'
import { decrementUsage } from '@/lib/storage-quota'
import { z } from 'zod'
import { buildHandlerContext, decryptConfigOrError, moveSchema } from './handlers/shared'
import { handleList } from './handlers/list'
import { publishFileChanged } from '@/lib/events/files'
import type { Session } from 'next-auth'

type FilesSession = Session & { user: { id: string; teamId?: string | null } }

export async function POST(request: NextRequest) {
  try {
    const { ctx, errorResponse } = await buildHandlerContext(request)
    if (errorResponse) return errorResponse

    if (ctx.body.action !== 'list') {
      await logUserAction({ request: ctx.request, action: 'FILE_ACTION', success: false, userId: ctx.session.user.id, errorMessage: 'Invalid action', metadata: { action: ctx.body.action } })
      return NextResponse.json({ message: 'Invalid action' }, { status: 400 })
    }

    return await handleList(ctx)
  } catch (error: any) {
    console.error('Error in files API:', error)
    await logUserAction({ request, action: 'FILE_ACTION', success: false, errorMessage: error?.message ?? 'Internal server error' })
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: error.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as FilesSession | null
    if (!session?.user?.id) {
      await logUserAction({ request, action: 'FILE_DELETE', success: false, errorMessage: 'Unauthorized' })
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) {
      await logUserAction({ request, action: 'FILE_DELETE', success: false, userId: session.user.id, errorMessage: 'File ID is required' })
      return NextResponse.json({ message: 'File ID is required' }, { status: 400 })
    }

    const file = await prisma.file.findUnique({ where: { id }, include: { credential: true, bucket: true } })
    if (!file) {
      await logUserAction({ request, action: 'FILE_DELETE', success: false, userId: session.user.id, resourceType: 'file', resourceId: id, errorMessage: 'File not found' })
      return NextResponse.json({ message: 'File not found' }, { status: 404 })
    }

    if (file.userId !== session.user.id) {
      const teamMember = await prisma.teamMember.findFirst({ where: { teamId: file.teamId!, userId: session.user.id, role: { name: { in: ['OWNER', 'ADMIN'] } } } })
      if (!teamMember) {
        await logUserAction({ request, action: 'FILE_DELETE', success: false, userId: session.user.id, teamId: file.teamId, resourceType: 'file', resourceId: file.id, errorMessage: 'Forbidden' })
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
      }
    }

    const { config, errorResponse } = await decryptConfigOrError({ request, action: 'FILE_DELETE', userId: session.user.id, teamId: file.teamId, resourceType: 'file', resourceId: file.id, credential: file.credential, bucket: file.bucket })
    if (errorResponse) return errorResponse

    await deleteS3Object(config, file.key)

    try {
      const size = BigInt(file.size || 0)
      if (size > BigInt(0)) await decrementUsage(file.teamId || file.credential.teamId, size)
    } catch (err) {
      console.error('Failed to decrement usage:', err)
    }

    await prisma.file.delete({ where: { id } })

    revalidateTag('dashboard-stats', 'max')
    publishFileChanged(file.teamId!, { bucketId: file.bucketId, action: 'deleted', key: file.key })

    await logUserAction({ request, action: 'FILE_DELETE', success: true, userId: session.user.id, teamId: file.teamId, resourceType: 'file', resourceId: file.id, metadata: { key: file.key } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting file:', error)
    await logUserAction({ request, action: 'FILE_DELETE', success: false, errorMessage: error?.message ?? 'Internal server error' })
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions) as FilesSession | null
    if (!session?.user?.id) {
      await logUserAction({ request, action: 'FILE_MOVE', success: false, errorMessage: 'Unauthorized' })
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validated = moveSchema.parse(body)

    const file = await prisma.file.findUnique({ where: { id: validated.id }, include: { credential: true, bucket: true } })
    if (!file) {
      await logUserAction({ request, action: 'FILE_MOVE', success: false, userId: session.user.id, resourceType: 'file', resourceId: validated.id, errorMessage: 'File not found' })
      return NextResponse.json({ message: 'File not found' }, { status: 404 })
    }

    if (file.userId !== session.user.id) {
      const teamMember = await prisma.teamMember.findFirst({ where: { teamId: file.teamId!, userId: session.user.id, role: { name: { in: ['OWNER', 'ADMIN'] } } } })
      if (!teamMember) {
        await logUserAction({ request, action: 'FILE_MOVE', success: false, userId: session.user.id, teamId: file.teamId, resourceType: 'file', resourceId: file.id, errorMessage: 'Forbidden' })
        return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
      }
    }

    const { config, errorResponse } = await decryptConfigOrError({ request, action: 'FILE_MOVE', userId: session.user.id, teamId: file.teamId, resourceType: 'file', resourceId: file.id, credential: file.credential, bucket: file.bucket })
    if (errorResponse) return errorResponse

    const newKey = buildS3Key(validated.newPath, file.name)
    await copyS3Object(config, file.key, newKey, true)

    await prisma.file.update({ where: { id: validated.id }, data: { key: newKey, parentPath: validated.newPath } })

    publishFileChanged(file.teamId!, { bucketId: file.bucketId, action: 'moved', key: newKey })

    await logUserAction({ request, action: 'FILE_MOVE', success: true, userId: session.user.id, teamId: file.teamId, resourceType: 'file', resourceId: file.id, metadata: { oldKey: file.key, newKey, newPath: validated.newPath } })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error moving file:', error)
    await logUserAction({ request, action: 'FILE_MOVE', success: false, errorMessage: error?.message ?? 'Internal server error' })
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: error.errors[0].message }, { status: 400 })
    }
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
