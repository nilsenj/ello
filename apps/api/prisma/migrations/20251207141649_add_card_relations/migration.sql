-- CreateEnum
CREATE TYPE "RelationType" AS ENUM ('blocks', 'depends_on', 'relates_to', 'duplicates');

-- CreateTable
CREATE TABLE "CardRelation" (
    "id" TEXT NOT NULL,
    "type" "RelationType" NOT NULL,
    "sourceCardId" TEXT NOT NULL,
    "targetCardId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardRelation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CardRelation_sourceCardId_idx" ON "CardRelation"("sourceCardId");

-- CreateIndex
CREATE INDEX "CardRelation_targetCardId_idx" ON "CardRelation"("targetCardId");

-- CreateIndex
CREATE UNIQUE INDEX "CardRelation_sourceCardId_targetCardId_type_key" ON "CardRelation"("sourceCardId", "targetCardId", "type");

-- AddForeignKey
ALTER TABLE "CardRelation" ADD CONSTRAINT "CardRelation_sourceCardId_fkey" FOREIGN KEY ("sourceCardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardRelation" ADD CONSTRAINT "CardRelation_targetCardId_fkey" FOREIGN KEY ("targetCardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;
