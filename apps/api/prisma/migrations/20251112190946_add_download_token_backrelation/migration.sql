-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN     "bytes" INTEGER,
ALTER COLUMN "name" DROP NOT NULL,
ALTER COLUMN "mime" DROP NOT NULL,
ALTER COLUMN "size" DROP NOT NULL;

-- CreateTable
CREATE TABLE "DownloadToken" (
    "id" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "attachmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DownloadToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DownloadToken_jti_key" ON "DownloadToken"("jti");

-- CreateIndex
CREATE INDEX "DownloadToken_attachmentId_idx" ON "DownloadToken"("attachmentId");

-- CreateIndex
CREATE INDEX "DownloadToken_expiresAt_idx" ON "DownloadToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "DownloadToken" ADD CONSTRAINT "DownloadToken_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "Attachment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
