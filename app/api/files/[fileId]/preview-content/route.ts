import { NextRequest } from 'next/server'
import { ApiResponse, requireScreenPermission } from '@/lib/api-utils'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { decryptAWSConfig, generatePresignedDownloadUrl, generateCloudfrontSignedUrl } from '@/lib/aws'
import { allowRequest } from '@/lib/rate-limiter'
import { logUserAction } from '@/lib/audit'

const MAX_BYTES = 1024 * 1024 // 1MB

export async function GET(request: NextRequest, { params }: { params: { fileId: string } }) {
  try {
    const { fileId } = params
    if (!fileId) return ApiResponse.validationError('fileId is required')

    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return ApiResponse.unauthorized()

    const identifier = session.user.id
      ? `user:${session.user.id}`
      : `ip:${request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'anonymous'}`

    const allowed = await allowRequest(`preview_content:${identifier}`, 20, 60)
    if (!allowed) {
      await logUserAction({ request, action: 'FILE_PREVIEW', success: false, userId: session.user.id, resourceType: 'file', resourceId: fileId, errorMessage: 'Rate limited' })
      return ApiResponse.error('Too many requests', 429)
    }

    const file = await prisma.file.findUnique({ where: { id: fileId }, include: { credential: true, bucket: true } })
    if (!file) {
      await logUserAction({ request, action: 'FILE_PREVIEW', success: false, userId: session.user.id, resourceType: 'file', resourceId: fileId, errorMessage: 'File not found' })
      return ApiResponse.notFound()
    }

    // Permission checks (owner or team member)
    if (file.userId !== session.user.id) {
      if (!file.teamId) {
        await logUserAction({ request, action: 'FILE_PREVIEW', success: false, userId: session.user.id, resourceType: 'file', resourceId: fileId, errorMessage: 'Forbidden' })
        return ApiResponse.forbidden()
      }

      const member = await prisma.teamMember.findFirst({ where: { teamId: file.teamId, userId: session.user.id } })
      if (!member) {
        await logUserAction({ request, action: 'FILE_PREVIEW', success: false, userId: session.user.id, resourceType: 'file', resourceId: fileId, errorMessage: 'Forbidden' })
        return ApiResponse.forbidden()
      }
    }

    if (file.teamId) {
      try {
        await requireScreenPermission(session, file.teamId, 'FILES_LIST', 'VIEW')
      } catch (err) {
        await logUserAction({ request, action: 'FILE_PREVIEW', success: false, userId: session.user.id, resourceType: 'file', resourceId: fileId, errorMessage: 'Forbidden by screen permission' })
        return ApiResponse.forbidden()
      }
    }

    const config = decryptAWSConfig(file.credential as any, file.bucket as any)
    const ttlSeconds = 60 * 5 // short-lived presign for server fetch
    const url = file.bucket.cloudfrontDomain && file.bucket.cloudfrontKeyPairId
      ? generateCloudfrontSignedUrl(config, file.key, ttlSeconds)
      : await generatePresignedDownloadUrl(config, file.key, ttlSeconds)

    // Server fetch the object and stream up to MAX_BYTES
    const res = await fetch(url)
    if (!res.ok) {
      await logUserAction({ request, action: 'FILE_PREVIEW', success: false, userId: session.user.id, resourceType: 'file', resourceId: fileId, errorMessage: `S3 fetch failed: ${res.status}` })
      return ApiResponse.error('Failed to fetch file for preview', 500)
    }

    const reader = res.body?.getReader()
    if (!reader) {
      await logUserAction({ request, action: 'FILE_PREVIEW', success: false, userId: session.user.id, resourceType: 'file', resourceId: fileId, errorMessage: 'No response body from S3' })
      return ApiResponse.error('No response body', 500)
    }

    const chunks: Uint8Array[] = []
    let received = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        received += value.length
        if (received > MAX_BYTES) {
          // close reader if possible
          try { reader.cancel() } catch (e) {}
          await logUserAction({ request, action: 'FILE_PREVIEW', success: false, userId: session.user.id, resourceType: 'file', resourceId: fileId, errorMessage: 'File too large for preview' })
          return ApiResponse.validationError('File too large to preview')
        }
        chunks.push(value)
      }
    }

    const total = new Uint8Array(received)
    let offset = 0
    for (const c of chunks) {
      total.set(c, offset)
      offset += c.length
    }

    const text = new TextDecoder('utf-8', { fatal: false }).decode(total)

    // If CSV, parse into rows server-side to avoid client-side parsing issues
    const isCsv = (file.contentType || '').toLowerCase().includes('csv') || file.name.toLowerCase().endsWith('.csv')
    if (isCsv) {
      // Simple CSV parser that supports quoted fields
      const parseCsv = (input: string): string[][] => {
        const rows: string[][] = []
        let cur: string[] = []
        let curField = ''
        let inQuotes = false
        for (let i = 0; i < input.length; i++) {
          const ch = input[i]
          if (inQuotes) {
            if (ch === '"') {
              if (input[i + 1] === '"') {
                curField += '"'
                i++
              } else {
                inQuotes = false
              }
            } else {
              curField += ch
            }
          } else {
            if (ch === '"') {
              inQuotes = true
            } else if (ch === ',') {
              cur.push(curField)
              curField = ''
            } else if (ch === '\n' || ch === '\r') {
              // handle CRLF
              if (ch === '\r' && input[i + 1] === '\n') i++
              cur.push(curField)
              rows.push(cur)
              cur = []
              curField = ''
            } else {
              curField += ch
            }
          }
        }
        // push last field/row
        if (inQuotes) {
          // unterminated quotes — treat as field
          cur.push(curField)
          rows.push(cur)
        } else if (curField !== '' || cur.length > 0) {
          cur.push(curField)
          rows.push(cur)
        }
        return rows
      }

      const rows = parseCsv(text)
      await logUserAction({ request, action: 'FILE_PREVIEW', success: true, userId: session.user.id, resourceType: 'file', resourceId: fileId, teamId: file.teamId })
      return ApiResponse.success({ csvRows: rows, contentType: file.contentType || 'text/csv', fileName: file.name, fileSize: file.size.toString() })
    }

    await logUserAction({ request, action: 'FILE_PREVIEW', success: true, userId: session.user.id, resourceType: 'file', resourceId: fileId, teamId: file.teamId })
    return ApiResponse.success({ text, contentType: file.contentType || 'text/plain', fileName: file.name, fileSize: file.size.toString() })
  } catch (error: any) {
    console.error('Error generating preview content:', error)
    await logUserAction({ request, action: 'FILE_PREVIEW', success: false, errorMessage: error?.message || 'Internal server error' })
    return ApiResponse.error('Internal server error')
  }
}
