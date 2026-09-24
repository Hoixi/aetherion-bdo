-- LOCAL BETA ONLY. Not applied automatically; do not deploy without explicit approval.
ALTER TABLE "combat_logs"
  ADD COLUMN IF NOT EXISTS "recordingKey" TEXT,
  ADD COLUMN IF NOT EXISTS "recordedGuildId" INTEGER,
  ADD COLUMN IF NOT EXISTS "allianceName" VARCHAR(60),
  ADD COLUMN IF NOT EXISTS "parserVersion" VARCHAR(60),
  ADD COLUMN IF NOT EXISTS "rawData" JSONB,
  ADD COLUMN IF NOT EXISTS "directionVerified" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS "combat_logs_recordingKey_key" ON "combat_logs"("recordingKey");
ALTER TABLE "combat_kills"
  ADD COLUMN IF NOT EXISTS "killerGuildName" VARCHAR(60),
  ADD COLUMN IF NOT EXISTS "victimGuildName" VARCHAR(60),
  ADD COLUMN IF NOT EXISTS "gameX" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "gameY" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "gameZ" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "positionVerified" BOOLEAN NOT NULL DEFAULT false;
