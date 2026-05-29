-- AlterTable
ALTER TABLE "Role" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Role_deletedAt_idx" ON "Role"("deletedAt");
