CREATE TYPE "SocialPlatform" AS ENUM ('TIKTOK');
CREATE TYPE "SocialConnectionStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'NEEDS_RECONNECTION');
CREATE TYPE "SocialPublicationStatus" AS ENUM ('VALIDATING', 'PUBLISHING', 'PUBLISHED', 'FAILED');

CREATE TABLE "SocialProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "zernioProfileId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SocialProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocialAccount" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "socialProfileId" TEXT NOT NULL,
  "platform" "SocialPlatform" NOT NULL,
  "zernioAccountId" TEXT NOT NULL,
  "username" TEXT,
  "displayName" TEXT,
  "avatarUrl" TEXT,
  "countryCode" TEXT,
  "connectionStatus" "SocialConnectionStatus" NOT NULL DEFAULT 'CONNECTED',
  "metadata" JSONB,
  "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SocialAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocialPublication" (
  "id" TEXT NOT NULL,
  "requestKey" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "conceptId" TEXT,
  "renderJobId" TEXT,
  "socialAccountId" TEXT NOT NULL,
  "platform" "SocialPlatform" NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "caption" TEXT NOT NULL,
  "music" JSONB,
  "settings" JSONB NOT NULL,
  "zernioPostId" TEXT,
  "platformPostId" TEXT,
  "platformPostUrl" TEXT,
  "status" "SocialPublicationStatus" NOT NULL DEFAULT 'VALIDATING',
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "analytics" JSONB,
  "analyticsSyncedAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SocialPublication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocialWebhookEvent" (
  "eventId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocialWebhookEvent_pkey" PRIMARY KEY ("eventId")
);

CREATE UNIQUE INDEX "SocialProfile_userId_key" ON "SocialProfile"("userId");
CREATE UNIQUE INDEX "SocialProfile_zernioProfileId_key" ON "SocialProfile"("zernioProfileId");
CREATE UNIQUE INDEX "SocialAccount_zernioAccountId_key" ON "SocialAccount"("zernioAccountId");
CREATE UNIQUE INDEX "SocialAccount_userId_platform_key" ON "SocialAccount"("userId", "platform");
CREATE INDEX "SocialAccount_socialProfileId_idx" ON "SocialAccount"("socialProfileId");
CREATE UNIQUE INDEX "SocialPublication_zernioPostId_key" ON "SocialPublication"("zernioPostId");
CREATE UNIQUE INDEX "SocialPublication_requestKey_key" ON "SocialPublication"("requestKey");
CREATE INDEX "SocialPublication_projectId_createdAt_idx" ON "SocialPublication"("projectId", "createdAt");
CREATE INDEX "SocialPublication_socialAccountId_createdAt_idx" ON "SocialPublication"("socialAccountId", "createdAt");
CREATE INDEX "SocialPublication_renderJobId_conceptId_idx" ON "SocialPublication"("renderJobId", "conceptId");

ALTER TABLE "SocialProfile" ADD CONSTRAINT "SocialProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialAccount" ADD CONSTRAINT "SocialAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialAccount" ADD CONSTRAINT "SocialAccount_socialProfileId_fkey" FOREIGN KEY ("socialProfileId") REFERENCES "SocialProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialPublication" ADD CONSTRAINT "SocialPublication_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialPublication" ADD CONSTRAINT "SocialPublication_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "HookDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SocialPublication" ADD CONSTRAINT "SocialPublication_renderJobId_fkey" FOREIGN KEY ("renderJobId") REFERENCES "GenerationJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SocialPublication" ADD CONSTRAINT "SocialPublication_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "SocialAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
