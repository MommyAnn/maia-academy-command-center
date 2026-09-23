-- CreateTable
CREATE TABLE "AdConnection" (
    "id" TEXT NOT NULL,
    "connectionDisplayId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_CONNECTED',
    "mode" TEXT NOT NULL DEFAULT 'READ_ONLY',
    "credentialsConfigured" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdAccount" (
    "id" TEXT NOT NULL,
    "adAccountDisplayId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "externalAccountId" TEXT,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdCampaign" (
    "id" TEXT NOT NULL,
    "campaignDisplayId" TEXT NOT NULL,
    "adAccountId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "externalCampaignId" TEXT,
    "name" TEXT NOT NULL,
    "objective" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "dailyBudget" DECIMAL(12,2),
    "lifetimeBudget" DECIMAL(12,2),
    "currency" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "source" TEXT NOT NULL,
    "utmCampaign" TEXT,
    "offerId" TEXT,
    "creativePackageId" TEXT,
    "funnelId" TEXT,
    "journeyId" TEXT,
    "marketingCampaignId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdSet" (
    "id" TEXT NOT NULL,
    "adSetDisplayId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "externalAdSetId" TEXT,
    "name" TEXT NOT NULL,
    "audienceJson" JSONB,
    "placement" TEXT,
    "dailyBudget" DECIMAL(12,2),
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ad" (
    "id" TEXT NOT NULL,
    "adDisplayId" TEXT NOT NULL,
    "adSetId" TEXT NOT NULL,
    "externalAdId" TEXT,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "landingPageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdCreativeLink" (
    "id" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "creativePackageId" TEXT,
    "hookId" TEXT,
    "creativeAngleId" TEXT,
    "scriptId" TEXT,
    "assetDocumentId" TEXT,
    "format" TEXT,
    "ctaType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdCreativeLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdPerformanceSnapshot" (
    "id" TEXT NOT NULL,
    "adAccountId" TEXT NOT NULL,
    "campaignId" TEXT,
    "adSetId" TEXT,
    "adId" TEXT,
    "provider" TEXT NOT NULL,
    "dateFrom" TIMESTAMP(3) NOT NULL,
    "dateTo" TIMESTAMP(3) NOT NULL,
    "currency" TEXT,
    "spend" DECIMAL(14,2),
    "impressions" INTEGER,
    "reach" INTEGER,
    "frequency" DOUBLE PRECISION,
    "cpm" DECIMAL(14,4),
    "clicks" INTEGER,
    "linkClicks" INTEGER,
    "ctr" DOUBLE PRECISION,
    "cpc" DECIMAL(14,4),
    "landingPageViews" INTEGER,
    "messages" INTEGER,
    "leads" INTEGER,
    "purchases" INTEGER,
    "purchaseValue" DECIMAL(14,2),
    "rawMetricsJson" JSONB,
    "source" TEXT NOT NULL,
    "importBatchId" TEXT,
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdPerformanceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdAttributionRecord" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "adCampaignId" TEXT NOT NULL,
    "adSetId" TEXT,
    "adId" TEXT,
    "touchType" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "matchedUtmJson" JSONB NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdAttributionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdBudgetAlertRule" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "adCampaignId" TEXT,
    "metric" TEXT NOT NULL,
    "comparator" TEXT NOT NULL,
    "threshold" DECIMAL(14,4) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdBudgetAlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdRecommendation" (
    "id" TEXT NOT NULL,
    "recommendationDisplayId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "adCampaignId" TEXT,
    "adSetId" TEXT,
    "adId" TEXT,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "bodyJson" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "actionedById" TEXT,
    "actionedAt" TIMESTAMP(3),
    "actionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdOptimizationAction" (
    "id" TEXT NOT NULL,
    "actionDisplayId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "adCampaignId" TEXT NOT NULL,
    "recommendationId" TEXT,
    "actionType" TEXT NOT NULL,
    "currentValueJson" JSONB,
    "proposedValueJson" JSONB,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    "requestedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdOptimizationAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdTestPlan" (
    "id" TEXT NOT NULL,
    "testDisplayId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "adCampaignId" TEXT,
    "name" TEXT NOT NULL,
    "hypothesis" TEXT NOT NULL,
    "variable" TEXT NOT NULL,
    "audience" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "metricFocus" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdTestPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdTestVariant" (
    "id" TEXT NOT NULL,
    "testPlanId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "adId" TEXT,
    "creativeLinkId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdTestVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdCampaignPlan" (
    "id" TEXT NOT NULL,
    "planDisplayId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "offerId" TEXT,
    "objective" TEXT NOT NULL,
    "audienceJson" JSONB,
    "creativeStrategyJson" JSONB,
    "funnelPlanJson" JSONB,
    "trackingPlanJson" JSONB,
    "budgetContextJson" JSONB,
    "testingPlanJson" JSONB,
    "metricsToWatchJson" JSONB,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "generationId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdCampaignPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdImportBatch" (
    "id" TEXT NOT NULL,
    "importDisplayId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "adAccountId" TEXT NOT NULL,
    "fileNameOriginal" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "rowCountTotal" INTEGER NOT NULL DEFAULT 0,
    "rowCountValid" INTEGER NOT NULL DEFAULT 0,
    "rowCountInvalid" INTEGER NOT NULL DEFAULT 0,
    "rowCountDuplicate" INTEGER NOT NULL DEFAULT 0,
    "errorsJson" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdConnection_connectionDisplayId_key" ON "AdConnection"("connectionDisplayId");

-- CreateIndex
CREATE INDEX "AdConnection_studentId_idx" ON "AdConnection"("studentId");

-- CreateIndex
CREATE INDEX "AdConnection_businessId_idx" ON "AdConnection"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "AdAccount_adAccountDisplayId_key" ON "AdAccount"("adAccountDisplayId");

-- CreateIndex
CREATE INDEX "AdAccount_connectionId_idx" ON "AdAccount"("connectionId");

-- CreateIndex
CREATE INDEX "AdAccount_studentId_idx" ON "AdAccount"("studentId");

-- CreateIndex
CREATE INDEX "AdAccount_businessId_idx" ON "AdAccount"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "AdCampaign_campaignDisplayId_key" ON "AdCampaign"("campaignDisplayId");

-- CreateIndex
CREATE INDEX "AdCampaign_adAccountId_idx" ON "AdCampaign"("adAccountId");

-- CreateIndex
CREATE INDEX "AdCampaign_studentId_idx" ON "AdCampaign"("studentId");

-- CreateIndex
CREATE INDEX "AdCampaign_businessId_idx" ON "AdCampaign"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "AdSet_adSetDisplayId_key" ON "AdSet"("adSetDisplayId");

-- CreateIndex
CREATE INDEX "AdSet_campaignId_idx" ON "AdSet"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "Ad_adDisplayId_key" ON "Ad"("adDisplayId");

-- CreateIndex
CREATE INDEX "Ad_adSetId_idx" ON "Ad"("adSetId");

-- CreateIndex
CREATE UNIQUE INDEX "AdCreativeLink_adId_key" ON "AdCreativeLink"("adId");

-- CreateIndex
CREATE INDEX "AdCreativeLink_creativePackageId_idx" ON "AdCreativeLink"("creativePackageId");

-- CreateIndex
CREATE INDEX "AdCreativeLink_hookId_idx" ON "AdCreativeLink"("hookId");

-- CreateIndex
CREATE INDEX "AdPerformanceSnapshot_adAccountId_dateFrom_dateTo_idx" ON "AdPerformanceSnapshot"("adAccountId", "dateFrom", "dateTo");

-- CreateIndex
CREATE INDEX "AdPerformanceSnapshot_campaignId_dateFrom_dateTo_idx" ON "AdPerformanceSnapshot"("campaignId", "dateFrom", "dateTo");

-- CreateIndex
CREATE INDEX "AdPerformanceSnapshot_adSetId_dateFrom_dateTo_idx" ON "AdPerformanceSnapshot"("adSetId", "dateFrom", "dateTo");

-- CreateIndex
CREATE INDEX "AdPerformanceSnapshot_adId_dateFrom_dateTo_idx" ON "AdPerformanceSnapshot"("adId", "dateFrom", "dateTo");

-- CreateIndex
CREATE INDEX "AdAttributionRecord_adCampaignId_idx" ON "AdAttributionRecord"("adCampaignId");

-- CreateIndex
CREATE UNIQUE INDEX "AdAttributionRecord_leadId_adCampaignId_touchType_key" ON "AdAttributionRecord"("leadId", "adCampaignId", "touchType");

-- CreateIndex
CREATE INDEX "AdBudgetAlertRule_studentId_idx" ON "AdBudgetAlertRule"("studentId");

-- CreateIndex
CREATE INDEX "AdBudgetAlertRule_businessId_idx" ON "AdBudgetAlertRule"("businessId");

-- CreateIndex
CREATE INDEX "AdBudgetAlertRule_adCampaignId_idx" ON "AdBudgetAlertRule"("adCampaignId");

-- CreateIndex
CREATE UNIQUE INDEX "AdRecommendation_recommendationDisplayId_key" ON "AdRecommendation"("recommendationDisplayId");

-- CreateIndex
CREATE INDEX "AdRecommendation_studentId_idx" ON "AdRecommendation"("studentId");

-- CreateIndex
CREATE INDEX "AdRecommendation_businessId_idx" ON "AdRecommendation"("businessId");

-- CreateIndex
CREATE INDEX "AdRecommendation_adCampaignId_idx" ON "AdRecommendation"("adCampaignId");

-- CreateIndex
CREATE UNIQUE INDEX "AdOptimizationAction_actionDisplayId_key" ON "AdOptimizationAction"("actionDisplayId");

-- CreateIndex
CREATE INDEX "AdOptimizationAction_adCampaignId_idx" ON "AdOptimizationAction"("adCampaignId");

-- CreateIndex
CREATE INDEX "AdOptimizationAction_studentId_idx" ON "AdOptimizationAction"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "AdTestPlan_testDisplayId_key" ON "AdTestPlan"("testDisplayId");

-- CreateIndex
CREATE INDEX "AdTestPlan_studentId_idx" ON "AdTestPlan"("studentId");

-- CreateIndex
CREATE INDEX "AdTestPlan_businessId_idx" ON "AdTestPlan"("businessId");

-- CreateIndex
CREATE INDEX "AdTestVariant_testPlanId_idx" ON "AdTestVariant"("testPlanId");

-- CreateIndex
CREATE UNIQUE INDEX "AdCampaignPlan_planDisplayId_key" ON "AdCampaignPlan"("planDisplayId");

-- CreateIndex
CREATE INDEX "AdCampaignPlan_studentId_idx" ON "AdCampaignPlan"("studentId");

-- CreateIndex
CREATE INDEX "AdCampaignPlan_businessId_idx" ON "AdCampaignPlan"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "AdImportBatch_importDisplayId_key" ON "AdImportBatch"("importDisplayId");

-- CreateIndex
CREATE INDEX "AdImportBatch_adAccountId_idx" ON "AdImportBatch"("adAccountId");

-- CreateIndex
CREATE INDEX "AdImportBatch_studentId_idx" ON "AdImportBatch"("studentId");

-- AddForeignKey
ALTER TABLE "AdConnection" ADD CONSTRAINT "AdConnection_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdConnection" ADD CONSTRAINT "AdConnection_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdAccount" ADD CONSTRAINT "AdAccount_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "AdConnection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdCampaign" ADD CONSTRAINT "AdCampaign_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "AdAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdSet" ADD CONSTRAINT "AdSet_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AdCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ad" ADD CONSTRAINT "Ad_adSetId_fkey" FOREIGN KEY ("adSetId") REFERENCES "AdSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdCreativeLink" ADD CONSTRAINT "AdCreativeLink_adId_fkey" FOREIGN KEY ("adId") REFERENCES "Ad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdPerformanceSnapshot" ADD CONSTRAINT "AdPerformanceSnapshot_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "AdAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdPerformanceSnapshot" ADD CONSTRAINT "AdPerformanceSnapshot_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AdCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdPerformanceSnapshot" ADD CONSTRAINT "AdPerformanceSnapshot_adSetId_fkey" FOREIGN KEY ("adSetId") REFERENCES "AdSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdPerformanceSnapshot" ADD CONSTRAINT "AdPerformanceSnapshot_adId_fkey" FOREIGN KEY ("adId") REFERENCES "Ad"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdAttributionRecord" ADD CONSTRAINT "AdAttributionRecord_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdAttributionRecord" ADD CONSTRAINT "AdAttributionRecord_adCampaignId_fkey" FOREIGN KEY ("adCampaignId") REFERENCES "AdCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdBudgetAlertRule" ADD CONSTRAINT "AdBudgetAlertRule_adCampaignId_fkey" FOREIGN KEY ("adCampaignId") REFERENCES "AdCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdRecommendation" ADD CONSTRAINT "AdRecommendation_adCampaignId_fkey" FOREIGN KEY ("adCampaignId") REFERENCES "AdCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdOptimizationAction" ADD CONSTRAINT "AdOptimizationAction_adCampaignId_fkey" FOREIGN KEY ("adCampaignId") REFERENCES "AdCampaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdTestVariant" ADD CONSTRAINT "AdTestVariant_testPlanId_fkey" FOREIGN KEY ("testPlanId") REFERENCES "AdTestPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdImportBatch" ADD CONSTRAINT "AdImportBatch_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "AdAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

