-- CreateTable
CREATE TABLE "FileFavorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FileFavorite_fileId_idx" ON "FileFavorite"("fileId");

-- CreateIndex
CREATE INDEX "FileFavorite_userId_idx" ON "FileFavorite"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FileFavorite_userId_fileId_key" ON "FileFavorite"("userId", "fileId");

-- AddForeignKey
ALTER TABLE "FileFavorite" ADD CONSTRAINT "FileFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileFavorite" ADD CONSTRAINT "FileFavorite_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;
