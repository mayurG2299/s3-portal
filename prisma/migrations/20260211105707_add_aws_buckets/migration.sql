/*
  Warnings:

  - You are about to drop the column `bucket` on the `AWSCredential` table. All the data in the column will be lost.
  - You are about to drop the column `cloudfrontDomain` on the `AWSCredential` table. All the data in the column will be lost.
  - You are about to drop the column `cloudfrontKeyPairId` on the `AWSCredential` table. All the data in the column will be lost.
  - You are about to drop the column `encryptedCloudfrontPrivateKey` on the `AWSCredential` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[bucketId,key]` on the table `File` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `bucketId` to the `File` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'CANCELLED', 'EXPIRED');

-- DropIndex
DROP INDEX "File_credentialId_key_key";

-- Step 1: Create AwsBucket table
-- CreateTable
CREATE TABLE "AwsBucket" (
    "id" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "cloudfrontDomain" TEXT,
    "cloudfrontKeyPairId" TEXT,
    "encryptedCloudfrontPrivateKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AwsBucket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AwsBucket_credentialId_idx" ON "AwsBucket"("credentialId");

-- CreateIndex
CREATE INDEX "AwsBucket_bucket_idx" ON "AwsBucket"("bucket");

-- CreateIndex
CREATE UNIQUE INDEX "AwsBucket_credentialId_bucket_key" ON "AwsBucket"("credentialId", "bucket");

-- AddForeignKey
ALTER TABLE "AwsBucket" ADD CONSTRAINT "AwsBucket_credentialId_fkey" FOREIGN KEY ("credentialId") REFERENCES "AWSCredential"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 2: Migrate existing bucket data from AWSCredential to AwsBucket
INSERT INTO "AwsBucket" ("id", "credentialId", "bucket", "cloudfrontDomain", "cloudfrontKeyPairId", "encryptedCloudfrontPrivateKey", "createdAt", "updatedAt")
SELECT 
    gen_random_uuid()::text,
    "id",
    "bucket",
    "cloudfrontDomain",
    "cloudfrontKeyPairId",
    "encryptedCloudfrontPrivateKey",
    "createdAt",
    "updatedAt"
FROM "AWSCredential"
WHERE "bucket" IS NOT NULL;

-- Step 3: Add bucketId column to File table (nullable first)
ALTER TABLE "File" ADD COLUMN "bucketId" TEXT;

-- CreateIndex for better performance during backfill
CREATE INDEX "File_bucketId_idx" ON "File"("bucketId");

-- Step 4: Backfill bucketId for existing files by matching credentialId -> bucket
UPDATE "File" f
SET "bucketId" = ab."id"
FROM "AwsBucket" ab
WHERE f."credentialId" = ab."credentialId";

-- Step 5: Make bucketId required (all files should now have a bucketId)
ALTER TABLE "File" ALTER COLUMN "bucketId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "File_bucketId_key_key" ON "File"("bucketId", "key");

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_bucketId_fkey" FOREIGN KEY ("bucketId") REFERENCES "AwsBucket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 6: Drop old columns from AWSCredential
ALTER TABLE "AWSCredential" 
DROP COLUMN "bucket",
DROP COLUMN "cloudfrontDomain",
DROP COLUMN "cloudfrontKeyPairId",
DROP COLUMN "encryptedCloudfrontPrivateKey";

-- CreateTable for TeamInvite
CREATE TABLE "TeamInvite" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamInvite_token_key" ON "TeamInvite"("token");

-- CreateIndex
CREATE INDEX "TeamInvite_teamId_idx" ON "TeamInvite"("teamId");

-- CreateIndex
CREATE INDEX "TeamInvite_email_idx" ON "TeamInvite"("email");

-- CreateIndex
CREATE INDEX "TeamInvite_token_idx" ON "TeamInvite"("token");

-- CreateIndex
CREATE INDEX "TeamInvite_status_idx" ON "TeamInvite"("status");

-- AddForeignKey
ALTER TABLE "TeamInvite" ADD CONSTRAINT "TeamInvite_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamInvite" ADD CONSTRAINT "TeamInvite_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamInvite" ADD CONSTRAINT "TeamInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
