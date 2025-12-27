-- AlterEnum
ALTER TYPE "IntegrationType" ADD VALUE 'webhook';

-- AlterTable
ALTER TABLE "WorkspaceIntegration" ADD COLUMN     "webhookSecretEncrypted" TEXT,
ALTER COLUMN "botTokenEncrypted" DROP NOT NULL,
ALTER COLUMN "chatId" DROP NOT NULL;
