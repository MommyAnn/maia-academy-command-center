-- CreateTable
CREATE TABLE "CustomerJourney" (
    "id" TEXT NOT NULL,
    "journeyDisplayId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "objective" TEXT,
    "audience" TEXT,
    "entryPoint" TEXT,
    "stagesJson" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "masterBrainVersionAtCreation" INTEGER,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerJourney_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Automation" (
    "id" TEXT NOT NULL,
    "automationDisplayId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "journeyId" TEXT,
    "name" TEXT NOT NULL,
    "goal" TEXT,
    "audience" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "readiness" TEXT NOT NULL DEFAULT 'DESIGN_ONLY',
    "platformExecutionMode" TEXT NOT NULL DEFAULT 'MAIA_NATIVE',
    "currentVersionId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Automation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationVersion" (
    "id" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "flowJson" JSONB NOT NULL,
    "triggerType" TEXT NOT NULL,
    "triggerConfig" JSONB,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "validationJson" JSONB,
    "changeNotes" TEXT,
    "createdById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRun" (
    "id" TEXT NOT NULL,
    "runDisplayId" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "automationVersionId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "triggerEvent" TEXT NOT NULL,
    "domainEventId" TEXT,
    "correlationId" TEXT NOT NULL,
    "currentNodeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "isTest" BOOLEAN NOT NULL DEFAULT false,
    "resumeAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AutomationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRunStep" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "stepIndex" INTEGER NOT NULL,
    "nodeId" TEXT NOT NULL,
    "nodeType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "inputJson" JSONB,
    "outputJson" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AutomationRunStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntityTag" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "addedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntityTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationTestContact" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationTestContact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerJourney_journeyDisplayId_key" ON "CustomerJourney"("journeyDisplayId");

-- CreateIndex
CREATE INDEX "CustomerJourney_studentId_idx" ON "CustomerJourney"("studentId");

-- CreateIndex
CREATE INDEX "CustomerJourney_businessId_idx" ON "CustomerJourney"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "Automation_automationDisplayId_key" ON "Automation"("automationDisplayId");

-- CreateIndex
CREATE UNIQUE INDEX "Automation_currentVersionId_key" ON "Automation"("currentVersionId");

-- CreateIndex
CREATE INDEX "Automation_studentId_idx" ON "Automation"("studentId");

-- CreateIndex
CREATE INDEX "Automation_businessId_idx" ON "Automation"("businessId");

-- CreateIndex
CREATE INDEX "Automation_journeyId_idx" ON "Automation"("journeyId");

-- CreateIndex
CREATE INDEX "AutomationVersion_automationId_idx" ON "AutomationVersion"("automationId");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationVersion_automationId_versionNumber_key" ON "AutomationVersion"("automationId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationRun_runDisplayId_key" ON "AutomationRun"("runDisplayId");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationRun_correlationId_key" ON "AutomationRun"("correlationId");

-- CreateIndex
CREATE INDEX "AutomationRun_status_resumeAt_idx" ON "AutomationRun"("status", "resumeAt");

-- CreateIndex
CREATE INDEX "AutomationRun_entityType_entityId_idx" ON "AutomationRun"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationRun_automationId_domainEventId_key" ON "AutomationRun"("automationId", "domainEventId");

-- CreateIndex
CREATE INDEX "AutomationRunStep_runId_idx" ON "AutomationRunStep"("runId");

-- CreateIndex
CREATE INDEX "EntityTag_entityType_entityId_idx" ON "EntityTag"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "EntityTag_entityType_entityId_tag_key" ON "EntityTag"("entityType", "entityId", "tag");

-- CreateIndex
CREATE INDEX "AutomationTestContact_businessId_idx" ON "AutomationTestContact"("businessId");

-- AddForeignKey
ALTER TABLE "CustomerJourney" ADD CONSTRAINT "CustomerJourney_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerJourney" ADD CONSTRAINT "CustomerJourney_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Automation" ADD CONSTRAINT "Automation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Automation" ADD CONSTRAINT "Automation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Automation" ADD CONSTRAINT "Automation_journeyId_fkey" FOREIGN KEY ("journeyId") REFERENCES "CustomerJourney"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Automation" ADD CONSTRAINT "Automation_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "AutomationVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationVersion" ADD CONSTRAINT "AutomationVersion_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRun" ADD CONSTRAINT "AutomationRun_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRun" ADD CONSTRAINT "AutomationRun_automationVersionId_fkey" FOREIGN KEY ("automationVersionId") REFERENCES "AutomationVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRunStep" ADD CONSTRAINT "AutomationRunStep_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AutomationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationTestContact" ADD CONSTRAINT "AutomationTestContact_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

