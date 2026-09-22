-- AlterEnum
ALTER TYPE "LeadStage" ADD VALUE 'NO_RESPONSE';

-- AlterTable
ALTER TABLE "FollowUp" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "nextFollowUpAt" TIMESTAMP(3),
ADD COLUMN     "purpose" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'Scheduled',
ADD COLUMN     "taskId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "businessName" TEXT,
ADD COLUMN     "businessStatus" TEXT,
ADD COLUMN     "canEmail" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canSms" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "canWhatsapp" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "consentDate" TIMESTAMP(3),
ADD COLUMN     "consentSource" TEXT,
ADD COLUMN     "consentVersion" TEXT,
ADD COLUMN     "dnd" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "firstRegistrationDate" TIMESTAMP(3),
ADD COLUMN     "landingPage" TEXT,
ADD COLUMN     "lastFollowUpAt" TIMESTAMP(3),
ADD COLUMN     "leadOwnerId" TEXT,
ADD COLUMN     "nextFollowUpAt" TIMESTAMP(3),
ADD COLUMN     "optedOut" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "referralSource" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'Active',
ADD COLUMN     "utmCampaign" TEXT,
ADD COLUMN     "utmContent" TEXT,
ADD COLUMN     "utmMedium" TEXT,
ADD COLUMN     "utmSource" TEXT,
ADD COLUMN     "utmTerm" TEXT;

-- AlterTable
ALTER TABLE "WebinarRegistration" DROP COLUMN "marketingConsent",
ADD COLUMN     "campaign" TEXT,
ADD COLUMN     "consentReference" TEXT,
ADD COLUMN     "landingPage" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "recordedAt" TIMESTAMP(3),
ADD COLUMN     "recordedById" TEXT,
ADD COLUMN     "referralSource" TEXT,
ADD COLUMN     "registrationStatus" TEXT NOT NULL DEFAULT 'Registered',
ADD COLUMN     "source" TEXT,
ADD COLUMN     "utmCampaign" TEXT,
ADD COLUMN     "utmContent" TEXT,
ADD COLUMN     "utmMedium" TEXT,
ADD COLUMN     "utmSource" TEXT,
ADD COLUMN     "utmTerm" TEXT,
ALTER COLUMN "attendanceStatus" SET NOT NULL,
ALTER COLUMN "attendanceStatus" SET DEFAULT 'Registered';

-- AlterTable
ALTER TABLE "WebinarSession" DROP COLUMN "scheduledAt",
ADD COLUMN     "capacity" INTEGER,
ADD COLUMN     "date" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "endTime" TEXT NOT NULL,
ADD COLUMN     "host" TEXT,
ADD COLUMN     "meetingId" TEXT,
ADD COLUMN     "meetingLink" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "passcode" TEXT,
ADD COLUMN     "registrationCloseDate" TIMESTAMP(3),
ADD COLUMN     "registrationOpenDate" TIMESTAMP(3),
ADD COLUMN     "sessionDisplayId" TEXT NOT NULL,
ADD COLUMN     "startTime" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'Draft';

-- CreateTable
CREATE TABLE "LeadPipelineHistory" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "previousStage" "LeadStage",
    "newStage" "LeadStage" NOT NULL,
    "changedById" TEXT,
    "reason" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadPipelineHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadNote" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadConsentEvent" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "canEmail" BOOLEAN NOT NULL,
    "canSms" BOOLEAN NOT NULL,
    "canWhatsapp" BOOLEAN NOT NULL,
    "optedOut" BOOLEAN NOT NULL,
    "consentVersion" TEXT,
    "source" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadConsentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadPipelineHistory_leadId_idx" ON "LeadPipelineHistory"("leadId");

-- CreateIndex
CREATE INDEX "LeadNote_leadId_idx" ON "LeadNote"("leadId");

-- CreateIndex
CREATE INDEX "LeadConsentEvent_leadId_idx" ON "LeadConsentEvent"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "FollowUp_taskId_key" ON "FollowUp"("taskId");

-- CreateIndex
CREATE INDEX "FollowUp_assignedStaffId_idx" ON "FollowUp"("assignedStaffId");

-- CreateIndex
CREATE INDEX "FollowUp_status_idx" ON "FollowUp"("status");

-- CreateIndex
CREATE INDEX "Lead_leadOwnerId_idx" ON "Lead"("leadOwnerId");

-- CreateIndex
CREATE UNIQUE INDEX "WebinarRegistration_sessionId_leadId_key" ON "WebinarRegistration"("sessionId", "leadId");

-- CreateIndex
CREATE UNIQUE INDEX "WebinarSession_sessionDisplayId_key" ON "WebinarSession"("sessionDisplayId");

-- AddForeignKey
ALTER TABLE "LeadPipelineHistory" ADD CONSTRAINT "LeadPipelineHistory_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadNote" ADD CONSTRAINT "LeadNote_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadConsentEvent" ADD CONSTRAINT "LeadConsentEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

