/*
  Warnings:

  - A unique constraint covering the columns `[boardId,name,color]` on the table `Label` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Label_boardId_name_key";

-- AlterTable
ALTER TABLE "CardLabel" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Label" ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rank" TEXT NOT NULL DEFAULT 'n';

-- CreateIndex
CREATE INDEX "Label_boardId_rank_idx" ON "Label"("boardId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "Label_boardId_name_color_key" ON "Label"("boardId", "name", "color");
