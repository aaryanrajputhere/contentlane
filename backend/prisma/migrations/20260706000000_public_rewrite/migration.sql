-- Clean rewrite: drop legacy ContentLane tables and enum types before creating the new public schema.
DROP TABLE IF EXISTS "User" CASCADE;
DROP TABLE IF EXISTS "AllowedEmail" CASCADE;
DROP TABLE IF EXISTS "Campaign" CASCADE;
DROP TABLE IF EXISTS "BrandContext" CASCADE;
DROP TABLE IF EXISTS "Product" CASCADE;
DROP TABLE IF EXISTS "ScriptGeneration" CASCADE;
DROP TABLE IF EXISTS "HookTemplate" CASCADE;
DROP TABLE IF EXISTS "GenerationJob" CASCADE;
DROP TABLE IF EXISTS "UsageEvent" CASCADE;
DROP TABLE IF EXISTS "MediaAsset" CASCADE;
DROP TABLE IF EXISTS "Creator" CASCADE;
DROP TABLE IF EXISTS "ContentProject" CASCADE;
DROP TABLE IF EXISTS "DemoClip" CASCADE;
DROP TABLE IF EXISTS "HookConcept" CASCADE;
DROP TABLE IF EXISTS "HookImage" CASCADE;
DROP TABLE IF EXISTS "HookVideo" CASCADE;
DROP TABLE IF EXISTS "ProjectExport" CASCADE;
DROP TABLE IF EXISTS "BrandProfile" CASCADE;
DROP TABLE IF EXISTS "HookDraft" CASCADE;
DROP TABLE IF EXISTS "ScriptDraft" CASCADE;
DROP TABLE IF EXISTS "Project" CASCADE;

DROP TYPE IF EXISTS "UserRole" CASCADE;
DROP TYPE IF EXISTS "CampaignStatus" CASCADE;
DROP TYPE IF EXISTS "JobType" CASCADE;
DROP TYPE IF EXISTS "JobStatus" CASCADE;
DROP TYPE IF EXISTS "UsageStatus" CASCADE;
DROP TYPE IF EXISTS "MediaType" CASCADE;
DROP TYPE IF EXISTS "ProjectStatus" CASCADE;
-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'ANALYZING', 'READY', 'HOOKS_READY', 'SCRIPTS_READY', 'MEDIA_READY', 'EXPORT_READY', 'FAILED');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('ANALYZE_WEBSITE', 'GENERATE_HOOKS', 'GENERATE_SCRIPTS', 'GENERATE_MEDIA', 'SAVE_EXPORT');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'ACTIVE', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO');

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "website" TEXT NOT NULL,
    "normalizedWebsite" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrandProfile" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "painPoints" TEXT[],
    "benefits" TEXT[],
    "voice" TEXT NOT NULL,
    "offer" TEXT NOT NULL,
    "cta" TEXT NOT NULL,
    "angles" TEXT[],
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HookDraft" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "hookText" TEXT NOT NULL,
    "angle" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HookDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScriptDraft" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "hookDraftId" TEXT,
    "title" TEXT NOT NULL,
    "scenes" JSONB NOT NULL,
    "cta" TEXT NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScriptDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "scriptDraftId" TEXT,
    "type" "MediaType" NOT NULL,
    "provider" TEXT NOT NULL,
    "providerId" TEXT,
    "url" TEXT NOT NULL,
    "mimeType" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectExport" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "settings" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectExport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationJob" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "JobType" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "progressMessage" TEXT,
    "input" JSONB NOT NULL,
    "result" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GenerationJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_normalizedWebsite_key" ON "Project"("normalizedWebsite");

-- CreateIndex
CREATE UNIQUE INDEX "BrandProfile_projectId_key" ON "BrandProfile"("projectId");

-- CreateIndex
CREATE INDEX "HookDraft_projectId_sortOrder_idx" ON "HookDraft"("projectId", "sortOrder");

-- CreateIndex
CREATE INDEX "ScriptDraft_projectId_createdAt_idx" ON "ScriptDraft"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "MediaAsset_projectId_createdAt_idx" ON "MediaAsset"("projectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectExport_projectId_key" ON "ProjectExport"("projectId");

-- CreateIndex
CREATE INDEX "GenerationJob_projectId_createdAt_idx" ON "GenerationJob"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "GenerationJob_status_createdAt_idx" ON "GenerationJob"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "BrandProfile" ADD CONSTRAINT "BrandProfile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HookDraft" ADD CONSTRAINT "HookDraft_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptDraft" ADD CONSTRAINT "ScriptDraft_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScriptDraft" ADD CONSTRAINT "ScriptDraft_hookDraftId_fkey" FOREIGN KEY ("hookDraftId") REFERENCES "HookDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_scriptDraftId_fkey" FOREIGN KEY ("scriptDraftId") REFERENCES "ScriptDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectExport" ADD CONSTRAINT "ProjectExport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationJob" ADD CONSTRAINT "GenerationJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

