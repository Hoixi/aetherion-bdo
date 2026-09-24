-- Mevzi kalelerinin elle düzeltilmiş konumu (eklemeli)
CREATE TABLE IF NOT EXISTS "node_forts" (
  "nodeKey"   INTEGER PRIMARY KEY,
  "x"         DOUBLE PRECISION NOT NULL,
  "z"         DOUBLE PRECISION NOT NULL,
  "updatedBy" INTEGER NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
DO $$ BEGIN
  ALTER TABLE "node_forts" ADD CONSTRAINT "node_forts_updatedBy_fkey"
    FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
