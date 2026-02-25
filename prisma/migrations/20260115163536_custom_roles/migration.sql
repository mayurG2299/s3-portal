/*
  Warnings:

  - You are about to drop the column `role` on the `TeamMember` table. All the data in the column will be lost.
  - Added the required column `roleId` to the `TeamMember` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable - Add new column first
ALTER TABLE "TeamMember" ADD COLUMN "roleId" TEXT;

-- AlterTable - Drop old column (this will also allow dropping the enum)
ALTER TABLE "TeamMember" DROP COLUMN IF EXISTS "role";

-- DropEnum
DROP TYPE IF EXISTS "Role";

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "screenName" "ScreenName" NOT NULL,
    "permissionLevel" "PermissionLevel" NOT NULL DEFAULT 'VIEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE INDEX "Role_name_idx" ON "Role"("name");

-- CreateIndex
CREATE INDEX "Role_level_idx" ON "Role"("level");

-- CreateIndex
CREATE INDEX "RolePermission_roleId_idx" ON "RolePermission"("roleId");

-- CreateIndex
CREATE INDEX "RolePermission_screenName_idx" ON "RolePermission"("screenName");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_screenName_key" ON "RolePermission"("roleId", "screenName");

-- CreateIndex
CREATE INDEX "TeamMember_roleId_idx" ON "TeamMember"("roleId");

-- Make roleId NOT NULL (safe since this is a fresh DB with no data)
ALTER TABLE "TeamMember" ALTER COLUMN "roleId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
