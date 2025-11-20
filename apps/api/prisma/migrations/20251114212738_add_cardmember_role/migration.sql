-- CreateEnum
CREATE TYPE "CardRole" AS ENUM ('developer', 'designer', 'qa', 'analyst', 'pm', 'devops', 'other');

-- AlterTable
ALTER TABLE "CardMember" ADD COLUMN     "customRole" TEXT,
ADD COLUMN     "role" "CardRole";

-- CreateIndex
CREATE INDEX "CardMember_userId_idx" ON "CardMember"("userId");
