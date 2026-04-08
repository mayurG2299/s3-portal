import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'

export type AuditStatus = 'SUCCESS' | 'FAILURE'

export type AuditLogInput = {
  request?: NextRequest;
  action: string;
  success: boolean;
  userId?: string | null;
  teamId?: string | null;
  linkId?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown> | null;
};

function getClientIp(request?: NextRequest): string {
  if (!request) return "unknown";
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

export async function logUserAction({
  request,
  action,
  success,
  userId,
  teamId,
  linkId,
  resourceType,
  resourceId,
  errorMessage,
  metadata,
}: AuditLogInput) {
  try {
    await prisma.accessLog.create({
      data: {
        action,
        success,
        userId: userId ?? undefined,
        teamId: teamId ?? undefined,
        linkId: linkId ?? undefined,
        resourceType: resourceType ?? undefined,
        resourceId: resourceId ?? undefined,
        errorMessage: errorMessage ? errorMessage.slice(0, 1000) : undefined,
        metadata: (metadata as Prisma.InputJsonValue) ?? undefined,
        ipAddress: getClientIp(request),
        userAgent: request?.headers.get("user-agent") ?? undefined,
      },
    });
  } catch (error) {
    console.error('Failed to write audit log:', error)
  }
}
