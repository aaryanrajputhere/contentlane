-- Add Contentlane project pipeline models.
ALTER TYPE "JobType" ADD VALUE IF NOT EXISTS 'CONTENTLANE_ANALYSIS';
ALTER TYPE "JobType" ADD VALUE IF NOT EXISTS 'HOOK_CONCEPT_GENERATION';
ALTER TYPE "JobType" ADD VALUE IF NOT EXISTS 'HOOK_IMAGE_GENERATION';
ALTER TYPE "JobType" ADD VALUE IF NOT EXISTS 'HOOK_VIDEO_GENERATION';

CREATE TABLE "ContentProject" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "website" TEXT NOT NULL,
  "websiteKey" TEXT NOT NULL,
  "status" "CampaignStatus" NOT NULL DEFAULT 'PENDING',
  "brandContext" JSONB,
  "productContext" JSONB,
  "finalEdit" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContentProject_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DemoClip" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "originalUrl" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "bytes" INTEGER,
  "durationSeconds" DOUBLE PRECISION,
  "trimStartSeconds" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "trimEndSeconds" DOUBLE PRECISION,
  "width" INTEGER,
  "height" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DemoClip_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HookConcept" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "hookText" TEXT NOT NULL,
  "angle" TEXT NOT NULL,
  "creatorPrompt" TEXT NOT NULL,
  "imagePrompt" TEXT NOT NULL,
  "demoOverlayBeats" TEXT[],
  "ctaText" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HookConcept_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HookImage" (
  "id" TEXT NOT NULL,
  "hookConceptId" TEXT NOT NULL,
  "imageUrl" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "selected" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HookImage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HookVideo" (
  "id" TEXT NOT NULL,
  "hookImageId" TEXT NOT NULL,
  "sourceImageUrl" TEXT NOT NULL,
  "videoUrl" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "durationSeconds" INTEGER NOT NULL DEFAULT 2,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HookVideo_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "GenerationJob" ADD COLUMN "contentProjectId" TEXT;

CREATE UNIQUE INDEX "ContentProject_userId_websiteKey_key" ON "ContentProject"("userId", "websiteKey");
CREATE INDEX "ContentProject_userId_createdAt_idx" ON "ContentProject"("userId", "createdAt");
CREATE INDEX "ContentProject_userId_status_idx" ON "ContentProject"("userId", "status");
CREATE INDEX "DemoClip_projectId_createdAt_idx" ON "DemoClip"("projectId", "createdAt");
CREATE INDEX "HookConcept_projectId_createdAt_idx" ON "HookConcept"("projectId", "createdAt");
CREATE INDEX "HookImage_hookConceptId_createdAt_idx" ON "HookImage"("hookConceptId", "createdAt");
CREATE INDEX "HookImage_selected_idx" ON "HookImage"("selected");
CREATE INDEX "HookVideo_hookImageId_createdAt_idx" ON "HookVideo"("hookImageId", "createdAt");
CREATE INDEX "GenerationJob_contentProjectId_idx" ON "GenerationJob"("contentProjectId");

ALTER TABLE "ContentProject" ADD CONSTRAINT "ContentProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DemoClip" ADD CONSTRAINT "DemoClip_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ContentProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HookConcept" ADD CONSTRAINT "HookConcept_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ContentProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HookImage" ADD CONSTRAINT "HookImage_hookConceptId_fkey" FOREIGN KEY ("hookConceptId") REFERENCES "HookConcept"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HookVideo" ADD CONSTRAINT "HookVideo_hookImageId_fkey" FOREIGN KEY ("hookImageId") REFERENCES "HookImage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GenerationJob" ADD CONSTRAINT "GenerationJob_contentProjectId_fkey" FOREIGN KEY ("contentProjectId") REFERENCES "ContentProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
