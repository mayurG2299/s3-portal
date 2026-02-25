-- AlterTable
ALTER TABLE "File" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
