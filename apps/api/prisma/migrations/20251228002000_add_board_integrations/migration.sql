-- Add board-level integrations to override workspace defaults
CREATE TABLE "BoardIntegration" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "type" "IntegrationType" NOT NULL,
    "botTokenEncrypted" TEXT,
    "chatId" TEXT,
    "webhookNotifyUrlEncrypted" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoardIntegration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BoardIntegration_boardId_type_key" ON "BoardIntegration"("boardId", "type");

ALTER TABLE "BoardIntegration" ADD CONSTRAINT "BoardIntegration_boardId_fkey"
    FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;
