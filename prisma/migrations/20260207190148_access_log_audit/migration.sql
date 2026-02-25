-- AlterTable
ALTER TABLE "AccessLog" ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "resourceId" TEXT,
ADD COLUMN     "resourceType" TEXT,
ADD COLUMN     "teamId" TEXT;

-- CreateIndex
CREATE INDEX "AccessLog_teamId_idx" ON "AccessLog"("teamId");

-- CreateIndex
CREATE INDEX "AccessLog_action_idx" ON "AccessLog"("action");

-- CreateIndex
CREATE INDEX "AccessLog_success_idx" ON "AccessLog"("success");

-- CreateIndex
CREATE INDEX "AccessLog_resourceType_idx" ON "AccessLog"("resourceType");

-- CreateIndex
CREATE INDEX "AccessLog_resourceId_idx" ON "AccessLog"("resourceId");

-- CreateIndex
CREATE INDEX "AccessLog_teamId_createdAt_idx" ON "AccessLog"("teamId", "createdAt");

-- AddForeignKey
ALTER TABLE "AccessLog" ADD CONSTRAINT "AccessLog_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
