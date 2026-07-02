CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');
CREATE TYPE "CampaignStatus" AS ENUM ('PENDING', 'ANALYZING', 'COMPLETED', 'FAILED');
CREATE TYPE "JobType" AS ENUM ('CAMPAIGN_ANALYSIS', 'HOOK_GENERATION', 'SCRIPT_GENERATION', 'IMAGE_GENERATION', 'VIDEO_GENERATION');
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'ACTIVE', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE "UsageStatus" AS ENUM ('RESERVED', 'CONSUMED', 'RELEASED');
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO');

ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER', ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Campaign" ADD COLUMN "userId" TEXT NOT NULL DEFAULT '', ADD COLUMN "websiteKey" TEXT NOT NULL DEFAULT '', ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "Campaign" SET "websiteKey" = lower(regexp_replace(regexp_replace("website", '^https?://(www\.)?', ''), '/$', ''));
ALTER TABLE "Campaign" ALTER COLUMN "websiteKey" DROP DEFAULT;
ALTER TABLE "Campaign" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Campaign" ALTER COLUMN "status" TYPE "CampaignStatus" USING "status"::"CampaignStatus";
ALTER TABLE "Campaign" ALTER COLUMN "status" SET DEFAULT 'PENDING';
ALTER TABLE "Product" ADD COLUMN "sourceKey" TEXT NOT NULL DEFAULT '', ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "Product" SET "sourceKey" = md5(COALESCE("url", lower("name")) || "id");
ALTER TABLE "Product" ALTER COLUMN "sourceKey" DROP DEFAULT;
ALTER TABLE "ScriptGeneration" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "ScriptGeneration" DROP CONSTRAINT IF EXISTS "ScriptGeneration_productId_fkey";
ALTER TABLE "ScriptGeneration" ADD CONSTRAINT "ScriptGeneration_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;

CREATE TABLE "AllowedEmail" ("id" TEXT NOT NULL, "email" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdById" TEXT, CONSTRAINT "AllowedEmail_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "AllowedEmail_email_key" ON "AllowedEmail"("email");
ALTER TABLE "AllowedEmail" ADD CONSTRAINT "AllowedEmail_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "GenerationJob" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "campaignId" TEXT, "scriptId" TEXT, "type" "JobType" NOT NULL, "status" "JobStatus" NOT NULL DEFAULT 'QUEUED', "progress" INTEGER NOT NULL DEFAULT 0, "progressMessage" TEXT, "input" JSONB NOT NULL, "result" JSONB, "errorCode" TEXT, "errorMessage" TEXT, "idempotencyKey" TEXT NOT NULL, "cancelRequestedAt" TIMESTAMP(3), "attempts" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "startedAt" TIMESTAMP(3), "completedAt" TIMESTAMP(3), "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "GenerationJob_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "GenerationJob_userId_type_idempotencyKey_key" ON "GenerationJob"("userId", "type", "idempotencyKey");
CREATE INDEX "GenerationJob_userId_createdAt_idx" ON "GenerationJob"("userId", "createdAt");
CREATE INDEX "GenerationJob_status_createdAt_idx" ON "GenerationJob"("status", "createdAt");
ALTER TABLE "GenerationJob" ADD CONSTRAINT "GenerationJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GenerationJob" ADD CONSTRAINT "GenerationJob_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GenerationJob" ADD CONSTRAINT "GenerationJob_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "ScriptGeneration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "UsageEvent" ("id" TEXT NOT NULL, "userId" TEXT NOT NULL, "jobId" TEXT NOT NULL, "category" TEXT NOT NULL, "units" INTEGER NOT NULL, "status" "UsageStatus" NOT NULL DEFAULT 'RESERVED', "periodStart" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "UsageEvent_pkey" PRIMARY KEY ("id"));
CREATE INDEX "UsageEvent_userId_category_periodStart_status_idx" ON "UsageEvent"("userId", "category", "periodStart", "status");
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UsageEvent" ADD CONSTRAINT "UsageEvent_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "GenerationJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MediaAsset" ("id" TEXT NOT NULL, "campaignId" TEXT NOT NULL, "scriptId" TEXT NOT NULL, "sceneIndex" INTEGER NOT NULL, "type" "MediaType" NOT NULL, "provider" TEXT NOT NULL, "providerId" TEXT, "secureUrl" TEXT NOT NULL, "mimeType" TEXT, "bytes" INTEGER, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id"));
CREATE INDEX "MediaAsset_scriptId_sceneIndex_idx" ON "MediaAsset"("scriptId", "sceneIndex");
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_scriptId_fkey" FOREIGN KEY ("scriptId") REFERENCES "ScriptGeneration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Campaign_userId_websiteKey_key" ON "Campaign"("userId", "websiteKey");
CREATE INDEX "Campaign_userId_createdAt_idx" ON "Campaign"("userId", "createdAt");
CREATE INDEX "Campaign_userId_status_idx" ON "Campaign"("userId", "status");
CREATE UNIQUE INDEX "Product_campaignId_sourceKey_key" ON "Product"("campaignId", "sourceKey");
CREATE INDEX "Product_campaignId_idx" ON "Product"("campaignId");
CREATE INDEX "ScriptGeneration_campaignId_productId_createdAt_idx" ON "ScriptGeneration"("campaignId", "productId", "createdAt");
