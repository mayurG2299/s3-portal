-- AlterTable
ALTER TABLE "TeamInvite" ADD COLUMN     "inviteBucketIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "TeamMemberBucketAccess" (
    "id" TEXT NOT NULL,
    "teamMemberId" TEXT NOT NULL,
    "bucketId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMemberBucketAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeamMemberBucketAccess_teamMemberId_idx" ON "TeamMemberBucketAccess"("teamMemberId");

-- CreateIndex
CREATE INDEX "TeamMemberBucketAccess_bucketId_idx" ON "TeamMemberBucketAccess"("bucketId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMemberBucketAccess_teamMemberId_bucketId_key" ON "TeamMemberBucketAccess"("teamMemberId", "bucketId");

-- AddForeignKey
ALTER TABLE "TeamMemberBucketAccess" ADD CONSTRAINT "TeamMemberBucketAccess_teamMemberId_fkey" FOREIGN KEY ("teamMemberId") REFERENCES "TeamMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMemberBucketAccess" ADD CONSTRAINT "TeamMemberBucketAccess_bucketId_fkey" FOREIGN KEY ("bucketId") REFERENCES "AwsBucket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
