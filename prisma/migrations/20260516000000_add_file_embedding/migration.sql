-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "IndexingStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "FileEmbedding" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "status" "IndexingStatus" NOT NULL DEFAULT 'PENDING',
    "summary" TEXT,
    "errorMsg" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FileEmbedding_pkey" PRIMARY KEY ("id")
);

-- Add vector column (pgvector type, not in Prisma DSL)
ALTER TABLE "FileEmbedding" ADD COLUMN "embedding" vector(1536);

-- CreateIndex
CREATE UNIQUE INDEX "FileEmbedding_fileId_key" ON "FileEmbedding"("fileId");

-- CreateIndex
CREATE INDEX "FileEmbedding_status_idx" ON "FileEmbedding"("status");

-- HNSW index for fast approximate nearest-neighbour cosine search
CREATE INDEX "FileEmbedding_embedding_hnsw_idx"
  ON "FileEmbedding"
  USING hnsw ("embedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- AddForeignKey
ALTER TABLE "FileEmbedding" ADD CONSTRAINT "FileEmbedding_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "File"("id") ON DELETE CASCADE ON UPDATE CASCADE;
