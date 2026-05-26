-- AlterTable
ALTER TABLE "Note" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Note_deletedAt_idx" ON "Note"("deletedAt");

-- AlterTable
ALTER TABLE "SystemUpdate" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "SystemUpdate_deletedAt_idx" ON "SystemUpdate"("deletedAt");
