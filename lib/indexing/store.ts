import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'

export async function setProcessing(fileId: string): Promise<void> {
  await prisma.fileEmbedding.upsert({
    where: { fileId },
    create: { fileId, status: 'PROCESSING' },
    update: { status: 'PROCESSING', errorMessage: null },
  })
}

export async function setDone(fileId: string, summary: string, embedding: number[]): Promise<void> {
  // embedding is number[] from OpenAI — all floats, no SQL injection risk
  const vectorStr = `[${embedding.join(',')}]`
  await prisma.$executeRaw`
    UPDATE "FileEmbedding"
    SET summary = ${summary},
        status = 'DONE'::"IndexingStatus",
        embedding = ${Prisma.raw(`'${vectorStr}'::vector`)},
        "processedAt" = NOW(),
        "updatedAt" = NOW()
    WHERE "fileId" = ${fileId}
  `
}

export async function setFailed(fileId: string, errorMessage: string): Promise<void> {
  await prisma.fileEmbedding.update({
    where: { fileId },
    data: { status: 'FAILED', errorMessage },
  })
}

export async function upsertPending(fileId: string): Promise<void> {
  await prisma.fileEmbedding.upsert({
    where: { fileId },
    create: { fileId, status: 'PENDING' },
    update: { status: 'PENDING', errorMessage: null },
  })
}

export async function getPendingFileIds(limit = 50): Promise<string[]> {
  const rows = await prisma.fileEmbedding.findMany({
    where: { status: { in: ['PENDING', 'FAILED'] } },
    select: { fileId: true },
    take: limit,
    orderBy: { createdAt: 'asc' },
  })
  return rows.map((r) => r.fileId)
}
