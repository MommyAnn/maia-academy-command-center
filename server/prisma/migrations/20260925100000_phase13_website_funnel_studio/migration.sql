-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "offerDisplayId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(12,2),
    "currency" TEXT DEFAULT 'PHP',
    "detailsJson" JSONB,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteProject" (
    "id" TEXT NOT NULL,
    "websiteDisplayId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "purpose" TEXT,
    "type" TEXT NOT NULL,
    "primaryAudience" TEXT,
    "primaryCta" TEXT,
    "masterBrainVersionAtCreation" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "journeyId" TEXT,
    "campaignId" TEXT,
    "offerId" TEXT,
    "creativePackageId" TEXT,
    "automationId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Funnel" (
    "id" TEXT NOT NULL,
    "funnelDisplayId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "objective" TEXT,
    "audience" TEXT,
    "offerId" TEXT,
    "trafficSource" TEXT,
    "type" TEXT NOT NULL,
    "stagesJson" JSONB NOT NULL,
    "masterBrainVersionAtCreation" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "campaignId" TEXT,
    "journeyId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Funnel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsitePage" (
    "id" TEXT NOT NULL,
    "pageDisplayId" TEXT NOT NULL,
    "websiteProjectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sectionsJson" JSONB NOT NULL,
    "seoJson" JSONB,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "publishedSnapshotJson" JSONB,
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsitePage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageVersion" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "sectionsJson" JSONB NOT NULL,
    "seoJson" JSONB,
    "validationJson" JSONB,
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageCopyVariant" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "isApplied" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageCopyVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebForm" (
    "id" TEXT NOT NULL,
    "formDisplayId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "pageId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fieldsJson" JSONB NOT NULL,
    "consentConfigJson" JSONB,
    "destinationConfigJson" JSONB,
    "thankYouPageId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormSubmission" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "dataJson" JSONB NOT NULL,
    "personId" TEXT,
    "leadId" TEXT,
    "resultingEntityType" TEXT,
    "resultingEntityId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Processed',
    "rejectionReason" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteDomain" (
    "id" TEXT NOT NULL,
    "websiteProjectId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_CONNECTED',
    "dnsInstructionsJson" JSONB,
    "verifiedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteDomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackingConfig" (
    "id" TEXT NOT NULL,
    "websiteProjectId" TEXT NOT NULL,
    "metaPixelId" TEXT,
    "metaPixelStatus" TEXT NOT NULL DEFAULT 'NOT_CONNECTED',
    "googleAnalyticsId" TEXT,
    "googleAnalyticsStatus" TEXT NOT NULL DEFAULT 'NOT_CONNECTED',
    "consentRequired" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackingConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteAnalyticsEvent" (
    "id" TEXT NOT NULL,
    "websiteProjectId" TEXT NOT NULL,
    "pageId" TEXT,
    "eventName" TEXT NOT NULL,
    "detailsJson" JSONB,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebsiteAnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Offer_offerDisplayId_key" ON "Offer"("offerDisplayId");

-- CreateIndex
CREATE INDEX "Offer_studentId_idx" ON "Offer"("studentId");

-- CreateIndex
CREATE INDEX "Offer_businessId_idx" ON "Offer"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteProject_websiteDisplayId_key" ON "WebsiteProject"("websiteDisplayId");

-- CreateIndex
CREATE INDEX "WebsiteProject_studentId_idx" ON "WebsiteProject"("studentId");

-- CreateIndex
CREATE INDEX "WebsiteProject_businessId_idx" ON "WebsiteProject"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "Funnel_funnelDisplayId_key" ON "Funnel"("funnelDisplayId");

-- CreateIndex
CREATE INDEX "Funnel_studentId_idx" ON "Funnel"("studentId");

-- CreateIndex
CREATE INDEX "Funnel_businessId_idx" ON "Funnel"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "WebsitePage_pageDisplayId_key" ON "WebsitePage"("pageDisplayId");

-- CreateIndex
CREATE INDEX "WebsitePage_websiteProjectId_idx" ON "WebsitePage"("websiteProjectId");

-- CreateIndex
CREATE UNIQUE INDEX "WebsitePage_websiteProjectId_slug_key" ON "WebsitePage"("websiteProjectId", "slug");

-- CreateIndex
CREATE INDEX "PageVersion_pageId_idx" ON "PageVersion"("pageId");

-- CreateIndex
CREATE UNIQUE INDEX "PageVersion_pageId_versionNumber_key" ON "PageVersion"("pageId", "versionNumber");

-- CreateIndex
CREATE INDEX "PageCopyVariant_pageId_idx" ON "PageCopyVariant"("pageId");

-- CreateIndex
CREATE UNIQUE INDEX "WebForm_formDisplayId_key" ON "WebForm"("formDisplayId");

-- CreateIndex
CREATE INDEX "WebForm_businessId_idx" ON "WebForm"("businessId");

-- CreateIndex
CREATE INDEX "WebForm_pageId_idx" ON "WebForm"("pageId");

-- CreateIndex
CREATE INDEX "FormSubmission_formId_idx" ON "FormSubmission"("formId");

-- CreateIndex
CREATE INDEX "FormSubmission_personId_idx" ON "FormSubmission"("personId");

-- CreateIndex
CREATE INDEX "WebsiteDomain_websiteProjectId_idx" ON "WebsiteDomain"("websiteProjectId");

-- CreateIndex
CREATE UNIQUE INDEX "TrackingConfig_websiteProjectId_key" ON "TrackingConfig"("websiteProjectId");

-- CreateIndex
CREATE INDEX "WebsiteAnalyticsEvent_websiteProjectId_eventName_idx" ON "WebsiteAnalyticsEvent"("websiteProjectId", "eventName");

-- CreateIndex
CREATE INDEX "WebsiteAnalyticsEvent_pageId_eventName_idx" ON "WebsiteAnalyticsEvent"("pageId", "eventName");

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteProject" ADD CONSTRAINT "WebsiteProject_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteProject" ADD CONSTRAINT "WebsiteProject_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteProject" ADD CONSTRAINT "WebsiteProject_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Funnel" ADD CONSTRAINT "Funnel_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Funnel" ADD CONSTRAINT "Funnel_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Funnel" ADD CONSTRAINT "Funnel_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsitePage" ADD CONSTRAINT "WebsitePage_websiteProjectId_fkey" FOREIGN KEY ("websiteProjectId") REFERENCES "WebsiteProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageVersion" ADD CONSTRAINT "PageVersion_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "WebsitePage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageCopyVariant" ADD CONSTRAINT "PageCopyVariant_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "WebsitePage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebForm" ADD CONSTRAINT "WebForm_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebForm" ADD CONSTRAINT "WebForm_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "WebsitePage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_formId_fkey" FOREIGN KEY ("formId") REFERENCES "WebForm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteDomain" ADD CONSTRAINT "WebsiteDomain_websiteProjectId_fkey" FOREIGN KEY ("websiteProjectId") REFERENCES "WebsiteProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingConfig" ADD CONSTRAINT "TrackingConfig_websiteProjectId_fkey" FOREIGN KEY ("websiteProjectId") REFERENCES "WebsiteProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteAnalyticsEvent" ADD CONSTRAINT "WebsiteAnalyticsEvent_websiteProjectId_fkey" FOREIGN KEY ("websiteProjectId") REFERENCES "WebsiteProject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteAnalyticsEvent" ADD CONSTRAINT "WebsiteAnalyticsEvent_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "WebsitePage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

