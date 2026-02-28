-- DropForeignKey
ALTER TABLE "StorageQuota" DROP CONSTRAINT "StorageQuota_teamId_fkey";

-- AlterTable
ALTER TABLE "StorageQuota" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "StorageQuota" ADD CONSTRAINT "StorageQuota_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
