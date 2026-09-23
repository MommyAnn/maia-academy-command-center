-- AlterEnum
ALTER TYPE "PaymentTransactionStatus" ADD VALUE 'LEGACY_UNVERIFIED';

-- AlterTable
ALTER TABLE "PaymentTransaction" ADD COLUMN     "importBatchId" TEXT,
ADD COLUMN     "originalRecordReference" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'NORMAL',
ALTER COLUMN "paymentDate" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "importType" TEXT NOT NULL,
    "sourceFileName" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fieldMappingJson" JSONB,
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "validCount" INTEGER NOT NULL DEFAULT 0,
    "invalidCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "dryRunResultJson" JSONB,
    "financialImpactJson" JSONB,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "importedAt" TIMESTAMP(3),
    "rolledBackById" TEXT,
    "rolledBackAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportRecord" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "rawDataJson" JSONB NOT NULL,
    "normalizedDataJson" JSONB,
    "validationErrorsJson" JSONB,
    "duplicateConfidence" TEXT,
    "duplicateMatchesJson" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdEntityType" TEXT,
    "createdEntityId" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportBatch_status_idx" ON "ImportBatch"("status");

-- CreateIndex
CREATE INDEX "ImportBatch_importType_idx" ON "ImportBatch"("importType");

-- CreateIndex
CREATE INDEX "ImportRecord_batchId_idx" ON "ImportRecord"("batchId");

-- CreateIndex
CREATE INDEX "ImportRecord_status_idx" ON "ImportRecord"("status");

-- CreateIndex
CREATE INDEX "PaymentTransaction_importBatchId_idx" ON "PaymentTransaction"("importBatchId");

-- AddForeignKey
ALTER TABLE "ImportRecord" ADD CONSTRAINT "ImportRecord_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

