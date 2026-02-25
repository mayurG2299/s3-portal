import {
  S3Client,
  PutObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
  HeadObjectCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts'
import { getSignedUrl as getCloudfrontSignedUrl } from '@aws-sdk/cloudfront-signer'
import { decrypt } from './crypto'

export interface AWSConfig {
  accessKeyId: string
  secretAccessKey: string
  region: string
  bucket: string
  cloudfrontDomain?: string
  cloudfrontKeyPairId?: string
  cloudfrontPrivateKey?: string
}

export interface PresignedUploadURL {
  url: string
  key: string
  fields?: Record<string, string>
}

export interface S3Object {
  key: string
  size: number
  lastModified: Date
  etag?: string
  contentType?: string
}

export interface S3ListResult {
  objects: S3Object[]
  prefixes: string[]
}

/**
 * Decrypt and return AWS config from encrypted credentials
 */
export function decryptAWSConfig(
  credential: {
  encryptedAccessKey: string
  encryptedSecretKey: string
  region: string
  },
  bucket: {
    bucket: string
    cloudfrontDomain?: string | null
    cloudfrontKeyPairId?: string | null
    encryptedCloudfrontPrivateKey?: string | null
  }
): AWSConfig {
  return {
    accessKeyId: decrypt(credential.encryptedAccessKey),
    secretAccessKey: decrypt(credential.encryptedSecretKey),
    region: credential.region,
    bucket: bucket.bucket,
    cloudfrontDomain: bucket.cloudfrontDomain || undefined,
    cloudfrontKeyPairId: bucket.cloudfrontKeyPairId || undefined,
    cloudfrontPrivateKey: bucket.encryptedCloudfrontPrivateKey
      ? decrypt(bucket.encryptedCloudfrontPrivateKey)
      : undefined,
  }
}

/**
 * Create S3 client with decrypted credentials
 */
export function createS3Client(config: AWSConfig): S3Client {
  return new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    requestChecksumCalculation: 'NEVER',
    responseChecksumValidation: 'NEVER',
  } as any)
}

/**
 * Validate AWS credentials by making a test call
 */
export async function validateAWSCredentials(
  config: AWSConfig
): Promise<{ valid: boolean; accountId?: string; error?: string }> {
  try {
    const stsClient = new STSClient({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    })

    const command = new GetCallerIdentityCommand({})
    const response = await stsClient.send(command)

    return {
      valid: true,
      accountId: response.Account,
    }
  } catch (error: any) {
    return {
      valid: false,
      error: error.message || 'Invalid credentials',
    }
  }
}

/**
 * Validate that credentials can access the specified bucket
 */
export async function validateBucketAccess(
  config: AWSConfig
): Promise<{ valid: boolean; error?: string }> {
  try {
    const client = createS3Client(config)
    await client.send(
      new HeadBucketCommand({
        Bucket: config.bucket,
      })
    )

    return { valid: true }
  } catch (error: any) {
    return {
      valid: false,
      error: error?.message || 'Bucket access denied',
    }
  }
}

/**
 * Generate presigned URL for direct browser upload to S3
 */
export async function generatePresignedUploadUrl(
  config: AWSConfig,
  key: string,
  contentType?: string,
  expiresIn: number = 3600
): Promise<PresignedUploadURL> {
  const client = createS3Client(config)

  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    ContentType: contentType || undefined,
  })

  const url = await getSignedUrl(client, command, { expiresIn })

  return { url, key }
}

/**
 * Multipart upload helpers
 */

export async function initMultipartUpload(
  config: AWSConfig,
  key: string,
  contentType?: string
): Promise<{ uploadId: string }> {
  const client = createS3Client(config)
  const cmd = new CreateMultipartUploadCommand({
    Bucket: config.bucket,
    Key: key,
    ContentType: contentType,
  })
  const res = await client.send(cmd)
  return { uploadId: res.UploadId! }
}

export async function getPresignedUploadPartUrl(
  config: AWSConfig,
  key: string,
  uploadId: string,
  partNumber: number,
  expiresIn: number = 3600
): Promise<string> {
  const client = createS3Client(config)
  const cmd = new UploadPartCommand({
    Bucket: config.bucket,
    Key: key,
    UploadId: uploadId,
    PartNumber: partNumber,
    Body: undefined as any, // Body is set by browser PUT request
  })
  return await getSignedUrl(client, cmd, { expiresIn })
}

export async function completeMultipartUpload(
  config: AWSConfig,
  key: string,
  uploadId: string,
  parts: Array<{ ETag: string; PartNumber: number }>
): Promise<void> {
  const client = createS3Client(config)
  const cmd = new CompleteMultipartUploadCommand({
    Bucket: config.bucket,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: { Parts: parts }
  })
  await client.send(cmd)
}

export async function abortMultipartUpload(
  config: AWSConfig,
  key: string,
  uploadId: string
): Promise<void> {
  const client = createS3Client(config)
  const cmd = new AbortMultipartUploadCommand({
    Bucket: config.bucket,
    Key: key,
    UploadId: uploadId,
  })
  await client.send(cmd)
}

/**
 * Generate presigned URL for downloading from S3
 */
export async function generatePresignedDownloadUrl(
  config: AWSConfig,
  key: string,
  expiresIn: number = 3600,
  downloadFilename?: string
): Promise<string> {
  const client = createS3Client(config)

  const command = new GetObjectCommand({
    Bucket: config.bucket,
    Key: key,
    ResponseContentDisposition: downloadFilename
      ? `attachment; filename="${downloadFilename}"`
      : undefined,
  })

  return await getSignedUrl(client, command, { expiresIn })
}

/**
 * Generate CloudFront signed URL (for CDN)
 */
export function generateCloudfrontSignedUrl(
  config: AWSConfig,
  key: string,
  expiresIn: number = 3600
): string {
  if (
    !config.cloudfrontDomain ||
    !config.cloudfrontKeyPairId ||
    !config.cloudfrontPrivateKey
  ) {
    throw new Error('CloudFront configuration is incomplete')
  }

  const url = `https://${config.cloudfrontDomain}/${key}`
  const dateNow = new Date()
  const dateLessThan = new Date(dateNow.getTime() + expiresIn * 1000)

  return getCloudfrontSignedUrl({
    url,
    keyPairId: config.cloudfrontKeyPairId,
    privateKey: config.cloudfrontPrivateKey,
    dateLessThan: dateLessThan.toISOString(),
  })
}

/**
 * List objects in S3 bucket with prefix
 */
export async function listS3Objects(
  config: AWSConfig,
  prefix: string = '',
  maxKeys: number = 1000
): Promise<S3Object[]> {
  const client = createS3Client(config)

  const command = new ListObjectsV2Command({
    Bucket: config.bucket,
    Prefix: prefix,
    MaxKeys: maxKeys,
  })

  const response = await client.send(command)

  return (
    response.Contents?.map((item) => ({
      key: item.Key!,
      size: item.Size || 0,
      lastModified: item.LastModified || new Date(),
      etag: item.ETag,
    })) || []
  )
}

/**
 * List objects with common prefixes (folder-like) for a path
 */
export async function listS3ObjectsWithPrefixes(
  config: AWSConfig,
  prefix: string = '',
  delimiter: string = '/',
  maxKeys: number = 1000
): Promise<S3ListResult> {
  const client = createS3Client(config)

  const objects: S3Object[] = []
  const prefixes = new Set<string>()

  let continuationToken: string | undefined

  do {
    const command = new ListObjectsV2Command({
      Bucket: config.bucket,
      Prefix: prefix,
      Delimiter: delimiter,
      MaxKeys: maxKeys,
      ContinuationToken: continuationToken,
    })

    const response = await client.send(command)

    response.Contents?.forEach((item) => {
      if (!item.Key) return
      objects.push({
        key: item.Key,
        size: item.Size || 0,
        lastModified: item.LastModified || new Date(),
        etag: item.ETag,
      })
    })

    response.CommonPrefixes?.forEach((item) => {
      if (item.Prefix) prefixes.add(item.Prefix)
    })

    continuationToken = response.IsTruncated
      ? response.NextContinuationToken
      : undefined
  } while (continuationToken)

  return { objects, prefixes: Array.from(prefixes) }
}

/**
 * Delete object from S3
 */
export async function deleteS3Object(
  config: AWSConfig,
  key: string
): Promise<void> {
  const client = createS3Client(config)

  const command = new DeleteObjectCommand({
    Bucket: config.bucket,
    Key: key,
  })

  await client.send(command)
}

/**
 * Copy/Move object in S3
 */
export async function copyS3Object(
  config: AWSConfig,
  sourceKey: string,
  destKey: string,
  deleteSource: boolean = false
): Promise<void> {
  const client = createS3Client(config)

  // Copy object
  const copyCommand = new CopyObjectCommand({
    Bucket: config.bucket,
    CopySource: `${config.bucket}/${sourceKey}`,
    Key: destKey,
  })

  await client.send(copyCommand)

  // Delete source if moving
  if (deleteSource) {
    await deleteS3Object(config, sourceKey)
  }
}

/**
 * Get object metadata from S3
 */
export async function getS3ObjectMetadata(
  config: AWSConfig,
  key: string
): Promise<{
  size: number
  contentType?: string
  lastModified: Date
  etag?: string
}> {
  const client = createS3Client(config)

  const command = new HeadObjectCommand({
    Bucket: config.bucket,
    Key: key,
  })

  const response = await client.send(command)

  return {
    size: response.ContentLength || 0,
    contentType: response.ContentType,
    lastModified: response.LastModified || new Date(),
    etag: response.ETag,
  }
}
