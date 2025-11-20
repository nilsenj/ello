/*
  Warnings:

  - You are about to alter the column `customRole` on the `CardMember` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(64)`.

*/
-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('private', 'workspace', 'public');

-- AlterTable
ALTER TABLE "Board" ADD COLUMN     "visibility" "Visibility" NOT NULL DEFAULT 'private';

-- AlterTable
ALTER TABLE "CardMember" ALTER COLUMN "customRole" SET DATA TYPE VARCHAR(64);
