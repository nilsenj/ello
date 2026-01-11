-- Billing providers and statuses
CREATE TYPE "BillingProvider" AS ENUM ('fondy', 'apple_iap', 'google_iap', 'mock');
CREATE TYPE "BillingStatus" AS ENUM ('pending', 'paid', 'failed', 'canceled', 'refunded');

-- Workspace subscription (single active record per workspace)
CREATE TABLE "WorkspaceSubscription" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "planKey" TEXT NOT NULL,
    "provider" "BillingProvider" NOT NULL,
    "status" "BillingStatus" NOT NULL,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "autoRenew" BOOLEAN NOT NULL DEFAULT true,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceSubscription_workspaceId_key" ON "WorkspaceSubscription"("workspaceId");

ALTER TABLE "WorkspaceSubscription" ADD CONSTRAINT "WorkspaceSubscription_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Billing transaction log
CREATE TABLE "BillingTransaction" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "planKey" TEXT NOT NULL,
    "provider" "BillingProvider" NOT NULL,
    "status" "BillingStatus" NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "orderId" TEXT,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillingTransaction_orderId_key" ON "BillingTransaction"("orderId");
CREATE INDEX "BillingTransaction_workspaceId_provider_idx" ON "BillingTransaction"("workspaceId", "provider");

ALTER TABLE "BillingTransaction" ADD CONSTRAINT "BillingTransaction_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
