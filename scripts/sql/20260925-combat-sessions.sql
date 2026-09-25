-- Apply ONCE, after backup. Independent of the old combat-beta migration.
-- No existing war/report/ally rows are updated or removed.
BEGIN;
CREATE TABLE "combat_sessions" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "clientSessionId" TEXT NOT NULL,
  "warId" INTEGER NOT NULL,
  "uploadedBy" INTEGER NOT NULL,
  "recordedGuildId" INTEGER,
  "allianceName" TEXT NOT NULL,
  "parserVersion" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3),
  "phase" TEXT NOT NULL DEFAULT 'listening',
  "lastSeq" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "combat_sessions_warId_fkey" FOREIGN KEY ("warId") REFERENCES "wars"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "combat_sessions_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "combat_sessions_uploadedBy_clientSessionId_key" ON "combat_sessions"("uploadedBy", "clientSessionId");
CREATE INDEX "combat_sessions_warId_createdAt_id_idx" ON "combat_sessions"("warId", "createdAt", "id");
CREATE TABLE "combat_events" (
  "sessionId" TEXT NOT NULL,
  "seq" INTEGER NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL,
  "rawBase64" TEXT NOT NULL,
  "rawHash" TEXT NOT NULL,
  "ourFamily" TEXT NOT NULL,
  "opponentFamily" TEXT NOT NULL,
  "ourCharacter" TEXT NOT NULL,
  "opponentCharacter" TEXT NOT NULL,
  "opponentGuild" TEXT NOT NULL,
  "ourKill" BOOLEAN NOT NULL,
  "killerFamily" TEXT NOT NULL,
  "victimFamily" TEXT NOT NULL,
  "gameX" DOUBLE PRECISION NOT NULL,
  "gameY" DOUBLE PRECISION NOT NULL,
  "gameZ" DOUBLE PRECISION NOT NULL,
  "positionVerified" BOOLEAN NOT NULL DEFAULT false,
  "directionFlagHex" TEXT NOT NULL,
  "tailHex" TEXT NOT NULL,
  CONSTRAINT "combat_events_pkey" PRIMARY KEY ("sessionId", "seq"),
  CONSTRAINT "combat_events_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "combat_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "combat_events_rawHash_idx" ON "combat_events"("rawHash");
CREATE INDEX "combat_events_sessionId_receivedAt_idx" ON "combat_events"("sessionId", "receivedAt");
COMMIT;
