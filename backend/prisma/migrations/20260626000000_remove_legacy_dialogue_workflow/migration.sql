-- Remove the legacy project editor and character-dialogue data model.
DROP TABLE IF EXISTS "Project";
DROP TABLE IF EXISTS "Character";

-- Reconcile the retained marketing workflow with the historical migration chain.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "password" TEXT NOT NULL DEFAULT '';
ALTER TABLE "User"
  ALTER COLUMN "password" DROP DEFAULT;

CREATE TABLE IF NOT EXISTS "Campaign" (
  "id" TEXT NOT NULL,
  "website" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BrandContext" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "brandName" TEXT NOT NULL,
  "productCategory" TEXT NOT NULL,
  "targetAudience" TEXT[] NOT NULL,
  "benefits" TEXT[] NOT NULL,
  "painPoints" TEXT[] NOT NULL,
  "objections" TEXT[] NOT NULL,
  "uniqueSellingPoints" TEXT[] NOT NULL,
  "brandVoice" TEXT NOT NULL,
  "socialProof" TEXT[] NOT NULL,
  "productSummary" TEXT NOT NULL DEFAULT '',
  "customerDesires" TEXT[] NOT NULL,
  "emotionalTriggers" TEXT[] NOT NULL,
  "purchaseMotivations" TEXT[] NOT NULL,
  "contentAngles" TEXT[] NOT NULL,
  "hooks" JSONB,
  "competitorAlternatives" TEXT[] NOT NULL,
  "customerIdentity" TEXT[] NOT NULL,
  CONSTRAINT "BrandContext_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BrandContext_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "BrandContext_campaignId_key"
  ON "BrandContext"("campaignId");

CREATE TABLE IF NOT EXISTS "Product" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "imageUrls" TEXT[] NOT NULL,
  "url" TEXT,
  CONSTRAINT "Product_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Product_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ScriptGeneration" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "hook" TEXT NOT NULL,
  "scenes" JSONB NOT NULL DEFAULT '[]',
  "templateType" TEXT NOT NULL,
  "cta" TEXT NOT NULL,
  "durationSeconds" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ScriptGeneration_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ScriptGeneration_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ScriptGeneration_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Creator" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "imageUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Creator_pkey" PRIMARY KEY ("id")
);
