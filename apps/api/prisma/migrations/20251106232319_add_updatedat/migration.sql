/*
  Warnings:

  - A unique constraint covering the columns `[workspaceId,name]` on the table `Board` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,boardId]` on the table `BoardMember` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[boardId,name]` on the table `Label` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[name]` on the table `Workspace` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,workspaceId]` on the table `WorkspaceMember` will be added. If there are existing duplicate values, this will fail.
*/

-- DropForeignKey
ALTER TABLE "Activity" DROP CONSTRAINT "Activity_boardId_fkey";
ALTER TABLE "Attachment" DROP CONSTRAINT "Attachment_cardId_fkey";
ALTER TABLE "Board" DROP CONSTRAINT "Board_workspaceId_fkey";
ALTER TABLE "BoardMember" DROP CONSTRAINT "BoardMember_boardId_fkey";
ALTER TABLE "BoardMember" DROP CONSTRAINT "BoardMember_userId_fkey";
ALTER TABLE "Card" DROP CONSTRAINT "Card_listId_fkey";
ALTER TABLE "CardLabel" DROP CONSTRAINT "CardLabel_cardId_fkey";
ALTER TABLE "CardLabel" DROP CONSTRAINT "CardLabel_labelId_fkey";
ALTER TABLE "CardMember" DROP CONSTRAINT "CardMember_cardId_fkey";
ALTER TABLE "CardMember" DROP CONSTRAINT "CardMember_userId_fkey";
ALTER TABLE "Checklist" DROP CONSTRAINT "Checklist_cardId_fkey";
ALTER TABLE "ChecklistItem" DROP CONSTRAINT "ChecklistItem_checklistId_fkey";
ALTER TABLE "Comment" DROP CONSTRAINT "Comment_authorId_fkey";
ALTER TABLE "Comment" DROP CONSTRAINT "Comment_cardId_fkey";
ALTER TABLE "Label" DROP CONSTRAINT "Label_boardId_fkey";
ALTER TABLE "List" DROP CONSTRAINT "List_boardId_fkey";
ALTER TABLE "WorkspaceMember" DROP CONSTRAINT "WorkspaceMember_userId_fkey";
ALTER TABLE "WorkspaceMember" DROP CONSTRAINT "WorkspaceMember_workspaceId_fkey";

-- AlterTable: add timestamps/rank with safe defaults
ALTER TABLE "Board"
    ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Card"
    ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "rank" TEXT NOT NULL DEFAULT 'n',
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "position" DROP NOT NULL;

ALTER TABLE "List"
    ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "rank" TEXT NOT NULL DEFAULT 'n',
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "position" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Board_workspaceId_name_key" ON "Board"("workspaceId", "name");
CREATE UNIQUE INDEX "BoardMember_userId_boardId_key" ON "BoardMember"("userId", "boardId");
CREATE INDEX "Card_listId_rank_idx" ON "Card"("listId", "rank");
CREATE UNIQUE INDEX "Label_boardId_name_key" ON "Label"("boardId", "name");
CREATE INDEX "List_boardId_rank_idx" ON "List"("boardId", "rank");
CREATE UNIQUE INDEX "Workspace_name_key" ON "Workspace"("name");
CREATE UNIQUE INDEX "WorkspaceMember_userId_workspaceId_key" ON "WorkspaceMember"("userId", "workspaceId");

-- AddForeignKey (with cascades)
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Board" ADD CONSTRAINT "Board_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BoardMember" ADD CONSTRAINT "BoardMember_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BoardMember" ADD CONSTRAINT "BoardMember_boardId_fkey"
    FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "List" ADD CONSTRAINT "List_boardId_fkey"
    FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Card" ADD CONSTRAINT "Card_listId_fkey"
    FOREIGN KEY ("listId") REFERENCES "List"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Label" ADD CONSTRAINT "Label_boardId_fkey"
    FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CardLabel" ADD CONSTRAINT "CardLabel_cardId_fkey"
    FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CardLabel" ADD CONSTRAINT "CardLabel_labelId_fkey"
    FOREIGN KEY ("labelId") REFERENCES "Label"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CardMember" ADD CONSTRAINT "CardMember_cardId_fkey"
    FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CardMember" ADD CONSTRAINT "CardMember_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Checklist" ADD CONSTRAINT "Checklist_cardId_fkey"
    FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_checklistId_fkey"
    FOREIGN KEY ("checklistId") REFERENCES "Checklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_cardId_fkey"
    FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_cardId_fkey"
    FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Activity" ADD CONSTRAINT "Activity_boardId_fkey"
    FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;
