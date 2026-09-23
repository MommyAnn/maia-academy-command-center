-- CreateTable
CREATE TABLE "IntelligenceRule" (
    "id" TEXT NOT NULL,
    "ruleKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "thresholdJson" JSONB NOT NULL,
    "severity" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntelligenceRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntelligenceSignal" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "evidenceJson" JSONB NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "assignedToId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntelligenceSignal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IntelligenceRule_ruleKey_key" ON "IntelligenceRule"("ruleKey");

-- CreateIndex
CREATE INDEX "IntelligenceSignal_status_idx" ON "IntelligenceSignal"("status");

-- CreateIndex
CREATE INDEX "IntelligenceSignal_domain_idx" ON "IntelligenceSignal"("domain");

-- CreateIndex
CREATE INDEX "IntelligenceSignal_entityType_entityId_idx" ON "IntelligenceSignal"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "IntelligenceSignal_ruleId_entityType_entityId_idx" ON "IntelligenceSignal"("ruleId", "entityType", "entityId");

-- AddForeignKey
ALTER TABLE "IntelligenceSignal" ADD CONSTRAINT "IntelligenceSignal_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "IntelligenceRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

