-- CreateTable
CREATE TABLE "NoteCitation" (
    "sourceNoteId" TEXT NOT NULL,
    "citedNoteId" TEXT NOT NULL,

    CONSTRAINT "NoteCitation_pkey" PRIMARY KEY ("sourceNoteId","citedNoteId")
);

-- CreateIndex
CREATE INDEX "NoteCitation_citedNoteId_idx" ON "NoteCitation"("citedNoteId");

-- AddForeignKey
ALTER TABLE "NoteCitation" ADD CONSTRAINT "NoteCitation_sourceNoteId_fkey" FOREIGN KEY ("sourceNoteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteCitation" ADD CONSTRAINT "NoteCitation_citedNoteId_fkey" FOREIGN KEY ("citedNoteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;
