-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "campaignDisplayId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "product" TEXT,
    "offer" TEXT,
    "audience" TEXT,
    "platform" TEXT,
    "funnelStage" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "masterBrainVersionAtCreation" INTEGER,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeAngle" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "angleName" TEXT NOT NULL,
    "angleType" TEXT NOT NULL,
    "audience" TEXT,
    "awarenessStage" TEXT,
    "coreMessage" TEXT NOT NULL,
    "painOrDesire" TEXT,
    "offerConnection" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Generated',
    "sourceGenerationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreativeAngle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hook" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "angleId" TEXT,
    "studentId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Generated',
    "sourceGenerationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Hook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Script" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "angleId" TEXT,
    "hookId" TEXT,
    "studentId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "scriptType" TEXT NOT NULL,
    "platform" TEXT,
    "durationSeconds" INTEGER,
    "presenterType" TEXT,
    "cta" TEXT,
    "sectionsJson" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "validationJson" JSONB,
    "sourceGenerationId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Script_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Storyboard" (
    "id" TEXT NOT NULL,
    "scriptId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "visualStyle" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Storyboard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryboardScene" (
    "id" TEXT NOT NULL,
    "storyboardId" TEXT NOT NULL,
    "sceneNumber" INTEGER NOT NULL,
    "durationSeconds" INTEGER,
    "dialogue" TEXT,
    "character" TEXT,
    "characterAction" TEXT,
    "facialExpression" TEXT,
    "location" TEXT,
    "cameraShot" TEXT,
    "cameraMovement" TEXT,
    "composition" TEXT,
    "lighting" TEXT,
    "props" TEXT,
    "bRoll" TEXT,
    "onScreenText" TEXT,
    "graphicElements" TEXT,
    "transition" TEXT,
    "soundDirection" TEXT,
    "continuityNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoryboardScene_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterProfile" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "referenceImageDocumentId" TEXT,
    "appearanceNotes" TEXT,
    "defaultWardrobe" TEXT,
    "accessories" TEXT,
    "brandRole" TEXT,
    "continuityInstructions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CharacterProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScenePrompt" (
    "id" TEXT NOT NULL,
    "sceneId" TEXT NOT NULL,
    "characterProfileId" TEXT,
    "studentId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "targetProvider" TEXT NOT NULL DEFAULT 'GENERIC',
    "imagePromptText" TEXT NOT NULL,
    "imagePromptStructuredJson" JSONB NOT NULL,
    "videoPromptText" TEXT NOT NULL,
    "videoPromptStructuredJson" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROMPT_READY',
    "sourceGenerationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScenePrompt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignCopyVariant" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "platform" TEXT,
    "copyType" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignCopyVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativePackage" (
    "id" TEXT NOT NULL,
    "packageDisplayId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "angleId" TEXT,
    "hookId" TEXT,
    "scriptId" TEXT,
    "storyboardId" TEXT,
    "characterProfileId" TEXT,
    "copyVariantIdsJson" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "reviewNotes" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "supersedesId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreativePackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreativeTest" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "creativePackageId" TEXT,
    "angleLabel" TEXT,
    "hookLabel" TEXT,
    "format" TEXT,
    "platform" TEXT,
    "startDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'Planned',
    "spend" DECIMAL(12,2),
    "impressions" INTEGER,
    "reach" INTEGER,
    "ctr" DECIMAL(6,4),
    "cpc" DECIMAL(10,2),
    "cpm" DECIMAL(10,2),
    "leads" INTEGER,
    "costPerLead" DECIMAL(10,2),
    "messages" INTEGER,
    "costPerConversation" DECIMAL(10,2),
    "purchases" INTEGER,
    "revenue" DECIMAL(12,2),
    "roas" DECIMAL(8,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreativeTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspirationReference" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "referenceType" TEXT NOT NULL,
    "title" TEXT,
    "url" TEXT,
    "documentId" TEXT,
    "notes" TEXT,
    "analysisJson" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InspirationReference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_campaignDisplayId_key" ON "Campaign"("campaignDisplayId");

-- CreateIndex
CREATE INDEX "Campaign_studentId_idx" ON "Campaign"("studentId");

-- CreateIndex
CREATE INDEX "Campaign_businessId_idx" ON "Campaign"("businessId");

-- CreateIndex
CREATE INDEX "CreativeAngle_campaignId_idx" ON "CreativeAngle"("campaignId");

-- CreateIndex
CREATE INDEX "CreativeAngle_businessId_idx" ON "CreativeAngle"("businessId");

-- CreateIndex
CREATE INDEX "Hook_campaignId_idx" ON "Hook"("campaignId");

-- CreateIndex
CREATE INDEX "Hook_businessId_idx" ON "Hook"("businessId");

-- CreateIndex
CREATE INDEX "Script_campaignId_idx" ON "Script"("campaignId");

-- CreateIndex
CREATE INDEX "Script_businessId_idx" ON "Script"("businessId");

-- CreateIndex
CREATE INDEX "Storyboard_scriptId_idx" ON "Storyboard"("scriptId");

-- CreateIndex
CREATE INDEX "Storyboard_campaignId_idx" ON "Storyboard"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "StoryboardScene_storyboardId_sceneNumber_key" ON "StoryboardScene"("storyboardId", "sceneNumber");

-- CreateIndex
CREATE INDEX "CharacterProfile_businessId_idx" ON "CharacterProfile"("businessId");

-- CreateIndex
CREATE INDEX "ScenePrompt_sceneId_idx" ON "ScenePrompt"("sceneId");

-- CreateIndex
CREATE INDEX "ScenePrompt_businessId_idx" ON "ScenePrompt"("businessId");

-- CreateIndex
CREATE INDEX "CampaignCopyVariant_campaignId_idx" ON "CampaignCopyVariant"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "CreativePackage_packageDisplayId_key" ON "CreativePackage"("packageDisplayId");

-- CreateIndex
CREATE INDEX "CreativePackage_campaignId_idx" ON "CreativePackage"("campaignId");

-- CreateIndex
CREATE INDEX "CreativePackage_businessId_idx" ON "CreativePackage"("businessId");

-- CreateIndex
CREATE INDEX "CreativeTest_campaignId_idx" ON "CreativeTest"("campaignId");

-- CreateIndex
CREATE INDEX "CreativeTest_businessId_idx" ON "CreativeTest"("businessId");

-- CreateIndex
CREATE INDEX "InspirationReference_businessId_idx" ON "InspirationReference"("businessId");

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeAngle" ADD CONSTRAINT "CreativeAngle_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hook" ADD CONSTRAINT "Hook_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Script" ADD CONSTRAINT "Script_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Storyboard" ADD CONSTRAINT "Storyboard_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "Script"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Storyboard" ADD CONSTRAINT "Storyboard_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryboardScene" ADD CONSTRAINT "StoryboardScene_storyboardId_fkey" FOREIGN KEY ("storyboardId") REFERENCES "Storyboard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterProfile" ADD CONSTRAINT "CharacterProfile_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenePrompt" ADD CONSTRAINT "ScenePrompt_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "StoryboardScene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenePrompt" ADD CONSTRAINT "ScenePrompt_characterProfileId_fkey" FOREIGN KEY ("characterProfileId") REFERENCES "CharacterProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignCopyVariant" ADD CONSTRAINT "CampaignCopyVariant_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativePackage" ADD CONSTRAINT "CreativePackage_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreativeTest" ADD CONSTRAINT "CreativeTest_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspirationReference" ADD CONSTRAINT "InspirationReference_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

