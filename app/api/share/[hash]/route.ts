import { NextRequest, NextResponse } from 'next/server'
import type { RouteContext } from "@/types/next-route-context";
import { prisma } from '@/lib/db'
import { logUserAction } from '@/lib/audit'
import { decryptAWSConfig, generatePresignedDownloadUrl, generateCloudfrontSignedUrl } from '@/lib/aws'
import { verifyPassword } from '@/lib/crypto'
import { getPreviewType } from '@/lib/preview-utils'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'

export async function GET(
  request: NextRequest,
  context: RouteContext<{ hash: string }>,
) {
  try {
    const { hash } = await context.params;
    const { searchParams } = new URL(request.url);
    const password = searchParams.get("password");

    const link = await prisma.link.findUnique({
      where: { hash },
      include: {
        file: {
          include: {
            credential: true,
            bucket: true,
          },
        },
      },
    });

    if (!link) {
      await logUserAction({
        request,
        action: "LINK_SHARE_DOWNLOAD",
        success: false,
        resourceType: "link",
        metadata: { hash },
        errorMessage: "Link not found",
      });
      return NextResponse.json({ message: "Link not found" }, { status: 404 });
    }

    // Check expiry
    if (link.expiresAt && link.expiresAt < new Date()) {
      await logUserAction({
        request,
        action: "LINK_SHARE_DOWNLOAD",
        success: false,
        linkId: link.id,
        resourceType: "link",
        resourceId: link.id,
        teamId: link.file.teamId,
        errorMessage: "Link expired",
      });
      return NextResponse.json({ message: "Link expired" }, { status: 410 });
    }

    // Check download limit
    if (link.maxDownloads && link.downloadCount >= link.maxDownloads) {
      await logUserAction({
        request,
        action: "LINK_SHARE_DOWNLOAD",
        success: false,
        linkId: link.id,
        resourceType: "link",
        resourceId: link.id,
        teamId: link.file.teamId,
        errorMessage: "Download limit reached",
      });
      return NextResponse.json(
        { message: "Download limit reached" },
        { status: 403 },
      );
    }

    // Check password
    if (link.passwordHash) {
      if (!password) {
        await logUserAction({
          request,
          action: "LINK_SHARE_DOWNLOAD",
          success: false,
          linkId: link.id,
          resourceType: "link",
          resourceId: link.id,
          teamId: link.file.teamId,
          errorMessage: "Password required",
        });
        return NextResponse.json(
          { message: "Password required", requiresPassword: true },
          { status: 401 },
        );
      }

      const isValid = await verifyPassword(password, link.passwordHash);
      if (!isValid) {
        await logUserAction({
          request,
          action: "LINK_SHARE_DOWNLOAD",
          success: false,
          linkId: link.id,
          resourceType: "link",
          resourceId: link.id,
          teamId: link.file.teamId,
          errorMessage: "Invalid password",
        });
        return NextResponse.json(
          { message: "Invalid password" },
          { status: 401 },
        );
      }
    }

    const config = decryptAWSConfig(link.file.credential, link.file.bucket);

    const downloadUrl =
      link.type === "CLOUDFRONT"
        ? generateCloudfrontSignedUrl(config, link.file.key, 3600)
        : await generatePresignedDownloadUrl(
            config,
            link.file.key,
            3600,
            link.file.name,
          );

    // Increment download count
    await prisma.link.update({
      where: { id: link.id },
      data: {
        downloadCount: {
          increment: 1,
        },
      },
    });

    // Log access
    await logUserAction({
      request,
      action: "LINK_SHARE_DOWNLOAD",
      success: true,
      linkId: link.id,
      resourceType: "link",
      resourceId: link.id,
      teamId: link.file.teamId,
      metadata: {
        fileId: link.file.id,
        fileKey: link.file.key,
      },
    });

    // Handle Text/CSV Content for Previews
    const previewType = getPreviewType(link.file.contentType, link.file.name);
    let textContent = undefined;
    let csvRows = undefined;

    if (
      link.allowPreview &&
      (previewType === "TEXT" || previewType === "CSV")
    ) {
      // Don't auto-read files > 1MB to avoid memory explosion
      if (Number(link.file.size) < 1024 * 1024) {
        try {
          const s3Client = new S3Client({
            region: config.region,
            credentials: {
              accessKeyId: config.accessKeyId,
              secretAccessKey: config.secretAccessKey,
            },
          });
          const getCommand = new GetObjectCommand({
            Bucket: config.bucket,
            Key: link.file.key,
          });
          const s3Response = await s3Client.send(getCommand);
          const rawText = (await s3Response.Body?.transformToString()) || "";

          if (previewType === "TEXT") {
            textContent = rawText;
          } else if (previewType === "CSV") {
            csvRows = rawText
              .split(/\r?\n/)
              .filter(Boolean)
              .map((line) => line.split(","));
          }
        } catch (e) {
          console.error(
            "Failed to fetch preview text content inline for share link",
            e,
          );
        }
      }
    }

    return NextResponse.json({
      file: {
        name: link.file.name,
        size: link.file.size.toString(),
        contentType: link.file.contentType,
      },
      downloadUrl,
      allowDownload: link.allowDownload,
      allowPreview: link.allowPreview,
      textContent,
      csvRows,
    });
  } catch (error) {
    console.error("Error accessing share:", error);
    await logUserAction({
      request,
      action: "LINK_SHARE_DOWNLOAD",
      success: false,
      errorMessage: "Internal server error",
    });
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 },
    );
  }
}
