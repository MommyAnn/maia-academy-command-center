-- CreateTable
CREATE TABLE "VideoGenerationJob" (
    "id" TEXT NOT NULL,
    "jobDisplayId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "campaignId" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'GOOGLE',
    "model" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "negativePrompt" TEXT,
    "aspectRatio" TEXT NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "referenceImageDocumentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "operationName" TEXT,
    "errorMessage" TEXT,
    "errorCategory" TEXT,
    "resultDocumentId" TEXT,
    "requestedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "VideoGenerationJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VideoGenerationJob_jobDisplayId_key" ON "VideoGenerationJob"("jobDisplayId");

-- CreateIndex
CREATE INDEX "VideoGenerationJob_studentId_idx" ON "VideoGenerationJob"("studentId");

-- CreateIndex
CREATE INDEX "VideoGenerationJob_businessId_idx" ON "VideoGenerationJob"("businessId");

-- CreateIndex
CREATE INDEX "VideoGenerationJob_status_idx" ON "VideoGenerationJob"("status");

-- AddForeignKey
ALTER TABLE "VideoGenerationJob" ADD CONSTRAINT "VideoGenerationJob_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoGenerationJob" ADD CONSTRAINT "VideoGenerationJob_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

