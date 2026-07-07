-- CreateTable
CREATE TABLE "Creator" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "baseImageUrl" TEXT NOT NULL,
    "baseImageProvider" TEXT NOT NULL,
    "baseImageProviderId" TEXT,
    "baseImageMimeType" TEXT,
    "baseImageMetadata" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Creator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorClip" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "title" TEXT,
    "url" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerId" TEXT,
    "mimeType" TEXT,
    "metadata" JSONB,
    "tags" TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorClip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Creator_sortOrder_createdAt_idx" ON "Creator"("sortOrder", "createdAt");

-- CreateIndex
CREATE INDEX "CreatorClip_creatorId_sortOrder_idx" ON "CreatorClip"("creatorId", "sortOrder");

-- CreateIndex
CREATE INDEX "CreatorClip_createdAt_idx" ON "CreatorClip"("createdAt");

-- AddForeignKey
ALTER TABLE "CreatorClip" ADD CONSTRAINT "CreatorClip_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
