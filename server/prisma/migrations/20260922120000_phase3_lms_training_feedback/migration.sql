-- AlterTable
ALTER TABLE "Certificate" ADD COLUMN     "batchId" TEXT,
ADD COLUMN     "certificateType" TEXT NOT NULL DEFAULT 'Program Completion',
ADD COLUMN     "completionDate" TIMESTAMP(3),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "preparedAt" TIMESTAMP(3),
ADD COLUMN     "preparedById" TEXT,
ADD COLUMN     "program" TEXT,
ADD COLUMN     "reissueOfId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'Not Eligible';

-- AlterTable
ALTER TABLE "ConsentEvent" ADD COLUMN     "permittedAssetsJson" JSONB NOT NULL;

-- AlterTable
ALTER TABLE "Course" DROP COLUMN "isPublished",
ADD COLUMN     "courseDisplayId" TEXT NOT NULL,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "displayOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "estimatedDuration" TEXT,
ADD COLUMN     "instructor" TEXT,
ADD COLUMN     "slug" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "thumbnailLabel" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "CourseAccessGrant" ADD COLUMN     "notes" TEXT,
ADD COLUMN     "revokedById" TEXT,
ADD COLUMN     "sourceReference" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'Active',
DROP COLUMN "source",
ADD COLUMN     "source" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "CourseModule" ADD COLUMN     "description" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'Active';

-- AlterTable
ALTER TABLE "FeedbackRequest" DROP COLUMN "source",
ADD COLUMN     "allowVideo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "allowWritten" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "audience" TEXT NOT NULL DEFAULT 'All Eligible Students',
ADD COLUMN     "audienceStudentId" TEXT,
ADD COLUMN     "batchId" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "incentiveId" TEXT,
ADD COLUMN     "message" TEXT,
ADD COLUMN     "requestDisplayId" TEXT NOT NULL,
ADD COLUMN     "sourceId" TEXT,
ADD COLUMN     "sourceLabel" TEXT,
ADD COLUMN     "sourceType" TEXT NOT NULL,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'Open',
ADD COLUMN     "title" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "FeedbackSubmission" ADD COLUMN     "answersJson" JSONB,
ADD COLUMN     "batchId" TEXT,
ADD COLUMN     "feedbackDisplayId" TEXT NOT NULL,
ADD COLUMN     "incentiveId" TEXT,
ADD COLUMN     "marketingTagsJson" JSONB,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "sourceId" TEXT,
ADD COLUMN     "sourceLabel" TEXT,
ADD COLUMN     "sourceType" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Incentive" DROP COLUMN "courseId",
DROP COLUMN "isActive",
DROP COLUMN "type",
ADD COLUMN     "bonusCourseId" TEXT,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deliveryType" TEXT NOT NULL,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "eligibility" TEXT,
ADD COLUMN     "resourceDocumentId" TEXT,
ADD COLUMN     "sourceTypeFilter" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'Active';

-- AlterTable
ALTER TABLE "IncentiveRedemption" ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "Lesson" ADD COLUMN     "completionRule" TEXT NOT NULL DEFAULT 'View',
ADD COLUMN     "description" TEXT,
ADD COLUMN     "duration" TEXT,
ADD COLUMN     "lessonDisplayId" TEXT NOT NULL,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'Draft',
ADD COLUMN     "textContent" TEXT;

-- AlterTable
ALTER TABLE "LessonProgress" ADD COLUMN     "lastAccessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'Not Started';

-- AlterTable
ALTER TABLE "MarketingConsent" ADD COLUMN     "consentVersion" TEXT NOT NULL,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'Withdrawn';

-- AlterTable
ALTER TABLE "TrainingAttendance" ADD COLUMN     "checkInTime" TIMESTAMP(3),
ADD COLUMN     "checkOutTime" TIMESTAMP(3),
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "eligibility" TEXT NOT NULL DEFAULT 'Eligible',
ADD COLUMN     "method" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'Registered';

-- AlterTable
ALTER TABLE "TrainingSession" DROP COLUMN "mode",
DROP COLUMN "scheduledAt",
ADD COLUMN     "batchId" TEXT,
ADD COLUMN     "capacity" INTEGER,
ADD COLUMN     "date" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "endTime" TEXT NOT NULL,
ADD COLUMN     "meetingId" TEXT,
ADD COLUMN     "meetingLink" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "passcode" TEXT,
ADD COLUMN     "platform" TEXT,
ADD COLUMN     "program" TEXT,
ADD COLUMN     "startTime" TEXT NOT NULL,
ADD COLUMN     "trainer" TEXT,
ADD COLUMN     "type" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "venue" TEXT,
ALTER COLUMN "status" SET DEFAULT 'Draft';

-- CreateTable
CREATE TABLE "LessonResource" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "documentId" TEXT,
    "url" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackageCourseAccess" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackageCourseAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LessonResource_lessonId_idx" ON "LessonResource"("lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "PackageCourseAccess_packageId_courseId_key" ON "PackageCourseAccess"("packageId", "courseId");

-- CreateIndex
CREATE INDEX "Certificate_batchId_idx" ON "Certificate"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "Course_courseDisplayId_key" ON "Course"("courseDisplayId");

-- CreateIndex
CREATE UNIQUE INDEX "Course_slug_key" ON "Course"("slug");

-- CreateIndex
CREATE INDEX "Course_status_idx" ON "Course"("status");

-- CreateIndex
CREATE UNIQUE INDEX "FeedbackRequest_requestDisplayId_key" ON "FeedbackRequest"("requestDisplayId");

-- CreateIndex
CREATE INDEX "FeedbackRequest_batchId_idx" ON "FeedbackRequest"("batchId");

-- CreateIndex
CREATE INDEX "FeedbackRequest_status_idx" ON "FeedbackRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "FeedbackSubmission_feedbackDisplayId_key" ON "FeedbackSubmission"("feedbackDisplayId");

-- CreateIndex
CREATE INDEX "FeedbackSubmission_status_idx" ON "FeedbackSubmission"("status");

-- CreateIndex
CREATE UNIQUE INDEX "IncentiveRedemption_incentiveId_feedbackSubmissionId_key" ON "IncentiveRedemption"("incentiveId", "feedbackSubmissionId");

-- CreateIndex
CREATE UNIQUE INDEX "Lesson_lessonDisplayId_key" ON "Lesson"("lessonDisplayId");

-- CreateIndex
CREATE INDEX "TrainingSession_batchId_idx" ON "TrainingSession"("batchId");

-- AddForeignKey
ALTER TABLE "LessonResource" ADD CONSTRAINT "LessonResource_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonResource" ADD CONSTRAINT "LessonResource_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageCourseAccess" ADD CONSTRAINT "PackageCourseAccess_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageCourseAccess" ADD CONSTRAINT "PackageCourseAccess_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_reissueOfId_fkey" FOREIGN KEY ("reissueOfId") REFERENCES "Certificate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackRequest" ADD CONSTRAINT "FeedbackRequest_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackRequest" ADD CONSTRAINT "FeedbackRequest_incentiveId_fkey" FOREIGN KEY ("incentiveId") REFERENCES "Incentive"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackSubmission" ADD CONSTRAINT "FeedbackSubmission_videoDocumentId_fkey" FOREIGN KEY ("videoDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incentive" ADD CONSTRAINT "Incentive_bonusCourseId_fkey" FOREIGN KEY ("bonusCourseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incentive" ADD CONSTRAINT "Incentive_resourceDocumentId_fkey" FOREIGN KEY ("resourceDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

