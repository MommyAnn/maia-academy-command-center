-- CreateTable
CREATE TABLE "SafetyControl" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "reason" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SafetyControl_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SafetyControl_key_key" ON "SafetyControl"("key");
