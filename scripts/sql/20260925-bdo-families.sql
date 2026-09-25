-- Oyunun resmî profil sayfasından okunan karakter listeleri (önbellek, eklemeli)
CREATE TABLE IF NOT EXISTS "bdo_families" (
  "aile"        TEXT PRIMARY KEY,
  "karakterler" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "alindi"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "bdo_families_lower_aile_idx" ON "bdo_families" (lower("aile"));
