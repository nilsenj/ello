-- CreateEnum
CREATE TYPE "Risk" AS ENUM ('low', 'medium', 'high');

-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "risk" "Risk";
