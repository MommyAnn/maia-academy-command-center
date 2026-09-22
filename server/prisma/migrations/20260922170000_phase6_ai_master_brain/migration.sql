-- DropIndex
DROP INDEX "MasterBrainSubmission_studentId_key";

-- AlterTable
ALTER TABLE "AiGeneration" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "errorCategory" TEXT,
ADD COLUMN     "model" TEXT,
ADD COLUMN     "promptVersionId" TEXT,
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "retryOfGenerationId" TEXT,
ADD COLUMN     "usageJson" JSONB,
ADD COLUMN     "validationJson" JSONB,
ALTER COLUMN "outputJson" DROP NOT NULL;

-- AlterTable
ALTER TABLE "AiTool" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "inputSchemaJson" JSONB,
ADD COLUMN     "modelConfigId" TEXT,
ADD COLUMN     "outputSchemaJson" JSONB,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "usageRulesJson" JSONB;

-- AlterTable
ALTER TABLE "MasterBrainDocument" ADD COLUMN     "aiModel" TEXT,
ADD COLUMN     "aiPromptVersionId" TEXT,
ADD COLUMN     "aiProvider" TEXT,
ADD COLUMN     "generatedById" TEXT,
ADD COLUMN     "generationMethod" TEXT NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "validationJson" JSONB;

-- AlterTable
ALTER TABLE "PromptVersion" ADD COLUMN     "name" TEXT,
ADD COLUMN     "publishedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AiModelConfig" (
    "id" TEXT NOT NULL,
    "configKey" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "purpose" TEXT,
    "temperature" DOUBLE PRECISION,
    "maxOutputTokens" INTEGER NOT NULL DEFAULT 4096,
    "supportsStructuredOutput" BOOLEAN NOT NULL DEFAULT true,
    "fallbackConfigKey" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiModelConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiProviderConfig" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "environment" TEXT NOT NULL DEFAULT 'TEST',
    "status" TEXT NOT NULL DEFAULT 'NOT_CONNECTED',
    "lastSuccessfulRequestAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "lastErrorMessage" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiProviderConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiHandoff" (
    "id" TEXT NOT NULL,
    "sourceGenerationId" TEXT NOT NULL,
    "destinationToolId" TEXT NOT NULL,
    "selectedSectionsJson" JSONB NOT NULL,
    "userInstructions" TEXT,
    "destinationGenerationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiHandoff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsageLimit" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "packageId" TEXT,
    "toolId" TEXT,
    "dailyLimit" INTEGER,
    "monthlyLimit" INTEGER,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiUsageLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiModelConfig_configKey_key" ON "AiModelConfig"("configKey");

-- CreateIndex
CREATE UNIQUE INDEX "AiProviderConfig_provider_key" ON "AiProviderConfig"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "AiHandoff_destinationGenerationId_key" ON "AiHandoff"("destinationGenerationId");

-- CreateIndex
CREATE UNIQUE INDEX "AiUsageLimit_scope_packageId_toolId_key" ON "AiUsageLimit"("scope", "packageId", "toolId");

-- CreateIndex
CREATE UNIQUE INDEX "MasterBrainSubmission_businessId_key" ON "MasterBrainSubmission"("businessId");

-- AddForeignKey
ALTER TABLE "AiTool" ADD CONSTRAINT "AiTool_modelConfigId_fkey" FOREIGN KEY ("modelConfigId") REFERENCES "AiModelConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiGeneration" ADD CONSTRAINT "AiGeneration_promptVersionId_fkey" FOREIGN KEY ("promptVersionId") REFERENCES "PromptVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiHandoff" ADD CONSTRAINT "AiHandoff_sourceGenerationId_fkey" FOREIGN KEY ("sourceGenerationId") REFERENCES "AiGeneration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiHandoff" ADD CONSTRAINT "AiHandoff_destinationToolId_fkey" FOREIGN KEY ("destinationToolId") REFERENCES "AiTool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiHandoff" ADD CONSTRAINT "AiHandoff_destinationGenerationId_fkey" FOREIGN KEY ("destinationGenerationId") REFERENCES "AiGeneration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsageLimit" ADD CONSTRAINT "AiUsageLimit_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsageLimit" ADD CONSTRAINT "AiUsageLimit_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "AiTool"("id") ON DELETE SET NULL ON UPDATE CASCADE;

