-- AlterTable
ALTER TABLE "Promotion" ADD COLUMN     "minimumPurchaseAmount" DECIMAL(12,2),
ADD COLUMN     "perCustomerLimit" INTEGER,
ADD COLUMN     "stackable" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN     "affiliateAttributionJson" JSONB,
ADD COLUMN     "affiliateId" TEXT,
ADD COLUMN     "businessId" TEXT,
ADD COLUMN     "checkoutSessionId" TEXT,
ADD COLUMN     "creditsApplied" DECIMAL(12,2),
ADD COLUMN     "fulfillmentStatus" TEXT NOT NULL DEFAULT 'NOT_READY',
ADD COLUMN     "productSnapshotJson" JSONB,
ADD COLUMN     "quantity" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'CHECKOUT',
ADD COLUMN     "subtotal" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "CheckoutSession" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "businessId" TEXT,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "promotionCode" TEXT,
    "affiliateReferralCode" TEXT,
    "computedPriceJson" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckoutSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentWebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "signatureValid" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "purchaseId" TEXT,
    "errorMessage" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefundRequest" (
    "id" TEXT NOT NULL,
    "refundDisplayId" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "providerRefundRef" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefundRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SponsoredAccess" (
    "id" TEXT NOT NULL,
    "sponsoredAccessDisplayId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "sponsorSource" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "requirementsText" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NOMINATED',
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SponsoredAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Affiliate" (
    "id" TEXT NOT NULL,
    "affiliateDisplayId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'APPLIED',
    "referralCode" TEXT NOT NULL,
    "commissionPlanId" TEXT,
    "payoutDetailsStatus" TEXT NOT NULL DEFAULT 'NOT_PROVIDED',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Affiliate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "rate" DECIMAL(5,2),
    "fixedAmount" DECIMAL(12,2),
    "productScopeJson" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralEvent" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "personId" TEXT,
    "purchaseId" TEXT,
    "metadataJson" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commission" (
    "id" TEXT NOT NULL,
    "commissionDisplayId" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "commissionPlanId" TEXT NOT NULL,
    "basisAmount" DECIMAL(12,2) NOT NULL,
    "ruleSnapshotJson" JSONB NOT NULL,
    "commissionAmount" DECIMAL(12,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "eligibleDate" TIMESTAMP(3),
    "payoutBatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Commission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutBatch" (
    "id" TEXT NOT NULL,
    "payoutBatchDisplayId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "referenceNote" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayoutBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CheckoutSession_sessionToken_key" ON "CheckoutSession"("sessionToken");

-- CreateIndex
CREATE INDEX "CheckoutSession_studentId_idx" ON "CheckoutSession"("studentId");

-- CreateIndex
CREATE INDEX "CheckoutSession_status_idx" ON "CheckoutSession"("status");

-- CreateIndex
CREATE INDEX "PaymentWebhookEvent_status_idx" ON "PaymentWebhookEvent"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentWebhookEvent_provider_providerEventId_key" ON "PaymentWebhookEvent"("provider", "providerEventId");

-- CreateIndex
CREATE UNIQUE INDEX "RefundRequest_refundDisplayId_key" ON "RefundRequest"("refundDisplayId");

-- CreateIndex
CREATE INDEX "RefundRequest_purchaseId_idx" ON "RefundRequest"("purchaseId");

-- CreateIndex
CREATE INDEX "RefundRequest_studentId_idx" ON "RefundRequest"("studentId");

-- CreateIndex
CREATE INDEX "RefundRequest_status_idx" ON "RefundRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SponsoredAccess_sponsoredAccessDisplayId_key" ON "SponsoredAccess"("sponsoredAccessDisplayId");

-- CreateIndex
CREATE INDEX "SponsoredAccess_studentId_idx" ON "SponsoredAccess"("studentId");

-- CreateIndex
CREATE INDEX "SponsoredAccess_status_idx" ON "SponsoredAccess"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Affiliate_affiliateDisplayId_key" ON "Affiliate"("affiliateDisplayId");

-- CreateIndex
CREATE UNIQUE INDEX "Affiliate_personId_key" ON "Affiliate"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "Affiliate_referralCode_key" ON "Affiliate"("referralCode");

-- CreateIndex
CREATE INDEX "Affiliate_status_idx" ON "Affiliate"("status");

-- CreateIndex
CREATE INDEX "ReferralEvent_affiliateId_idx" ON "ReferralEvent"("affiliateId");

-- CreateIndex
CREATE INDEX "ReferralEvent_kind_idx" ON "ReferralEvent"("kind");

-- CreateIndex
CREATE INDEX "ReferralEvent_purchaseId_idx" ON "ReferralEvent"("purchaseId");

-- CreateIndex
CREATE UNIQUE INDEX "Commission_commissionDisplayId_key" ON "Commission"("commissionDisplayId");

-- CreateIndex
CREATE INDEX "Commission_affiliateId_idx" ON "Commission"("affiliateId");

-- CreateIndex
CREATE INDEX "Commission_purchaseId_idx" ON "Commission"("purchaseId");

-- CreateIndex
CREATE INDEX "Commission_status_idx" ON "Commission"("status");

-- CreateIndex
CREATE INDEX "Commission_payoutBatchId_idx" ON "Commission"("payoutBatchId");

-- CreateIndex
CREATE UNIQUE INDEX "PayoutBatch_payoutBatchDisplayId_key" ON "PayoutBatch"("payoutBatchDisplayId");

-- CreateIndex
CREATE INDEX "PayoutBatch_status_idx" ON "PayoutBatch"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_checkoutSessionId_key" ON "Purchase"("checkoutSessionId");

-- CreateIndex
CREATE INDEX "Purchase_fulfillmentStatus_idx" ON "Purchase"("fulfillmentStatus");

-- CreateIndex
CREATE INDEX "Purchase_affiliateId_idx" ON "Purchase"("affiliateId");

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_checkoutSessionId_fkey" FOREIGN KEY ("checkoutSessionId") REFERENCES "CheckoutSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutSession" ADD CONSTRAINT "CheckoutSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckoutSession" ADD CONSTRAINT "CheckoutSession_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CommerceProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentWebhookEvent" ADD CONSTRAINT "PaymentWebhookEvent_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SponsoredAccess" ADD CONSTRAINT "SponsoredAccess_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SponsoredAccess" ADD CONSTRAINT "SponsoredAccess_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CommerceProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Affiliate" ADD CONSTRAINT "Affiliate_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Affiliate" ADD CONSTRAINT "Affiliate_commissionPlanId_fkey" FOREIGN KEY ("commissionPlanId") REFERENCES "CommissionPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralEvent" ADD CONSTRAINT "ReferralEvent_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralEvent" ADD CONSTRAINT "ReferralEvent_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "Affiliate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_commissionPlanId_fkey" FOREIGN KEY ("commissionPlanId") REFERENCES "CommissionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_payoutBatchId_fkey" FOREIGN KEY ("payoutBatchId") REFERENCES "PayoutBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

