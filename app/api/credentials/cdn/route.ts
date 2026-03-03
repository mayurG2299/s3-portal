import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logUserAction } from '@/lib/audit'
import { encrypt } from '@/lib/crypto'
import { checkAuth, ApiResponse } from '@/lib/api-utils'
import { z } from 'zod'

const cdnUpdateSchema = z.object({
  bucketId: z.string().min(1, 'Bucket ID is required'),
  cloudfrontDomain: z.string().min(1, 'CloudFront domain is required'),
  cloudfrontKeyPairId: z.string().min(1, 'Key pair ID is required'),
  cloudfrontPrivateKey: z.string().min(1, 'Private key is required'),
})

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const { error, auth } = checkAuth(session)
    if (error) return error

    const body = await request.json()
    const validated = cdnUpdateSchema.parse(body)

    // Lookup the bucket and ensure the user has access to its parent credential
    const bucket = await prisma.awsBucket.findUnique({
      where: { id: validated.bucketId },
      include: {
        credential: {
          include: {
            team: {
              include: {
                members: {
                  where: { userId: auth!.userId },
                },
              },
            },
          },
        },
      },
    })

    if (!bucket) {
      return ApiResponse.notFound('Bucket not found')
    }

    // Auth check: Must be personal credential or user must be Team Admin/Owner
    const isPersonal = bucket.credential.userId === auth!.userId
    const teamRole = bucket.credential.team?.members[0]?.roleId // simplistic check, assumes roles are matched in logic elsewhere
    
    // In Settings we use canModifyCredential which checks team admin roles. Let's do a strict check:
    let canModify = isPersonal
    if (!isPersonal && bucket.credential.teamId) {
       const teamMembership = await prisma.teamMember.findFirst({
         where: { teamId: bucket.credential.teamId, userId: auth!.userId },
         include: { role: true }
       })
       if (teamMembership && (teamMembership.role.name === 'ADMIN' || teamMembership.role.name === 'OWNER')) {
         canModify = true
       }
    }

    if (!canModify) {
      await logUserAction({
        request,
        action: 'CREDENTIAL_UPDATE',
        success: false,
        userId: auth!.userId,
        resourceType: 'credential',
        resourceId: bucket.credential.id,
        errorMessage: 'Forbidden: Insufficient permissions to modify this bucket',
      })
      return ApiResponse.forbidden()
    }

    // Basic validation of PEM private key format
    const isPem = validated.cloudfrontPrivateKey.includes('-----BEGIN RSA PRIVATE KEY-----') || 
                  validated.cloudfrontPrivateKey.includes('-----BEGIN PRIVATE KEY-----')
    if (!isPem) {
      return ApiResponse.validationError('Private key must be in PEM format (starting with -----BEGIN ... PRIVATE KEY-----)')
    }

    // Encrypt the private key
    const encryptedCloudfrontPrivateKey = encrypt(validated.cloudfrontPrivateKey.trim())

    // Update the bucket record
    const updatedBucket = await prisma.awsBucket.update({
      where: { id: validated.bucketId },
      data: {
        cloudfrontDomain: validated.cloudfrontDomain.trim(),
        cloudfrontKeyPairId: validated.cloudfrontKeyPairId.trim(),
        encryptedCloudfrontPrivateKey,
      },
      select: {
        id: true,
        bucket: true,
        cloudfrontDomain: true,
        cloudfrontKeyPairId: true,
      }
    })

    await logUserAction({
      request,
      action: 'CREDENTIAL_UPDATE',
      success: true,
      userId: auth!.userId,
      resourceType: 'credential',
      resourceId: bucket.credential.id,
      metadata: {
        note: `Attached CDN to bucket ${updatedBucket.bucket}`,
        cloudfrontDomain: updatedBucket.cloudfrontDomain,
      },
    })

    return ApiResponse.success(updatedBucket)

  } catch (error: any) {
    console.error('Error updating CDN credentials:', error)
    
    if (error instanceof z.ZodError) {
      return ApiResponse.validationError(error.errors[0].message)
    }

    return ApiResponse.error('Internal server error')
  }
}
