-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "stage" TEXT,
ADD COLUMN     "stageSetAt" TIMESTAMP(3),
ADD COLUMN     "stageSetById" TEXT,
ADD COLUMN     "uiExperienceLevel" TEXT NOT NULL DEFAULT 'GUIDED';

-- CreateTable
CREATE TABLE "BusinessPipeline" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "stagesJson" JSONB NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessPipeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessContact" (
    "id" TEXT NOT NULL,
    "contactDisplayId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "source" TEXT,
    "campaignId" TEXT,
    "pipelineStageKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "ownerId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "opportunityDisplayId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "pipelineStageKey" TEXT NOT NULL,
    "estimatedValue" DECIMAL(12,2),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "ownerId" TEXT,
    "nextAction" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL,
    "goalDisplayId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "target" DECIMAL(14,2) NOT NULL,
    "unit" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "currentValue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "dataSource" TEXT NOT NULL DEFAULT 'MANUAL',
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "ownerId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessPlan" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "currentVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessPlanVersion" (
    "id" TEXT NOT NULL,
    "businessPlanId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "sectionsJson" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessPlanVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessRevenueRecord" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "source" TEXT NOT NULL,
    "description" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "relatedOpportunityId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessRevenueRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessExpenseRecord" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessExpenseRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "productDisplayId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(12,2),
    "cost" DECIMAL(12,2),
    "category" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "offerId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SopDocument" (
    "id" TEXT NOT NULL,
    "sopDisplayId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "purpose" TEXT,
    "stepsJson" JSONB NOT NULL,
    "ownerId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "relatedProcess" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SopDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentCalendarItem" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'IDEA',
    "scheduledDate" TIMESTAMP(3),
    "relatedHookId" TEXT,
    "relatedScriptId" TEXT,
    "campaignId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentCalendarItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessRoleGrant" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessRoleGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessPipeline_businessId_key" ON "BusinessPipeline"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessContact_contactDisplayId_key" ON "BusinessContact"("contactDisplayId");

-- CreateIndex
CREATE INDEX "BusinessContact_businessId_idx" ON "BusinessContact"("businessId");

-- CreateIndex
CREATE INDEX "BusinessContact_personId_idx" ON "BusinessContact"("personId");

-- CreateIndex
CREATE INDEX "BusinessContact_pipelineStageKey_idx" ON "BusinessContact"("pipelineStageKey");

-- CreateIndex
CREATE UNIQUE INDEX "Opportunity_opportunityDisplayId_key" ON "Opportunity"("opportunityDisplayId");

-- CreateIndex
CREATE INDEX "Opportunity_businessId_idx" ON "Opportunity"("businessId");

-- CreateIndex
CREATE INDEX "Opportunity_contactId_idx" ON "Opportunity"("contactId");

-- CreateIndex
CREATE INDEX "Opportunity_status_idx" ON "Opportunity"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Goal_goalDisplayId_key" ON "Goal"("goalDisplayId");

-- CreateIndex
CREATE INDEX "Goal_businessId_idx" ON "Goal"("businessId");

-- CreateIndex
CREATE INDEX "Goal_status_idx" ON "Goal"("status");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessPlan_businessId_key" ON "BusinessPlan"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessPlan_currentVersionId_key" ON "BusinessPlan"("currentVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessPlanVersion_businessPlanId_versionNumber_key" ON "BusinessPlanVersion"("businessPlanId", "versionNumber");

-- CreateIndex
CREATE INDEX "BusinessRevenueRecord_businessId_idx" ON "BusinessRevenueRecord"("businessId");

-- CreateIndex
CREATE INDEX "BusinessRevenueRecord_occurredAt_idx" ON "BusinessRevenueRecord"("occurredAt");

-- CreateIndex
CREATE INDEX "BusinessExpenseRecord_businessId_idx" ON "BusinessExpenseRecord"("businessId");

-- CreateIndex
CREATE INDEX "BusinessExpenseRecord_occurredAt_idx" ON "BusinessExpenseRecord"("occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "Product_productDisplayId_key" ON "Product"("productDisplayId");

-- CreateIndex
CREATE INDEX "Product_businessId_idx" ON "Product"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "SopDocument_sopDisplayId_key" ON "SopDocument"("sopDisplayId");

-- CreateIndex
CREATE INDEX "SopDocument_businessId_idx" ON "SopDocument"("businessId");

-- CreateIndex
CREATE INDEX "ContentCalendarItem_businessId_idx" ON "ContentCalendarItem"("businessId");

-- CreateIndex
CREATE INDEX "ContentCalendarItem_stage_idx" ON "ContentCalendarItem"("stage");

-- CreateIndex
CREATE INDEX "BusinessRoleGrant_businessId_idx" ON "BusinessRoleGrant"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessRoleGrant_businessId_userId_key" ON "BusinessRoleGrant"("businessId", "userId");

-- AddForeignKey
ALTER TABLE "BusinessPipeline" ADD CONSTRAINT "BusinessPipeline_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessContact" ADD CONSTRAINT "BusinessContact_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessContact" ADD CONSTRAINT "BusinessContact_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "BusinessContact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessPlan" ADD CONSTRAINT "BusinessPlan_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessPlan" ADD CONSTRAINT "BusinessPlan_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "BusinessPlanVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessPlanVersion" ADD CONSTRAINT "BusinessPlanVersion_businessPlanId_fkey" FOREIGN KEY ("businessPlanId") REFERENCES "BusinessPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessRevenueRecord" ADD CONSTRAINT "BusinessRevenueRecord_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessRevenueRecord" ADD CONSTRAINT "BusinessRevenueRecord_relatedOpportunityId_fkey" FOREIGN KEY ("relatedOpportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessExpenseRecord" ADD CONSTRAINT "BusinessExpenseRecord_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SopDocument" ADD CONSTRAINT "SopDocument_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentCalendarItem" ADD CONSTRAINT "ContentCalendarItem_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessRoleGrant" ADD CONSTRAINT "BusinessRoleGrant_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessRoleGrant" ADD CONSTRAINT "BusinessRoleGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

