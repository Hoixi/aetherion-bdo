-- Additive migration; apply before deploying the report-capture API.
ALTER TABLE "war_performances"
  ADD COLUMN IF NOT EXISTS "deathSeconds" INTEGER,
  ADD COLUMN IF NOT EXISTS "reportData" JSONB,
  ADD COLUMN IF NOT EXISTS "reportGuildId" INTEGER,
  ADD COLUMN IF NOT EXISTS "reportUploadedBy" INTEGER,
  ADD COLUMN IF NOT EXISTS "reportUpdatedAt" TIMESTAMP(3);
