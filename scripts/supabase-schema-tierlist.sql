-- Tier List tabloları — Supabase SQL Editor'e yapıştır

CREATE TABLE "tier_lists" (
  "id" SERIAL NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "tags" TEXT NOT NULL DEFAULT '',
  "isVoting" BOOLEAN NOT NULL DEFAULT false,
  "createdBy" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tier_lists_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "tier_lists" ADD CONSTRAINT "tier_lists_createdBy_fkey"
  FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "tiers" (
  "id" SERIAL NOT NULL,
  "tierListId" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "color" TEXT NOT NULL DEFAULT '#ef4444',
  "order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "tiers_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "tiers" ADD CONSTRAINT "tiers_tierListId_fkey"
  FOREIGN KEY ("tierListId") REFERENCES "tier_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "tier_entries" (
  "id" SERIAL NOT NULL,
  "tierId" INTEGER NOT NULL,
  "classId" TEXT NOT NULL,
  "spec" TEXT NOT NULL,
  "note" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "tier_entries_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "tier_entries" ADD CONSTRAINT "tier_entries_tierId_fkey"
  FOREIGN KEY ("tierId") REFERENCES "tiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "tier_votes" (
  "id" SERIAL NOT NULL,
  "tierListId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  "classId" TEXT NOT NULL,
  "spec" TEXT NOT NULL,
  "tierId" INTEGER NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tier_votes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "tier_votes_tierListId_userId_classId_spec_key"
  ON "tier_votes"("tierListId", "userId", "classId", "spec");
ALTER TABLE "tier_votes" ADD CONSTRAINT "tier_votes_tierListId_fkey"
  FOREIGN KEY ("tierListId") REFERENCES "tier_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tier_votes" ADD CONSTRAINT "tier_votes_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tier_votes" ADD CONSTRAINT "tier_votes_tierId_fkey"
  FOREIGN KEY ("tierId") REFERENCES "tiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
