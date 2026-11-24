-- M.A.I.A. AI Video Creator: credit ledger, access accounts, settings, and
-- background-worker fields on VideoGenerationJob.

-- AlterTable
ALTER TABLE "VideoGenerationJob" ADD COLUMN     "creditStatus" TEXT,
ADD COLUMN     "creditsCharged" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "estimatedCostUsd" DECIMAL(10,4),
ADD COLUMN     "finalDocumentId" TEXT,
ADD COLUMN     "firstFrameDocumentId" TEXT,
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "inputJson" JSONB,
ADD COLUMN     "language" TEXT,
ADD COLUMN     "lockedUntil" TIMESTAMP(3),
ADD COLUMN     "nextAttemptAt" TIMESTAMP(3),
ADD COLUMN     "pollFailures" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "resolution" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'VIDEO_DIRECTOR',
ADD COLUMN     "statusMessage" TEXT,
ADD COLUMN     "style" TEXT,
ADD COLUMN     "submitAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "thumbnailDocumentId" TEXT,
ADD COLUMN     "warningMessage" TEXT;

-- CreateTable
CREATE TABLE "VideoCreatorAccount" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "accessStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "creditBalance" INTEGER NOT NULL DEFAULT 0,
    "activatedAt" TIMESTAMP(3),
    "activatedById" TEXT,
    "deactivatedAt" TIMESTAMP(3),
    "purchaseReference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoCreatorAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoCreditTransaction" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "jobId" TEXT,
    "reason" TEXT,
    "actorUserId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoCreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoCreatorSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "generationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "activeModel" TEXT,
    "creditsPerVideo" INTEGER NOT NULL DEFAULT 1,
    "extraCreditsFor1080p" INTEGER NOT NULL DEFAULT 0,
    "defaultStartingCredits" INTEGER NOT NULL DEFAULT 0,
    "maxActiveJobsPerUser" INTEGER NOT NULL DEFAULT 2,
    "maxActiveJobsGlobal" INTEGER NOT NULL DEFAULT 5,
    "allowedDurations" JSONB NOT NULL,
    "allowedResolutions" JSONB NOT NULL,
    "modelPricing" JSONB NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoCreatorSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VideoCreatorAccount_studentId_key" ON "VideoCreatorAccount"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "VideoCreditTransaction_idempotencyKey_key" ON "VideoCreditTransaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "VideoCreditTransaction_accountId_createdAt_idx" ON "VideoCreditTransaction"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "VideoCreditTransaction_jobId_idx" ON "VideoCreditTransaction"("jobId");

-- CreateIndex
CREATE INDEX "VideoGenerationJob_source_status_idx" ON "VideoGenerationJob"("source", "status");

-- CreateIndex
CREATE UNIQUE INDEX "VideoGenerationJob_studentId_idempotencyKey_key" ON "VideoGenerationJob"("studentId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "VideoCreatorAccount" ADD CONSTRAINT "VideoCreatorAccount_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoCreditTransaction" ADD CONSTRAINT "VideoCreditTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "VideoCreatorAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Defense in depth: the application only ever decrements with a
-- conditional UPDATE, but the database itself also refuses a negative balance.
ALTER TABLE "VideoCreatorAccount" ADD CONSTRAINT "VideoCreatorAccount_creditBalance_nonnegative" CHECK ("creditBalance" >= 0);

-- Grant the new "AI Video Creator" permission module to every existing
-- Owner/Administrator role (the dev seed does this for fresh dev DBs; this
-- covers databases that already exist, including production).
INSERT INTO "RolePermission" ("id", "roleId", "module", "action", "allowed")
SELECT gen_random_uuid()::text, r."id", 'AI Video Creator', a.action::"PermissionAction", true
FROM "Role" r
CROSS JOIN (VALUES ('VIEW'), ('CREATE'), ('EDIT'), ('VERIFY'), ('EXPORT')) AS a(action)
WHERE r."name" IN ('Owner', 'Administrator')
ON CONFLICT ("roleId", "module", "action") DO NOTHING;
