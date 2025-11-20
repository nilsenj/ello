-- 1) New columns (nullable first for backfill)
ALTER TABLE "Attachment"
    ADD COLUMN "isCover" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "size" INTEGER;

-- 2) Backfill from legacy data
UPDATE "Attachment"
SET "size" = COALESCE("bytes", 0);

-- Ensure mime/name are always present
UPDATE "Attachment"
SET "mime" = COALESCE("mime", 'application/octet-stream');

-- Derive a filename from the URL if name is null/blank
UPDATE "Attachment"
SET "name" = COALESCE(NULLIF(BTRIM("name"), ''),
                      split_part("url", '/', array_length(string_to_array("url", '/'), 1)));

-- 3) Enforce NOT NULLs
ALTER TABLE "Attachment"
    ALTER COLUMN "size" SET NOT NULL,
ALTER COLUMN "name" SET NOT NULL,
  ALTER COLUMN "mime" SET NOT NULL;

-- 4) Drop legacy column
ALTER TABLE "Attachment" DROP COLUMN "bytes";

-- 5) Helpful index for per-card listings
CREATE INDEX IF NOT EXISTS "Attachment_cardId_createdAt_idx"
    ON "Attachment"("cardId", "createdAt");
