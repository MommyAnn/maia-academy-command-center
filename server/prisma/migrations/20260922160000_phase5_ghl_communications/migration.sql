-- DropIndex
DROP INDEX "CommunicationLog_personType_personId_idx";

-- AlterTable
ALTER TABLE "AutomationRule" DROP COLUMN "isActive",
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'Draft',
ADD COLUMN     "stopConditionsJson" JSONB,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "CommunicationLog" DROP COLUMN "occurredAt",
DROP COLUMN "personType",
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "externalMessageId" TEXT,
ADD COLUMN     "failedAt" TIMESTAMP(3),
ADD COLUMN     "leadId" TEXT,
ADD COLUMN     "provider" TEXT NOT NULL DEFAULT 'GHL',
ADD COLUMN     "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "readAt" TIMESTAMP(3),
ADD COLUMN     "sentAt" TIMESTAMP(3),
ADD COLUMN     "studentId" TEXT,
ADD COLUMN     "triggerEvent" TEXT;

-- AlterTable
ALTER TABLE "GhlContactMap" DROP COLUMN "personType",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "ghlLocationId" TEXT,
ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "lastSyncDirection" TEXT,
ADD COLUMN     "lastSyncedAt" TIMESTAMP(3),
ADD COLUMN     "leadId" TEXT,
ADD COLUMN     "studentId" TEXT,
ADD COLUMN     "syncStatus" TEXT NOT NULL DEFAULT 'NOT_SYNCED';

-- AlterTable
ALTER TABLE "MessageTemplate" DROP COLUMN "category",
DROP COLUMN "isActive",
ADD COLUMN     "audience" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "purpose" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'Draft',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "updatedById" TEXT,
ADD COLUMN     "variablesJson" JSONB,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- DropTable
DROP TABLE "SyncLog";

-- CreateTable
CREATE TABLE "IntegrationOutboxEvent" (
    "id" TEXT NOT NULL,
    "domainEventId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "personId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "nextRetryAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lastErrorCategory" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationOutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GhlWebhookEvent" (
    "id" TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "eventType" TEXT,
    "signatureValid" BOOLEAN NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "processingNote" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GhlWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GhlTagMapping" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "ghlTagName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GhlTagMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GhlCustomFieldMapping" (
    "id" TEXT NOT NULL,
    "maiaField" TEXT NOT NULL,
    "ghlFieldId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GhlCustomFieldMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GhlWorkflowMapping" (
    "id" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "ghlWorkflowId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GhlWorkflowMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GhlIntegrationConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "connectionMode" TEXT NOT NULL DEFAULT 'PRIVATE_INTEGRATION',
    "locationId" TEXT,
    "operatingMode" TEXT NOT NULL DEFAULT 'TEST',
    "status" TEXT NOT NULL DEFAULT 'NOT_CONNECTED',
    "lastSuccessfulConnectionAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "webhookStatus" TEXT NOT NULL DEFAULT 'NOT_CONFIGURED',
    "testContactIdsJson" JSONB,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GhlIntegrationConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationOutboxEvent_domainEventId_key" ON "IntegrationOutboxEvent"("domainEventId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationOutboxEvent_idempotencyKey_key" ON "IntegrationOutboxEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "IntegrationOutboxEvent_status_idx" ON "IntegrationOutboxEvent"("status");

-- CreateIndex
CREATE INDEX "IntegrationOutboxEvent_personId_idx" ON "IntegrationOutboxEvent"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "GhlWebhookEvent_externalEventId_key" ON "GhlWebhookEvent"("externalEventId");

-- CreateIndex
CREATE UNIQUE INDEX "GhlTagMapping_eventKey_key" ON "GhlTagMapping"("eventKey");

-- CreateIndex
CREATE UNIQUE INDEX "GhlCustomFieldMapping_maiaField_key" ON "GhlCustomFieldMapping"("maiaField");

-- CreateIndex
CREATE UNIQUE INDEX "GhlWorkflowMapping_eventKey_key" ON "GhlWorkflowMapping"("eventKey");

-- CreateIndex
CREATE INDEX "CommunicationLog_personId_idx" ON "CommunicationLog"("personId");

-- CreateIndex
CREATE INDEX "CommunicationLog_leadId_idx" ON "CommunicationLog"("leadId");

-- CreateIndex
CREATE INDEX "CommunicationLog_studentId_idx" ON "CommunicationLog"("studentId");

-- CreateIndex
CREATE INDEX "CommunicationLog_status_idx" ON "CommunicationLog"("status");

-- AddForeignKey
ALTER TABLE "CommunicationLog" ADD CONSTRAINT "CommunicationLog_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationLog" ADD CONSTRAINT "CommunicationLog_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MessageTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GhlContactMap" ADD CONSTRAINT "GhlContactMap_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationOutboxEvent" ADD CONSTRAINT "IntegrationOutboxEvent_domainEventId_fkey" FOREIGN KEY ("domainEventId") REFERENCES "DomainEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

