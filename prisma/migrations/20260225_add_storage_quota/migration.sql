-- Migration: add_storage_quota

CREATE TABLE "StorageQuota" (
  "id" text PRIMARY KEY NOT NULL,
  "teamId" text NOT NULL UNIQUE,
  "usedBytes" bigint NOT NULL DEFAULT 0,
  "limitBytes" bigint,
  "createdAt" timestamp(3) NOT NULL DEFAULT now(),
  "updatedAt" timestamp(3) NOT NULL DEFAULT now()
);

ALTER TABLE "StorageQuota"
  ADD CONSTRAINT "StorageQuota_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE;

-- Optional index on teamId already unique.

-- Note: run `npx prisma migrate deploy` or `npx prisma migrate dev --name add_storage_quota` locally to apply.
