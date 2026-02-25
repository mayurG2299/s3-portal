-- CreateEnum
CREATE TYPE "PermissionLevel" AS ENUM ('VIEW', 'EDIT');

-- CreateEnum
CREATE TYPE "ScreenName" AS ENUM ('FILES_LIST', 'FILES_UPLOAD', 'FILES_DELETE', 'FILES_SHARE', 'CREDENTIALS_LIST', 'CREDENTIALS_CREATE', 'CREDENTIALS_EDIT', 'CREDENTIALS_DELETE', 'TEAM_SETTINGS', 'TEAM_MEMBERS', 'TEAM_INVITATIONS', 'TEAM_DELETE', 'LINKS_LIST', 'LINKS_CREATE', 'LINKS_DELETE', 'ADMIN_AUDIT_LOG', 'ADMIN_SETTINGS');

-- CreateTable
CREATE TABLE "ScreenPermission" (
    "id" TEXT NOT NULL,
    "teamMemberId" TEXT NOT NULL,
    "screenName" "ScreenName" NOT NULL,
    "permissionLevel" "PermissionLevel" NOT NULL DEFAULT 'VIEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScreenPermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScreenPermission_teamMemberId_screenName_key" ON "ScreenPermission"("teamMemberId", "screenName");

-- CreateIndex
CREATE INDEX "ScreenPermission_teamMemberId_idx" ON "ScreenPermission"("teamMemberId");

-- AddForeignKey
ALTER TABLE "ScreenPermission" ADD CONSTRAINT "ScreenPermission_teamMemberId_fkey" FOREIGN KEY ("teamMemberId") REFERENCES "TeamMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
