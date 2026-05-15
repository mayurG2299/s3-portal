import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logUserAction } from '@/lib/audit'
import { canAccessTeam } from '@/lib/permissions'
import { type HandlerContext, toggleFavoriteSchema, updateTagsSchema, normalizeTags } from './shared'

const prismaAny = prisma as any

export async function handleToggleFavorite({ session, body }: HandlerContext) {
  const validated = toggleFavoriteSchema.parse(body)

  const file = await prisma.file.findUnique({ where: { id: validated.id } })
  if (!file) {
    return NextResponse.json({ message: 'File not found' }, { status: 404 })
  }

  const isMember = await canAccessTeam(session.user.id, file.teamId!)
  if (!isMember) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  }

  const existing = await prismaAny.fileFavorite.findUnique({
    where: { userId_fileId: { userId: session.user.id, fileId: validated.id } },
  })

  if (existing) {
    await prismaAny.fileFavorite.delete({ where: { id: existing.id } })
    return NextResponse.json({ id: validated.id, isFavorite: false })
  }

  await prismaAny.fileFavorite.create({ data: { userId: session.user.id, fileId: validated.id } })
  return NextResponse.json({ id: validated.id, isFavorite: true })
}

export async function handleUpdateTags({ request, session, body }: HandlerContext) {
  const validated = updateTagsSchema.parse(body)

  const file = await prisma.file.findUnique({ where: { id: validated.id }, include: { credential: true } })
  if (!file) {
    return NextResponse.json({ message: 'File not found' }, { status: 404 })
  }

  const canEdit = await canAccessTeam(session.user.id, file.teamId!)
  if (!canEdit) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 })
  }

  const normalizedTags = normalizeTags(validated.tags)
  const normalizedDescription = validated.description?.trim() || null

  const updated = await prisma.file.update({
    where: { id: validated.id },
    data: { tags: normalizedTags, description: normalizedDescription },
    select: { id: true, tags: true, description: true },
  } as any)

  await logUserAction({ request, action: 'FILE_TAG_UPDATE', success: true, userId: session.user.id, teamId: file.teamId, resourceType: 'file', resourceId: file.id, metadata: { tags: normalizedTags } })

  return NextResponse.json(updated)
}
