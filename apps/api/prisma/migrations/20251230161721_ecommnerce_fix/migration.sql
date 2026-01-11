-- AlterEnum
ALTER TYPE "BoardType" ADD VALUE 'ecommerce_fulfillment';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ListStatusKey" ADD VALUE 'order';
ALTER TYPE "ListStatusKey" ADD VALUE 'packing';
ALTER TYPE "ListStatusKey" ADD VALUE 'shipped';
ALTER TYPE "ListStatusKey" ADD VALUE 'delivered';
ALTER TYPE "ListStatusKey" ADD VALUE 'returned';

-- AlterTable
ALTER TABLE "BillingTransaction" ADD COLUMN     "userId" TEXT,
ALTER COLUMN "workspaceId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "customerEmail" TEXT,
ADD COLUMN     "fulfillmentOverdueNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "itemsSummary" TEXT,
ADD COLUMN     "orderCurrency" TEXT,
ADD COLUMN     "orderNumber" TEXT,
ADD COLUMN     "orderTotal" DOUBLE PRECISION,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "shippingCarrier" TEXT,
ADD COLUMN     "trackingNumber" TEXT,
ADD COLUMN     "trackingUrl" TEXT;

-- CreateIndex
CREATE INDEX "BillingTransaction_userId_idx" ON "BillingTransaction"("userId");

-- AddForeignKey
ALTER TABLE "BillingTransaction" ADD CONSTRAINT "BillingTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
