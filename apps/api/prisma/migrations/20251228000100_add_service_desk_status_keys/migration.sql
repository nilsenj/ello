-- Add board type + list status metadata for Service Desk
CREATE TYPE "BoardType" AS ENUM ('generic', 'service_desk');
CREATE TYPE "ListStatusKey" AS ENUM ('inbox', 'scheduled', 'in_progress', 'waiting_client', 'done', 'canceled');

ALTER TABLE "Board" ADD COLUMN "type" "BoardType" NOT NULL DEFAULT 'generic';
ALTER TABLE "List" ADD COLUMN "statusKey" "ListStatusKey";
ALTER TABLE "List" ADD COLUMN "isSystem" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "List_boardId_statusKey_idx" ON "List"("boardId", "statusKey");

-- Backfill existing Service Desk boards (created with the default list names)
WITH sd_boards AS (
  SELECT b.id
  FROM "Board" b
  JOIN "List" l ON l."boardId" = b.id
  WHERE l.name IN ('Inbox', 'Scheduled', 'In Progress', 'Waiting Client', 'Done', 'Canceled')
  GROUP BY b.id
  HAVING COUNT(DISTINCT l.name) = 6
)
UPDATE "Board"
SET "type" = 'service_desk'
WHERE id IN (SELECT id FROM sd_boards);

WITH sd_boards AS (
  SELECT b.id
  FROM "Board" b
  JOIN "List" l ON l."boardId" = b.id
  WHERE l.name IN ('Inbox', 'Scheduled', 'In Progress', 'Waiting Client', 'Done', 'Canceled')
  GROUP BY b.id
  HAVING COUNT(DISTINCT l.name) = 6
)
UPDATE "List" l
SET "statusKey" = CASE l.name
  WHEN 'Inbox' THEN 'inbox'
  WHEN 'Scheduled' THEN 'scheduled'
  WHEN 'In Progress' THEN 'in_progress'
  WHEN 'Waiting Client' THEN 'waiting_client'
  WHEN 'Done' THEN 'done'
  WHEN 'Canceled' THEN 'canceled'
  ELSE l."statusKey"
END,
    "isSystem" = CASE
      WHEN l.name IN ('Inbox', 'Scheduled', 'In Progress', 'Waiting Client', 'Done', 'Canceled') THEN true
      ELSE l."isSystem"
    END
WHERE l."boardId" IN (SELECT id FROM sd_boards);
