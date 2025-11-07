-- AlterTable
ALTER TABLE "Board" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Card" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "List" ALTER COLUMN "updatedAt" DROP DEFAULT;
