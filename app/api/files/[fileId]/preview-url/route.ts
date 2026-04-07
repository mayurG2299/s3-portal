import { NextRequest, NextResponse } from 'next/server'
import type { RouteContext } from "@/types/next-route-context";
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { decryptAWSConfig, generatePresignedDownloadUrl, generateCloudfrontSignedUrl } from '@/lib/aws'
import { ApiResponse } from '@/lib/api-utils'
import { allowRequest } from '@/lib/rate-limiter'
import { logUserAction } from '@/lib/audit'
import { requireScreenPermission } from '@/lib/api-utils'
import { canAccessBucket } from '@/lib/bucket-access'

// Rate limiting is handled by `lib/rate-limiter` which uses Redis when available

export async function GET(
  request: NextRequest,
  context: RouteContext<{ fileId: string }>,
) {
  try {
    const { fileId } = await context.params;

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const identifier = session.user.id
      ? `user:${session.user.id}`
      : `ip:${request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "anonymous"}`;

    const allowed = await allowRequest(`preview_url:${identifier}`, 60, 60);
    if (!allowed) {
      await logUserAction({
        request,
        action: "FILE_PREVIEW",
        success: false,
        userId: session.user.id,
        resourceType: "file",
        resourceId: fileId,
        errorMessage: "Rate limited",
      });
      return ApiResponse.error("Too many requests", 429);
    }

    const file = await prisma.file.findUnique({
      where: { id: fileId },
      include: { credential: true, bucket: true },
    });

    if (!file) {
      await logUserAction({
        request,
        action: "FILE_PREVIEW",
        success: false,
        userId: session.user.id,
        resourceType: "file",
        resourceId: fileId,
        errorMessage: "File not found",
      });
      return NextResponse.json({ message: "File not found" }, { status: 404 });
    }

    // Permission: owner or team member
    if (file.userId !== session.user.id) {
      if (!file.teamId) {
        await logUserAction({
          request,
          action: "FILE_PREVIEW",
          success: false,
          userId: session.user.id,
          resourceType: "file",
          resourceId: fileId,
          errorMessage: "Forbidden",
        });
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
      }

      const member = await prisma.teamMember.findFirst({
        where: { teamId: file.teamId, userId: session.user.id || "" },
      });
      if (!member) {
        await logUserAction({
          request,
          action: "FILE_PREVIEW",
          success: false,
          userId: session.user.id,
          resourceType: "file",
          resourceId: fileId,
          errorMessage: "Forbidden",
        });
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
      }
    }

    // Personal-scope files (teamId null) bypass bucket restriction intentionally
    if (file.teamId && file.bucketId) {
      const allowed = await canAccessBucket(session.user.id, file.teamId, file.bucketId)
      if (!allowed) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Check FILES_LIST VIEW permission
    if (file.teamId) {
      try {
        await requireScreenPermission(
          session,
          file.teamId,
          "FILES_LIST",
          "VIEW",
        );
      } catch (err) {
        await logUserAction({
          request,
          action: "FILE_PREVIEW",
          success: false,
          userId: session.user.id,
          resourceType: "file",
          resourceId: fileId,
          errorMessage: "Forbidden by screen permission",
        });
        return NextResponse.json({ message: "Forbidden" }, { status: 403 });
      }
    }

    const config = decryptAWSConfig(file.credential as any, file.bucket as any);

    const ttlSeconds = 60 * 15; // 15 minutes
    const previewUrl =
      file.bucket.cloudfrontDomain && file.bucket.cloudfrontKeyPairId
        ? generateCloudfrontSignedUrl(config, file.key, ttlSeconds)
        : await generatePresignedDownloadUrl(config, file.key, ttlSeconds);

    await logUserAction({
      request,
      action: "FILE_PREVIEW",
      success: true,
      userId: session.user.id,
      resourceType: "file",
      resourceId: fileId,
      teamId: file.teamId,
    });

    return ApiResponse.success({
      url: previewUrl,
      contentType: file.contentType || "application/octet-stream",
      fileName: file.name,
      fileSize: file.size.toString(),
    });
  } catch (error: any) {
    console.error("Error generating preview URL:", error);
    await logUserAction({
      request,
      action: "FILE_PREVIEW_URL",
      success: false,
      errorMessage: error?.message || "Internal server error",
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
