import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logUserAction } from '@/lib/audit'
import { decrypt, encrypt } from '@/lib/crypto'
import { validateAWSCredentials, validateBucketAccess } from '@/lib/aws'
import { canModifyCredential, canAccessCredential } from '@/lib/permissions'
import { checkAuth, ApiResponse } from '@/lib/api-utils'
import { z } from 'zod'

const bucketSchema = z.object({
  id: z.string().optional(),
  bucket: z.string().min(1, 'Bucket is required'),
  cloudfrontDomain: z.string().optional(),
  cloudfrontKeyPairId: z.string().optional(),
  cloudfrontPrivateKey: z.string().optional(),
})

const credentialSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  accessKey: z.string().min(1, 'Access key is required'),
  secretKey: z.string().min(1, 'Secret key is required'),
  region: z.string().min(1, 'Region is required'),
  teamId: z.string().optional(),
  buckets: z.array(bucketSchema).min(1, 'At least one bucket is required'),
})

const credentialUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  accessKey: z.string().min(1).optional(),
  secretKey: z.string().min(1).optional(),
  region: z.string().min(1).optional(),
  buckets: z.array(bucketSchema).optional(),
})

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const { error, auth } = checkAuth(session)
    if (error) {
      await logUserAction({
        request,
        action: 'CREDENTIAL_CREATE',
        success: false,
        errorMessage: 'Unauthorized',
      })
      return error
    }

    const { searchParams } = new URL(request.url)
    const requestedTeamId = searchParams.get('teamId') || auth!.teamId

    // If requesting a team other than your primary, check membership
    if (requestedTeamId && requestedTeamId !== auth!.teamId) {
      const membership = await prisma.teamMember.findFirst({
        where: {
          userId: auth!.userId,
          teamId: requestedTeamId,
        },
      })
      if (!membership) {
        return ApiResponse.forbidden()
      }
    }

    // Get credentials for the requested team
    const credentials = await prisma.aWSCredential.findMany({
      where: {
        teamId: requestedTeamId || null,
        ...(requestedTeamId
          ? {
              team: {
                members: {
                  some: {
                    userId: auth!.userId,
                  },
                },
              },
            }
          : { userId: auth!.userId }),
      },
      select: {
        id: true,
        name: true,
        region: true,
        teamId: true,
        createdAt: true,
        buckets: {
          select: {
            id: true,
            bucket: true,
            cloudfrontDomain: true,
            cloudfrontKeyPairId: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        team: {
          select: {
            name: true,
          },
        },
        user: {
          select: {
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return ApiResponse.success(credentials)
  } catch (error) {
    console.error('Error fetching credentials:', error)
    return ApiResponse.error('Internal server error')
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const { error, auth } = checkAuth(session)
    if (error) return error

    // Check if user is admin for team credentials, or viewer for personal
    if (!auth!.roleId) {
      await logUserAction({
        request,
        action: 'CREDENTIAL_CREATE',
        success: false,
        userId: auth!.userId,
        errorMessage: 'Forbidden',
      })
      return ApiResponse.forbidden()
    }

    const body = await request.json()
    const validated = credentialSchema.parse(body)

    const normalizedBuckets = validated.buckets.map((bucket) => ({
      id: bucket.id,
      bucket: bucket.bucket.trim().toLowerCase(),
      cloudfrontDomain: bucket.cloudfrontDomain?.trim() || undefined,
      cloudfrontKeyPairId: bucket.cloudfrontKeyPairId?.trim() || undefined,
      cloudfrontPrivateKey: bucket.cloudfrontPrivateKey?.trim() || undefined,
    }))

    const bucketNames = new Set(normalizedBuckets.map((bucket) => bucket.bucket))
    if (bucketNames.size !== normalizedBuckets.length) {
      return ApiResponse.validationError('Bucket names must be unique per credential')
    }

    // If adding to team, check if user is admin in that team
    if (validated.teamId) {
      const team = await prisma.team.findUnique({
        where: { id: validated.teamId },
        include: {
          members: {
            where: { userId: auth!.userId },
            include: { role: true },
          },
        },
      })

      if (!team || team.members.length === 0) {
        await logUserAction({
          request,
          action: 'CREDENTIAL_CREATE',
          success: false,
          userId: auth!.userId,
          teamId: validated.teamId,
          errorMessage: 'Team not found or access denied',
        })
        return ApiResponse.error('Team not found or access denied', 403)
      }

      if (
        team.members[0].role.name !== 'ADMIN' &&
        team.members[0].role.name !== 'OWNER'
      ) {
        await logUserAction({
          request,
          action: 'CREDENTIAL_CREATE',
          success: false,
          userId: auth!.userId,
          teamId: validated.teamId,
          errorMessage: 'Only admins can add credentials to teams',
        })
        return ApiResponse.error(
          'Only admins can add credentials to teams',
          403
        )
      }
    }

    // Validate AWS credentials before storing
    const validation = await validateAWSCredentials({
      accessKeyId: validated.accessKey,
      secretAccessKey: validated.secretKey,
      region: validated.region,
      bucket: normalizedBuckets[0].bucket,
    })

    if (!validation.valid) {
      await logUserAction({
        request,
        action: 'CREDENTIAL_CREATE',
        success: false,
        userId: auth!.userId,
        teamId: validated.teamId,
        errorMessage: validation.error || 'Invalid AWS credentials',
      })
      return ApiResponse.validationError(
        validation.error || 'Invalid AWS credentials'
      )
    }

    for (const bucket of normalizedBuckets) {
      const bucketValidation = await validateBucketAccess({
        accessKeyId: validated.accessKey,
        secretAccessKey: validated.secretKey,
        region: validated.region,
        bucket: bucket.bucket,
      })

      if (!bucketValidation.valid) {
        await logUserAction({
          request,
          action: 'CREDENTIAL_CREATE',
          success: false,
          userId: auth!.userId,
          teamId: validated.teamId,
          errorMessage: bucketValidation.error || 'Bucket access denied',
        })
        return ApiResponse.validationError(
          bucketValidation.error || 'Bucket access denied'
        )
      }
    }

    // Encrypt credentials
    const encryptedAccessKey = encrypt(validated.accessKey)
    const encryptedSecretKey = encrypt(validated.secretKey)

    // Create credential
    const credential = await prisma.aWSCredential.create({
      data: {
        name: validated.name,
        encryptedAccessKey,
        encryptedSecretKey,
        region: validated.region,
        userId: auth!.userId,
        teamId: validated.teamId,
        buckets: {
          create: normalizedBuckets.map((bucket) => ({
            bucket: bucket.bucket,
            cloudfrontDomain: bucket.cloudfrontDomain || null,
            cloudfrontKeyPairId: bucket.cloudfrontKeyPairId || null,
            encryptedCloudfrontPrivateKey: bucket.cloudfrontPrivateKey
              ? encrypt(bucket.cloudfrontPrivateKey)
              : null,
          })),
        },
      },
      select: {
        id: true,
        name: true,
        region: true,
        createdAt: true,
        buckets: {
          select: {
            id: true,
            bucket: true,
            cloudfrontDomain: true,
            cloudfrontKeyPairId: true,
          },
        },
      },
    })

    await logUserAction({
      request,
      action: 'CREDENTIAL_CREATE',
      success: true,
      userId: auth!.userId,
      teamId: validated.teamId,
      resourceType: 'credential',
      resourceId: credential.id,
      metadata: {
        name: credential.name,
        region: credential.region,
        buckets: credential.buckets.map((bucket) => bucket.bucket),
      },
    })

    return ApiResponse.success(credential, 201)
  } catch (error: any) {
    console.error('Error creating credential:', error)

    await logUserAction({
      request,
      action: 'CREDENTIAL_CREATE',
      success: false,
      errorMessage: error?.message ?? 'Internal server error',
    })

    if (error instanceof z.ZodError) {
      return ApiResponse.validationError(error.errors[0].message)
    }

    return ApiResponse.error('Internal server error')
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const { error, auth } = checkAuth(session)
    if (error) return error

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      await logUserAction({
        request,
        action: 'CREDENTIAL_UPDATE',
        success: false,
        userId: auth!.userId,
        errorMessage: 'Credential ID is required',
      })
      return ApiResponse.validationError('Credential ID is required')
    }

    const canModify = await canModifyCredential(auth!.userId, id)
    if (!canModify) {
      await logUserAction({
        request,
        action: 'CREDENTIAL_UPDATE',
        success: false,
        userId: auth!.userId,
        resourceType: 'credential',
        resourceId: id,
        errorMessage: 'Forbidden',
      })
      return ApiResponse.forbidden()
    }

    const body = await request.json()
    const validated = credentialUpdateSchema.parse(body)

    if ((validated.accessKey && !validated.secretKey) || (!validated.accessKey && validated.secretKey)) {
      return ApiResponse.validationError('Access key and secret key must be provided together')
    }

    const existing = await prisma.aWSCredential.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        encryptedAccessKey: true,
        encryptedSecretKey: true,
        region: true,
        teamId: true,
        buckets: {
          select: {
            id: true,
            bucket: true,
            cloudfrontDomain: true,
            cloudfrontKeyPairId: true,
            encryptedCloudfrontPrivateKey: true,
          },
        },
      },
    })

    if (!existing) {
      return ApiResponse.notFound()
    }

    const nextAccessKey = validated.accessKey ?? decrypt(existing.encryptedAccessKey)
    const nextSecretKey = validated.secretKey ?? decrypt(existing.encryptedSecretKey)
    const nextRegion = validated.region ?? existing.region
    const bucketsInput = validated.buckets?.map((bucket) => ({
      id: bucket.id,
      bucket: bucket.bucket.trim().toLowerCase(),
      cloudfrontDomain: bucket.cloudfrontDomain?.trim() || undefined,
      cloudfrontKeyPairId: bucket.cloudfrontKeyPairId?.trim() || undefined,
      cloudfrontPrivateKey: bucket.cloudfrontPrivateKey?.trim() || undefined,
    }))

    if (bucketsInput) {
      if (bucketsInput.length === 0) {
        return ApiResponse.validationError('At least one bucket is required')
      }
      const bucketNames = new Set(bucketsInput.map((bucket) => bucket.bucket))
      if (bucketNames.size !== bucketsInput.length) {
        return ApiResponse.validationError('Bucket names must be unique per credential')
      }

      const existingBucketIds = new Set(existing.buckets.map((bucket) => bucket.id))
      const invalidBucket = bucketsInput.find(
        (bucket) => bucket.id && !existingBucketIds.has(bucket.id)
      )
      if (invalidBucket) {
        return ApiResponse.validationError('Invalid bucket id for this credential')
      }
    }

    const shouldValidateCredentials =
      validated.accessKey !== undefined ||
      validated.secretKey !== undefined ||
      validated.region !== undefined

    if (shouldValidateCredentials) {
      const validation = await validateAWSCredentials({
        accessKeyId: nextAccessKey,
        secretAccessKey: nextSecretKey,
        region: nextRegion,
        bucket: (bucketsInput?.[0]?.bucket ?? existing.buckets[0]?.bucket) || '',
      })

      if (!validation.valid) {
        await logUserAction({
          request,
          action: 'CREDENTIAL_UPDATE',
          success: false,
          userId: auth!.userId,
          teamId: existing.teamId,
          resourceType: 'credential',
          resourceId: id,
          errorMessage: validation.error || 'Invalid AWS credentials',
        })
        return ApiResponse.validationError(
          validation.error || 'Invalid AWS credentials'
        )
      }
    }

    const bucketsToValidate = bucketsInput ??
      existing.buckets.map((bucket) => ({
        bucket: bucket.bucket,
        cloudfrontDomain: bucket.cloudfrontDomain || undefined,
        cloudfrontKeyPairId: bucket.cloudfrontKeyPairId || undefined,
        cloudfrontPrivateKey: undefined,
      }))

    if (shouldValidateCredentials || bucketsInput) {
      for (const bucket of bucketsToValidate) {
        const bucketValidation = await validateBucketAccess({
          accessKeyId: nextAccessKey,
          secretAccessKey: nextSecretKey,
          region: nextRegion,
          bucket: bucket.bucket,
        })

        if (!bucketValidation.valid) {
          await logUserAction({
            request,
            action: 'CREDENTIAL_UPDATE',
            success: false,
            userId: auth!.userId,
            teamId: existing.teamId,
            resourceType: 'credential',
            resourceId: id,
            errorMessage: bucketValidation.error || 'Bucket access denied',
          })
          return ApiResponse.validationError(
            bucketValidation.error || 'Bucket access denied'
          )
        }
      }
    }

    const data: Record<string, any> = {}

    if (validated.name !== undefined) data.name = validated.name
    if (validated.accessKey !== undefined) data.encryptedAccessKey = encrypt(validated.accessKey)
    if (validated.secretKey !== undefined) data.encryptedSecretKey = encrypt(validated.secretKey)
    if (validated.region !== undefined) data.region = validated.region

    if (Object.keys(data).length === 0 && !bucketsInput) {
      return ApiResponse.validationError('No changes provided')
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) {
        await tx.aWSCredential.update({
          where: { id },
          data,
        })
      }

      if (bucketsInput) {
        for (const bucket of bucketsInput) {
          if (bucket.id) {
            await tx.awsBucket.update({
              where: { id: bucket.id },
              data: {
                bucket: bucket.bucket,
                cloudfrontDomain: bucket.cloudfrontDomain || null,
                cloudfrontKeyPairId: bucket.cloudfrontKeyPairId || null,
                ...(bucket.cloudfrontPrivateKey !== undefined
                  ? {
                      encryptedCloudfrontPrivateKey: bucket.cloudfrontPrivateKey
                        ? encrypt(bucket.cloudfrontPrivateKey)
                        : null,
                    }
                  : {}),
              },
            })
          } else {
            await tx.awsBucket.create({
              data: {
                credentialId: id,
                bucket: bucket.bucket,
                cloudfrontDomain: bucket.cloudfrontDomain || null,
                cloudfrontKeyPairId: bucket.cloudfrontKeyPairId || null,
                encryptedCloudfrontPrivateKey: bucket.cloudfrontPrivateKey
                  ? encrypt(bucket.cloudfrontPrivateKey)
                  : null,
              },
            })
          }
        }
      }

      return tx.aWSCredential.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          region: true,
          createdAt: true,
          buckets: {
            select: {
              id: true,
              bucket: true,
              cloudfrontDomain: true,
              cloudfrontKeyPairId: true,
            },
          },
        },
      })
    })

    if (!updated) {
      return ApiResponse.notFound()
    }

    await logUserAction({
      request,
      action: 'CREDENTIAL_UPDATE',
      success: true,
      userId: auth!.userId,
      teamId: existing.teamId,
      resourceType: 'credential',
      resourceId: id,
      metadata: {
        name: updated.name,
        region: updated.region,
        buckets: updated.buckets.map((bucket) => bucket.bucket),
      },
    })

    return ApiResponse.success(updated)
  } catch (error: any) {
    console.error('Error updating credential:', error)

    await logUserAction({
      request,
      action: 'CREDENTIAL_UPDATE',
      success: false,
      errorMessage: error?.message ?? 'Internal server error',
    })

    if (error instanceof z.ZodError) {
      return ApiResponse.validationError(error.errors[0].message)
    }

    return ApiResponse.error('Internal server error')
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const { error, auth } = checkAuth(session)
    if (error) {
      await logUserAction({
        request,
        action: 'CREDENTIAL_DELETE',
        success: false,
        errorMessage: 'Unauthorized',
      })
      return error
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      await logUserAction({
        request,
        action: 'CREDENTIAL_DELETE',
        success: false,
        userId: auth!.userId,
        errorMessage: 'Credential ID is required',
      })
      return ApiResponse.validationError('Credential ID is required')
    }

    // Check if user can modify this credential
    const canModify = await canModifyCredential(auth!.userId, id)
    if (!canModify) {
      await logUserAction({
        request,
        action: 'CREDENTIAL_DELETE',
        success: false,
        userId: auth!.userId,
        resourceType: 'credential',
        resourceId: id,
        errorMessage: 'Forbidden',
      })
      return ApiResponse.forbidden()
    }

    await prisma.aWSCredential.delete({
      where: { id },
    })

    await logUserAction({
      request,
      action: 'CREDENTIAL_DELETE',
      success: true,
      userId: auth!.userId,
      resourceType: 'credential',
      resourceId: id,
    })

    return ApiResponse.success({ success: true })
  } catch (error: any) {
    console.error('Error deleting credential:', error)
    await logUserAction({
      request,
      action: 'CREDENTIAL_DELETE',
      success: false,
      errorMessage: error?.message ?? 'Internal server error',
    })
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
