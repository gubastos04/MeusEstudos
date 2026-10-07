-- AlterTable
ALTER TABLE "Challenge" ADD COLUMN     "format" TEXT NOT NULL DEFAULT 'desafio';

-- CreateIndex
CREATE INDEX "Challenge_format_idx" ON "Challenge"("format");