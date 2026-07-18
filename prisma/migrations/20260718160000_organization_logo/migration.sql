-- AlterTable
ALTER TABLE "Organization"
ADD COLUMN "logoFileName" TEXT,
ADD COLUMN "logoMimeType" TEXT,
ADD COLUMN "logoFileSize" INTEGER,
ADD COLUMN "logoFileHash" TEXT,
ADD COLUMN "logoUpdatedAt" TIMESTAMP(3);
