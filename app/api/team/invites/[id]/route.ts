import { NextRequest, NextResponse } from 'next/server'
import type { RouteContext } from "@/types/next-route-context";
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logUserAction } from '@/lib/audit'
import { publishMembershipChanged } from "@/lib/events/membership"
import { grantBucketAccess, setBucketAccess } from '@/lib/bucket-access'

export async function PATCH(
  request: NextRequest,
  context: RouteContext<{ id: string }>,
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const { action } = await request.json(); // 'accept' | 'decline'
    if (action !== "accept" && action !== "decline") {
      return NextResponse.json(
        { error: "Action must be accept or decline" },
        { status: 400 },
      );
    }

    // Fetch the invite
    const invite = await prisma.teamInvite.findUnique({
      where: { id },
      include: {
        team: { select: { id: true, name: true } },
        role: { select: { id: true, name: true } },
      },
    });

    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    // Make sure this invite belongs to the current user
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { email: true },
    });

    if (!user || user.email.toLowerCase() !== invite.email.toLowerCase()) {
      return NextResponse.json(
        { error: "This invite is not for you" },
        { status: 403 },
      );
    }

    if (invite.status !== "PENDING") {
      return NextResponse.json(
        { error: "Invite is no longer pending" },
        { status: 400 },
      );
    }

    if (invite.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Invite has expired" },
        { status: 400 },
      );
    }

    if (action === "accept") {
      const alreadyMember = await prisma.teamMember.findFirst({
        where: { userId: session.user.id, teamId: invite.teamId },
      })

      // Run member creation, bucket access grant, and invite status update atomically
      const teamMemberId = await prisma.$transaction(async (tx) => {
        let memberId: string

        if (!alreadyMember) {
          const newMember = await tx.teamMember.create({
            data: {
              userId: session.user.id,
              teamId: invite.teamId,
              roleId: invite.roleId,
            },
          })
          memberId = newMember.id
        } else {
          memberId = alreadyMember.id
        }

        // Bucket access from invite.
        // IMPORTANT: for non-admin roles, empty inviteBucketIds = no access (not unrestricted).
        // Admins (role.level >= 50) bypass bucket checks entirely in getAccessibleBucketIds.
        if (alreadyMember) {
          // Re-invite: always replace — empty list intentionally revokes all bucket access
          await tx.teamMemberBucketAccess.deleteMany({ where: { teamMemberId: memberId } })
          if (invite.inviteBucketIds.length > 0) {
            await tx.teamMemberBucketAccess.createMany({
              data: invite.inviteBucketIds.map((bucketId) => ({ teamMemberId: memberId, bucketId })),
            })
          }
        } else if (invite.inviteBucketIds.length > 0) {
          // New member: grant the invited buckets
          await tx.teamMemberBucketAccess.createMany({
            data: invite.inviteBucketIds.map((bucketId) => ({ teamMemberId: memberId, bucketId })),
            skipDuplicates: true,
          })
        }

        await tx.teamInvite.update({
          where: { id: invite.id },
          data: { status: "ACCEPTED" },
        })

        return memberId
      });

      await logUserAction({
        request,
        action: "TEAM_INVITE_ACCEPT",
        success: true,
        userId: session.user.id,
        teamId: invite.teamId,
        resourceType: "teamInvite",
        resourceId: invite.id,
        metadata: {
          teamName: invite.team.name,
          role: invite.role.name,
          bucketCount: invite.inviteBucketIds.length,
        },
      });

      publishMembershipChanged(session.user.id);

      return NextResponse.json({
        success: true,
        teamId: invite.teamId,
        teamName: invite.team.name,
      });
    } else {
      await prisma.teamInvite.update({
        where: { id: invite.id },
        data: { status: "CANCELLED" },
      });

      await logUserAction({
        request,
        action: "TEAM_INVITE_CANCEL",
        success: true,
        userId: session.user.id,
        teamId: invite.teamId,
        resourceType: "teamInvite",
        resourceId: invite.id,
        metadata: { teamName: invite.team.name },
      });

      publishMembershipChanged(session.user.id);

      return NextResponse.json({ success: true });
    }
  } catch (error) {
    console.error("Invite action error:", error);
    return NextResponse.json(
      { error: "Failed to process invite" },
      { status: 500 },
    );
  }
}
